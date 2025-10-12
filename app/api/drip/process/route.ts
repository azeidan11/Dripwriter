// app/api/drip/process/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google"; // your helper that refreshes tokens
import { google } from "googleapis";

function safeSlice(s: string, n = 1500) { return s.length > n ? s.slice(0, n) : s; }
function serializeErr(e: unknown) {
  const anyE = e as any;
  const base = { message: anyE?.message || String(e) };
  if (anyE?.response?.data) {
    return { ...base, google: anyE.response.data };
  }
  if (anyE?.stack) return { ...base, stack: String(anyE.stack).split("\n").slice(0, 3).join("\n") };
  return base;
}

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
  const processed: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];

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
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, note: "no ready jobs", processedCount: 0 });
    }

    // Try to claim the job to avoid two lambdas working the same session.
    // We bump nextAt by 60s as a short 'visibility timeout'.
    const claimUntil = new Date(Date.now() + 60_000);
    const claimed = await prisma.dripSession.updateMany({
      where: {
        id: job.id,
        status: "RUNNING",
        ...(forceSession ? {} : { nextAt: { lte: nowUtc() } }),
      },
      data: { nextAt: claimUntil },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, note: "race_lost" });
    }

    // Safety: if done, mark DONE and bail
    if (job.doneWords >= job.totalWords) {
      await prisma.dripSession.update({
        where: { id: job.id },
        data: { status: "DONE", nextAt: undefined, lastError: null },
      });
      processed.push({ id: job.id, action: "mark_done" });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, processedCount: processed.length });
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
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, processedCount: processed.length });

    } catch (e: unknown) {
      const info = serializeErr(e);
      // If token refresh failed because no refresh token on record, pause this session
      const msg = (info as any)?.message || "Unknown error";
      const isNoRefresh = /no refresh token/i.test(String(msg)) || /invalid_grant/i.test(String(msg));
      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          lastError: safeSlice(JSON.stringify(info)),
          ...(isNoRefresh
            ? { status: "PAUSED", nextAt: undefined } // require user to re-connect Google
            : {
                // back off 2–5 min on other errors to avoid hammering and let transient issues recover
                nextAt: new Date(Date.now() + (120 + Math.floor(Math.random() * 180)) * 1000),
              }),
        },
      });
      errors.push({ id: job.id, error: info });
      const statusCode = isNoRefresh ? 409 : 500;
      return NextResponse.json({ ok: false, tookMs: Date.now() - started, errors }, { status: statusCode });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, tookMs: Date.now() - started, fatal: e?.message || String(e) }, { status: 500 });
  }
}