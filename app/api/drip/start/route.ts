// app/api/drip/start/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";
import { enqueueDrip, pingQueue } from "@/lib/queue";

type StartBody = {
  docId?: string;
  text?: string;
  durationMin?: number | string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.userId as string | undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: StartBody;
    try {
      body = (await req.json()) as StartBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawDocId = String(body?.docId ?? "").trim();
    const rawText = String(body?.text ?? "");
    const durationMinNum = clamp(Number(body?.durationMin ?? 0), 1, 24 * 60);

    if (!rawDocId) return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    if (!rawText) return NextResponse.json({ error: "Missing text" }, { status: 400 });
    if (!Number.isFinite(durationMinNum)) {
      return NextResponse.json({ error: "Missing or invalid durationMin" }, { status: 400 });
    }

    const { totalWords } = tokenizeKeepWhitespace(rawText);
    if (!totalWords || totalWords <= 0) {
      return NextResponse.json({ error: "No words to drip" }, { status: 400 });
    }

    const startedAt = new Date();
    // Make FIRST tick eligible immediately so worker can pick it up
    const nextAt = new Date(startedAt.getTime() - 1_000);
    const endsAt = new Date(startedAt.getTime() + durationMinNum * 60_000);

    const sessionRow = await prisma.dripSession.create({
      data: {
        userId,
        docId: rawDocId,
        text: rawText,
        totalWords,
        doneWords: 0,
        idx: 0,
        durationMin: durationMinNum,
        status: "RUNNING",
        nextAt,
        startedAt,
        endsAt,
        lastError: null,
      },
      select: { id: true, totalWords: true, endsAt: true, nextAt: true },
    });

    console.log("[drip/start] created session", sessionRow);

    // PROVE Redis connectivity in this lambda
    let ping: string | null = null;
    try {
      ping = await pingQueue(); // expect "PONG"
    } catch (e: any) {
      console.error("[drip/start] pingQueue failed:", e?.message || String(e));
    }

    // Enqueue first job for BullMQ worker (Upstash Redis)
    let enqId: string | null = null;
    try {
      const job = await enqueueDrip({ sessionId: sessionRow.id }, { delay: 250, jobId: `${sessionRow.id}-first` });
      enqId = String(job.id);
      console.log("[drip/start] first job enqueued", { jobId: enqId, sessionId: sessionRow.id });
    } catch (e) {
      console.error("[drip/start] enqueue failed", e);
      return NextResponse.json(
        {
          error: "Failed to enqueue first job",
          sessionId: sessionRow.id,
          ping,
          details: (e as any)?.message ?? String(e),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      totalWords: sessionRow.totalWords,
      endsAt: sessionRow.endsAt,
      nextAt: sessionRow.nextAt,
      enqueuedJobId: enqId,
      ping, // should be "PONG" in prod
    });
  } catch (err: any) {
    console.error("Error starting drip session:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start drip session" },
      { status: 500 }
    );
  }
}