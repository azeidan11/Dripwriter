export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.userId as string | undefined;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const s = await prisma.dripSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, status: true, endsAt: true },
    });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (s.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (s.status === "DONE" || s.status === "CANCELED") {
      return NextResponse.json({ error: `Cannot resume a ${s.status.toLowerCase()} session.` }, { status: 400 });
    }

    // If it's already running, be idempotent
    if (s.status === "RUNNING") {
      return NextResponse.json({ ok: true, status: s.status });
    }

    // If already past end time, do not resume
    if (s.endsAt && Date.now() >= new Date(s.endsAt).getTime()) {
      return NextResponse.json({ error: "This session has reached its end time." }, { status: 400 });
    }

    const nextAt = new Date(Date.now() + 5_000); // schedule soon
    const updated = await prisma.dripSession.update({
      where: { id: sessionId },
      data: {
        status: "RUNNING",
        nextAt,
        lastError: null,
      },
      select: { status: true, nextAt: true },
    });

    return NextResponse.json({ ok: true, status: updated.status, nextAt: updated.nextAt });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to resume session" }, { status: 500 });
  }
}