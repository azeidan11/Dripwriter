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

    const payload = {
      id: s.id,
      status: s.status,
      doneWords: s.doneWords,
      totalWords: s.totalWords,
      nextAt: s.nextAt ?? null,
      endsAt: s.endsAt ?? null,
      lastError: s.lastError ?? null,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to fetch status" },
      { status: 500 }
    );
  }
}