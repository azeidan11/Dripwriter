export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";
import { GET as processGET } from "@/app/api/drip/process/route";

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
      // 1) Inline call: import and invoke the process route handler directly to avoid any networking issues.
      const inlineUrl = new URL("http://internal.local/api/drip/process");
      inlineUrl.searchParams.set("kick", "1");
      inlineUrl.searchParams.set("sessionId", sessionRow.id);

      const inlineHeaders = new Headers();
      if (process.env.CRON_SECRET) {
        inlineHeaders.set("Authorization", `Bearer ${process.env.CRON_SECRET}`);
      }

      const inlineRes = await processGET(
        new Request(inlineUrl.toString(), { method: "GET", headers: inlineHeaders })
      );
      const inlineBody = await inlineRes.text().catch(() => "");
      console.log("[drip/start] inline process result", {
        status: inlineRes.status,
        body: inlineBody.slice(0, 200),
      });

      // 2) Fire-and-forget external call as a secondary kick (useful in case of separate lambdas/warmers).
      try {
        const base = resolveBaseUrl();
        const headers: Record<string, string> = { "cache-control": "no-store" };
        if (process.env.CRON_SECRET) {
          headers["Authorization"] = `Bearer ${process.env.CRON_SECRET}`;
        }
        const controller = new AbortController();
        const kickUrl = `${base}/api/drip/process?kick=1&sessionId=${encodeURIComponent(sessionRow.id)}`;
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(kickUrl, { method: "GET", headers, cache: "no-store", signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text().catch(() => "");
        if (!res.ok) {
          console.warn("[drip/start] external kick failed", { status: res.status, body: text.slice(0, 200), url: kickUrl });
        } else {
          console.log("[drip/start] external kick ok", { status: res.status, url: kickUrl });
        }
      } catch (err) {
        console.warn("[drip/start] external kick error", { message: (err as Error)?.message || String(err) });
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