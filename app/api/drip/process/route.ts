// app/api/drip/process/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google";
import { google } from "googleapis";

function safeSlice(s: string, n = 1500) { return s.length > n ? s.slice(0, n) : s; }
function serializeErr(e: unknown) {
  const anyE = e as any;
  const base = { message: anyE?.message || String(e) };
  if (anyE?.response?.data) return { ...base, google: anyE.response.data };
  if (anyE?.stack) return { ...base, stack: String(anyE.stack).split("\n").slice(0, 3).join("\n") };
  return base;
}
function nowUtc() { return new Date(); }

export async function GET(req: Request) {
  const url = new URL(req.url);
  const authz = req.headers.get("authorization");
  const forceSession = url.searchParams.get("sessionId");
  const kick = url.searchParams.get("kick");
  const dev = url.searchParams.get("dev");

  console.log("[process] entry", { forceSession, kick: !!kick, hasAuth: !!authz, env: process.env.NODE_ENV, origin: url.origin });

  const originOk =
    typeof process.env.NEXT_PUBLIC_BASE_URL === "string" &&
    process.env.NEXT_PUBLIC_BASE_URL.length > 0 &&
    url.origin === process.env.NEXT_PUBLIC_BASE_URL;

  // Auth
  // In production, prefer Authorization: Bearer <CRON_SECRET>.
  // Additionally, allow same-origin "kick=1" calls (from our own start endpoint) without the header.
  if (process.env.NODE_ENV === "production") {
    const hasBearer = authz === `Bearer ${process.env.CRON_SECRET}`;
    const allowSameOriginKick = !!kick && originOk;
    if (!hasBearer && !allowSameOriginKick) {
      console.warn("[process] unauthorized", { hasBearer, allowSameOriginKick, originOk });
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  } else {
    if (!dev && authz !== `Bearer ${process.env.CRON_SECRET}`) {
      console.warn("[process] unauthorized (dev)", { hasAuth: !!authz });
      return NextResponse.json({ ok: false, error: "Unauthorized (dev: add ?dev=1)" }, { status: 401 });
    }
  }

  const started = Date.now();
  const processed: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];

  try {
    // Pick a ready job (or a specific one)
    const whereClause: any = forceSession
      ? { id: forceSession }
      : { status: "RUNNING", nextAt: { lte: nowUtc() } };

    const job = await prisma.dripSession.findFirst({
      where: whereClause,
      orderBy: { nextAt: "asc" },
    });

    if (!job) {
      console.log("[process] no job ready", { forceSession, kick: !!kick, originOk });
      return NextResponse.json({ ok: true, note: "no ready jobs", processedCount: 0, tookMs: Date.now() - started });
    }

    // Claim (visibility timeout)
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
      console.log("[process] race_lost", { id: job.id });
      return NextResponse.json({ ok: true, note: "race_lost", processedCount: 0, tookMs: Date.now() - started });
    }

    // If already finished, mark DONE and clear scheduling
    if (job.doneWords >= job.totalWords) {
      await prisma.dripSession.update({
        where: { id: job.id },
        data: { status: "DONE", nextAt: null, lastError: null },
      });
      processed.push({ id: job.id, action: "mark_done" });
      return NextResponse.json({ ok: true, processed, processedCount: processed.length, tookMs: Date.now() - started });
    }

    const words = job.text.split(/\s+/);
    const remaining = words.slice(job.doneWords);
    const chunkSize = Math.max(8, Math.min(remaining.length, 20 + Math.floor(Math.random() * 40)));
    const chunkText = remaining.slice(0, chunkSize).join(" ");

    try {
      // Token for this user
      const user = await prisma.user.findUnique({ where: { id: job.userId } });
      if (!user) throw new Error("User not found for job");
      const accessToken = await getValidAccessToken(user.id);
      if (!accessToken) throw new Error("No access token available");

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const docs = google.docs({ version: "v1", auth });

      // Append at end of document — IMPORTANT: endOfSegmentLocation must be {} (no segmentId)
      const textToInsert = (job.doneWords === 0 ? "" : " ") + chunkText;
      console.log("[process] appending", { id: job.id, words: chunkSize });

      await docs.documents.batchUpdate({
        documentId: job.docId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: textToInsert,
                endOfSegmentLocation: {}, // <-- append at end
              },
            },
          ],
        },
      });

      const newDone = job.doneWords + chunkSize;
      const pauseSec = 45 + Math.floor(Math.random() * 75); // 45–120s
      const next = new Date(Date.now() + pauseSec * 1000);

      const done = await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          doneWords: newDone,
          status: newDone >= job.totalWords ? "DONE" : "RUNNING",
          nextAt: newDone >= job.totalWords ? null : next, // clear with null when DONE
          lastError: null,
        },
        select: { id: true, doneWords: true, totalWords: true, status: true, nextAt: true },
      });

      processed.push({ id: job.id, appended: chunkSize, newDone, status: done.status, nextAt: done.nextAt });
      console.log("[process] append ok", { id: job.id, status: done.status });
      return NextResponse.json({ ok: true, processed, processedCount: processed.length, tookMs: Date.now() - started });

    } catch (e: unknown) {
      const info = serializeErr(e);
      const msg = (info as any)?.message || "Unknown error";
      const isNoRefresh = /no refresh token/i.test(String(msg)) || /invalid_grant/i.test(String(msg));

      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          lastError: safeSlice(JSON.stringify(info)),
          ...(isNoRefresh
            ? { status: "PAUSED", nextAt: null } // require user to re-link Google
            : { nextAt: new Date(Date.now() + (120 + Math.floor(Math.random() * 180)) * 1000) }), // 2–5m backoff
        },
      });

      console.warn("[process] append error", { id: job.id, info });
      return NextResponse.json({ ok: false, errors: [info], tookMs: Date.now() - started }, { status: isNoRefresh ? 409 : 500 });
    }
  } catch (e: any) {
    console.error("[process] fatal", e?.message || String(e));
    return NextResponse.json({ ok: false, fatal: e?.message || String(e) }, { status: 500 });
  }
}