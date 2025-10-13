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
    // Make the first tick eligible immediately so the kick always finds work
    const nextAt = new Date(startedAt.getTime() - 1_000);
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

    // Kick the processor for THIS session so the first chunk can start immediately
    try {
      const base = process.env.NEXT_PUBLIC_BASE_URL || resolveBaseUrl();
      const kickUrl = `${base}/api/drip/process?kick=1&sessionId=${encodeURIComponent(sessionRow.id)}`;

      console.log("[drip/start] kicking processor at", kickUrl);

      const res = await fetch(kickUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.CRON_SECRET!}`,
          "Cache-Control": "no-store",
        },
        cache: "no-store",
      });

      const bodyText = await res.text().catch(() => "");
      console.log("[drip/start] kick response", { status: res.status, body: bodyText.slice(0, 300) });

      if (!res.ok) {
        console.error("[drip/start] processor kick failed", res.status, bodyText.slice(0, 200));
      }
    } catch (err) {
      console.error("[drip/start] processor kick error", (err as Error)?.message || String(err));
    }

    // Owner kick as fallback (no secret; restricted in process route to the session owner)
    try {
      const base2 = process.env.NEXT_PUBLIC_BASE_URL || resolveBaseUrl();
      const ownerKickUrl = `${base2}/api/drip/process?owner=1&sessionId=${encodeURIComponent(sessionRow.id)}`;

      // Fire-and-forget; don't block the response
      fetch(ownerKickUrl, {
        method: "GET",
        cache: "no-store",
      })
        .then(async (r) => {
          const b = await r.text().catch(() => "");
          console.log("[drip/start] owner kick", { status: r.status, body: b.slice(0, 200) });
        })
        .catch((e) => console.warn("[drip/start] owner kick error", e?.message || String(e)));
    } catch (e) {
      console.warn("[drip/start] owner kick outer error", (e as Error)?.message || String(e));
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