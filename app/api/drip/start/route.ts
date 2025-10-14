export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";
import { enqueueDrip } from "@/lib/queue";

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
    const durationMinNum = clamp(
      Number(body?.durationMin ?? 0),
      1,    // at least 1 minute
      24 * 60 // at most 24h
    );

    if (!rawDocId) {
      return NextResponse.json({ error: "Missing docId" }, { status: 400 });
    }
    if (!rawText) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }
    if (!Number.isFinite(durationMinNum)) {
      return NextResponse.json({ error: "Missing or invalid durationMin" }, { status: 400 });
    }

    // Tokenize and count words with your existing formula/util
    const { tokens, totalWords } = tokenizeKeepWhitespace(rawText);

    if (!totalWords || totalWords <= 0) {
      return NextResponse.json({ error: "No words to drip" }, { status: 400 });
    }

    const startedAt = new Date();
    // Make the first tick eligible immediately so the worker always finds it
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
      select: { id: true, totalWords: true, endsAt: true },
    });

    console.log("[drip/start] created session", { id: sessionRow.id, totalWords });

    // Enqueue first job for the BullMQ worker (Upstash Redis)
    try {
      const jobId = `${sessionRow.id}-first`;
      await enqueueDrip({ sessionId: sessionRow.id }, { delay: 500, jobId });
      console.log("[drip/start] first job enqueued", { sessionId: sessionRow.id, jobId, delay: 500 });
    } catch (e: any) {
      // If a duplicate request happened very quickly, it's possible the first job already exists.
      // Treat "job already exists" as success so UX doesn't get stuck.
      const msg = e?.message || String(e);
      if (/job.*already exists/i.test(msg)) {
        console.warn("[drip/start] first job already existed, continuing", { sessionId: sessionRow.id });
      } else {
        console.error("[drip/start] enqueue failed", e);
        return NextResponse.json(
          { error: "Failed to enqueue first job", details: msg },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      totalWords: sessionRow.totalWords,
      endsAt: sessionRow.endsAt,
      enqueued: true,
      jobId: `${sessionRow.id}-first`,
      enqueuedDelayMs: 500,
    });
  } catch (err: any) {
    console.error("Error starting drip session:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start drip session" },
      { status: 500 }
    );
  }
}