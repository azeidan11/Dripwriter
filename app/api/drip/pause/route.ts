export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
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
      select: { id: true, userId: true, status: true },
    });
    if (!s) return NextResponse.json({ error: "Session not found" }, { status: 404 });
    if (s.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (s.status === "DONE" || s.status === "CANCELED") {
      return NextResponse.json({ error: `Cannot pause a ${s.status.toLowerCase()} session.` }, { status: 400 });
    }

    if (s.status === "PAUSED") {
      return NextResponse.json({ ok: true, status: s.status });
    }

    const updated = await prisma.dripSession.update({
      where: { id: sessionId },
      data: {
        status: "PAUSED",
        nextAt: null, // stop scheduling further chunks until resumed
      },
      select: { status: true },
    });

    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to pause session" }, { status: 500 });
  }
}