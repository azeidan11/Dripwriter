export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";

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
    const nextAt = new Date(startedAt.getTime() + 5_000);
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

    // Fire-and-forget: kick the processor once so the first chunk can start immediately,
    // then the Vercel Cron will take over each minute.
    try {
      const base =
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : (process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000");
      // Do not await; we just nudge the worker
      fetch(`${base}/api/drip/process?kick=1`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
        },
        // avoid keeping the route open while this runs
        cache: "no-store",
      }).catch(() => {});
    } catch {}

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