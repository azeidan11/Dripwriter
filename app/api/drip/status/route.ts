export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const s = await prisma.dripSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        doneWords: true,
        totalWords: true,
        nextAt: true,
        endsAt: true,
        lastError: true,
      },
    });

    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Compute server-side countdowns to avoid client clock drift.
    const serverNow = Date.now();
    const nextInMs = s.nextAt ? Math.max(0, new Date(s.nextAt).getTime() - serverNow) : null;
    const endsInMs = s.endsAt ? Math.max(0, new Date(s.endsAt).getTime() - serverNow) : null;

    return NextResponse.json(
      {
        id: s.id,
        status: s.status,           // "RUNNING" | "PAUSED" | "DONE" | "CANCELED"
        doneWords: s.doneWords,
        totalWords: s.totalWords,
        nextAt: s.nextAt ?? null,
        endsAt: s.endsAt ?? null,
        nextInMs,                   // ms until next chunk (null if none scheduled)
        endsInMs,                   // ms until end (null if unknown/not set)
        lastError: s.lastError ?? null,
        serverNow,                  // epoch ms used by client for drift correction
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: unknown) {
    const message = (err as Error)?.message ?? "Failed to fetch status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}