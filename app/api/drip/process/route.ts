// app/api/drip/process/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getValidAccessToken } from "@/lib/google";
import { google } from "googleapis";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  const ownerKick = url.searchParams.get("owner") === "1";
  const forceSession = url.searchParams.get("sessionId") || undefined;
  const authz = req.headers.get("authorization");

  // -------- AUTH MODES --------
  let ownerUserId: string | null = null;

  // Mode A: Cron/secret header
  const hasCronHeader =
    authz && process.env.CRON_SECRET && authz === `Bearer ${process.env.CRON_SECRET}`;

  // Mode B: Owner session (no secret) — only allowed if owner=1
  if (!hasCronHeader && ownerKick) {
    try {
      const session = await getServerSession(authOptions as any);
      ownerUserId =
        (session as any)?.userId && typeof (session as any).userId === "string"
          ? ((session as any).userId as string)
          : null;
    } catch {
      ownerUserId = null;
    }
  }

  // Enforce authorization
  if (!hasCronHeader && !(ownerKick && ownerUserId)) {
    // In dev we allow ?dev=1
    const dev = url.searchParams.get("dev");
    if (process.env.NODE_ENV !== "production" && dev === "1") {
      // allow
    } else {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const started = Date.now();
  const processed: Array<Record<string, unknown>> = [];
  const errors: Array<Record<string, unknown>> = [];

  try {
    // Pick a job
    const baseWhere: any = { status: "RUNNING", nextAt: { lte: nowUtc() } };

    // If the owner is kicking, scope to their own session (and require a sessionId).
    let whereClause: any;
    if (ownerKick) {
      if (!forceSession) {
        return NextResponse.json({ ok: false, error: "owner kick requires sessionId" }, { status: 400 });
      }
      whereClause = { id: forceSession, ...(ownerUserId ? { userId: ownerUserId } : {}) };
    } else {
      whereClause = forceSession ? { id: forceSession } : baseWhere;
    }

    let job = await prisma.dripSession.findFirst({
      where: whereClause,
      orderBy: { nextAt: "asc" },
    });

    if (!job) {
      console.log("[process] no job ready", { ownerKick, forceSession, at: new Date().toISOString() });
      return NextResponse.json({
        ok: true,
        tookMs: Date.now() - started,
        processed,
        note: "no ready jobs",
        processedCount: 0,
      });
    }

    // Claim (visibility timeout)
    const claimUntil = new Date(Date.now() + 60_000);
    const claimed = await prisma.dripSession.updateMany({
      where: {
        id: job.id,
        status: "RUNNING",
        ...(forceSession && !ownerKick ? {} : { nextAt: { lte: nowUtc() } }),
      },
      data: { nextAt: claimUntil },
    });
    if (claimed.count === 0) {
      console.log("[process] race_lost", { id: job.id });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, note: "race_lost" });
    }

    if (job.doneWords >= job.totalWords) {
      await prisma.dripSession.update({
        where: { id: job.id },
        data: { status: "DONE", nextAt: undefined, lastError: null },
      });
      processed.push({ id: job.id, action: "mark_done" });
      console.log("[process] already done, marked DONE", { id: job.id });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, processedCount: processed.length });
    }

    // Chunk / append
    const words = job.text.split(/\s+/);
    const remaining = words.slice(job.doneWords);
    const chunkSize = Math.max(8, Math.min(remaining.length, 20 + Math.floor(Math.random() * 40)));
    const chunkText = remaining.slice(0, chunkSize).join(" ");

    try {
      const user = await prisma.user.findUnique({ where: { id: job.userId } });
      if (!user) throw new Error("User not found for job");

      const accessToken = await getValidAccessToken(user.id);
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const docs = google.docs({ version: "v1", auth });

      await docs.documents.batchUpdate({
        documentId: job.docId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: (job.doneWords === 0 ? "" : " ") + chunkText,
                endOfSegmentLocation: { segmentId: "" },
              },
            },
          ],
        },
      });

      const newDone = job.doneWords + chunkSize;
      const pauseSec = 45 + Math.floor(Math.random() * 75);
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
      console.log("[process] appended", {
        id: job.id,
        appended: chunkSize,
        newDone,
        nextAt: done.nextAt,
        status: done.status,
      });
      return NextResponse.json({ ok: true, tookMs: Date.now() - started, processed, processedCount: processed.length });
    } catch (e: unknown) {
      const info = serializeErr(e);
      const msg = (info as any)?.message || "Unknown error";
      const isNoRefresh = /no refresh token/i.test(String(msg)) || /invalid_grant/i.test(String(msg));

      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          lastError: safeSlice(JSON.stringify(info)),
          ...(isNoRefresh
            ? { status: "PAUSED", nextAt: undefined }
            : { nextAt: new Date(Date.now() + (120 + Math.floor(Math.random() * 180)) * 1000) }),
        },
      });

      console.warn("[process] append error", { id: job.id, info });
      const statusCode = isNoRefresh ? 409 : 500;
      return NextResponse.json({ ok: false, tookMs: Date.now() - started, errors: [{ id: job.id, info }] }, { status: statusCode });
    }
  } catch (e: any) {
    console.error("[process] fatal", e?.message || String(e));
    return NextResponse.json({ ok: false, tookMs: Date.now() - started, fatal: e?.message || String(e) }, { status: 500 });
  }
}