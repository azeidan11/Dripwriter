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

    // Kick the processor for THIS session so the first chunk can start immediately,
    // then the Vercel Cron will take over each minute.
    try {
      const base = resolveBaseUrl();
      console.log("[drip/start] kicking process", {
        base: resolveBaseUrl(),
        hasSecret: !!process.env.CRON_SECRET,
        env: process.env.NODE_ENV,
        sessionId: sessionRow.id,
      });
      const headers: Record<string, string> = { "cache-control": "no-store" };
      if (process.env.CRON_SECRET) {
        headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
      }

      // Give the kick up to ~1.5s; non-blocking enough, but surfaces auth/base URL issues in logs.
      const controller = new AbortController();
      const kickUrl = `${base}/api/drip/process?kick=1&sessionId=${encodeURIComponent(sessionRow.id)}`;
      console.log("[drip/start] kick url", kickUrl);
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(kickUrl, {
          method: "GET",
          headers,
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error("[drip/start] kick failed", {
            status: res.status,
            body: text.slice(0, 200),
            url: kickUrl,
            base: base,
          });
        } else {
          // Optionally log a tiny breadcrumb so we can confirm kicks in Vercel logs
          console.log("[drip/start] kick ok", { url: kickUrl, status: res.status });
        }
      } catch (err) {
        clearTimeout(timeout);
        console.error("[drip/start] kick error", {
          message: (err as Error)?.message || String(err),
          base,
        });
      }
    } catch (e) {
      // Non-fatal: cron will pick it up on its own later.
      console.error("[drip/start] kick outer error", (e as Error)?.message || String(e));
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