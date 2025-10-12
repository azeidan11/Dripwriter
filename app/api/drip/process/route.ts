// app/api/drip/process/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google"; // your helper that refreshes tokens
import { google } from "googleapis";

function nowUtc() { return new Date(); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const dev = url.searchParams.get("dev");
  const forceSession = url.searchParams.get("sessionId"); // handy to process one job
  const authz = req.headers.get("authorization");

  // Auth: in production, require CRON secret. In dev, allow ?dev=1 to run from your browser.
  if (process.env.NODE_ENV === "production") {
    if (authz !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (!dev && authz !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized (dev: add ?dev=1)" }, { status: 401 });
    }
  }

  const started = Date.now();
  const processed: any[] = [];
  const errors: any[] = [];

  try {
    // Pick one job ready to run
    const whereClause: any = forceSession
      ? { id: forceSession }
      : { status: "RUNNING", nextAt: { lte: nowUtc() } };

    const job = await prisma.dripSession.findFirst({
      where: whereClause,
      orderBy: { nextAt: "asc" },
    });

    if (!job) {
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, note: "no ready jobs" });
    }

    // Safety: if done, mark DONE and bail
    if (job.doneWords >= job.totalWords) {
      await prisma.dripSession.update({
        where: { id: job.id },
        data: { status: "DONE", nextAt: undefined, lastError: null },
      });
      processed.push({ id: job.id, action: "mark_done" });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed });
    }

    // Compute next chunk size + nextAt from your existing pacing formula.
    // Minimal example: 20–60 words + human-y pause (45–120s).
    const words = job.text.split(/\s+/);
    const remaining = words.slice(job.doneWords);
    const chunkSize = Math.max(8, Math.min(remaining.length, 20 + Math.floor(Math.random()*40)));
    const chunkText = remaining.slice(0, chunkSize).join(" ");

    // Append to Docs
    try {
      // Get a valid token for the job’s user
      const user = await prisma.user.findUnique({ where: { id: job.userId } });
      if (!user) throw new Error("User not found for job");
      const accessToken = await getValidAccessToken(user.id);

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const docs = google.docs({ version: "v1", auth });

      // Keep newlines: use insertText ops at end of doc (simple path)
      await docs.documents.batchUpdate({
        documentId: job.docId,
        requestBody: {
          requests: [
            {
              insertText: {
                // Appends at end of doc
                text: (job.doneWords === 0 ? "" : " ") + chunkText,
                endOfSegmentLocation: { segmentId: "" },
              },
            },
          ],
        },
      });

      const newDone = job.doneWords + chunkSize;

      // Schedule next tick with variability
      const pauseSec = 45 + Math.floor(Math.random() * 75); // 45–120s
      const next = new Date(Date.now() + pauseSec * 1000);

      const done = await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          doneWords: newDone,
          nextAt: newDone >= job.totalWords ? undefined : next,
          status: newDone >= job.totalWords ? "DONE" : "RUNNING",
          lastError: null,
        },
        select: { id: true, doneWords: true, totalWords: true, status: true, nextAt: true },
      });

      processed.push({ id: job.id, appended: chunkSize, newDone, status: done.status, nextAt: done.nextAt });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed });

    } catch (e: any) {
      // Persist error so UI can surface it
      const msg = e?.message || String(e);
      errors.push({ id: job.id, error: msg });
      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          lastError: msg,
          // back off 2–5 min on error to avoid hammering
          nextAt: new Date(Date.now() + (120 + Math.floor(Math.random()*180)) * 1000),
        },
      });
      return NextResponse.json({ ok: false, tookMs: Date.now() - started, errors }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, tookMs: Date.now() - started, fatal: e?.message || String(e) }, { status: 500 });
  }
}