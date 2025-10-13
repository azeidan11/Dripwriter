export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";

function resolveBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  return "http://localhost:3009";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.userId as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { docId, text, durationMin } = await req.json();
    if (!docId || !text || !durationMin) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { tokens, totalWords } = tokenizeKeepWhitespace(String(text));
    const startedAt = new Date();
    // Nudge first run a few seconds ahead so the next cron tick reliably picks it up
    const nextAt = new Date(startedAt.getTime() + 3_000);
    const endsAt = new Date(startedAt.getTime() + Number(durationMin) * 60_000);

    const sessionRow = await prisma.dripSession.create({
      data: {
        userId,
        docId: String(docId),
        text: String(text),
        totalWords,
        doneWords: 0,
        idx: 0,
        durationMin: Number(durationMin),
        status: "RUNNING",
        nextAt,
        startedAt,
        endsAt,
      },
      select: { id: true, totalWords: true, endsAt: true },
    });

    // Fire-and-forget: kick the processor for THIS session so the first chunk can start immediately,
    // then the Vercel Cron will take over each minute.
    try {
      const base = resolveBaseUrl();
      const headers: Record<string, string> = { "cache-control": "no-store" };

      // In production, /api/drip/process requires CRON_SECRET. If it's missing, the kick will be ignored
      // but the scheduled cron will still pick it up on the next minute.
      if (process.env.CRON_SECRET) {
        headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
      }

      // Do not await; just nudge the worker and let this request finish fast.
      fetch(`${base}/api/drip/process?kick=1&sessionId=${encodeURIComponent(sessionRow.id)}`, {
        method: "GET",
        headers,
        cache: "no-store",
      }).catch(() => {});
    } catch (e) {
      // Non-fatal: cron will pick it up on its own later.
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      totalWords: sessionRow.totalWords,
      endsAt: sessionRow.endsAt,
    });
  } catch (err: any) {
    console.error("Error starting drip session:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start drip session" },
      { status: 500 }
    );
  }
}