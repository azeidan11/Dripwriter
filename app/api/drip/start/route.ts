export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as processGET } from "@/app/api/drip/process/route";
import { tokenizeKeepWhitespace } from "@/lib/dripFormula";

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
const HAS_CRON_SECRET = Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.length > 0);

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

    if (!HAS_CRON_SECRET) {
      console.warn("[drip/start] WARNING: CRON_SECRET is not set — network kicks will be unauthorized.");
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

    console.log("[drip/start] created session", sessionRow.id);

    // Kick the processor for THIS session so the first chunk can start immediately
    // We do both: (1) direct in-process AND (2) network kick (always).
    // --- 1) DIRECT, in-process kick (only if we have a secret so auth passes in process route) ---
    try {
      if (HAS_CRON_SECRET) {
        const directReq = new Request(
          `http://internal/api/drip/process?sessionId=${encodeURIComponent(sessionRow.id)}&kick=1`,
          {
            headers: new Headers({
              Authorization: `Bearer ${process.env.CRON_SECRET as string}`,
              "Cache-Control": "no-store",
            }),
          }
        );
        const directRes = await processGET(directReq as any);
        const body = await (directRes as Response).text().catch(() => "");
        console.log("[drip/start] direct kick =>", (directRes as Response).status, body.slice(0, 200));
      } else {
        console.log("[drip/start] direct kick skipped (no CRON_SECRET)");
      }
    } catch (err) {
      console.error("[drip/start] direct kick error:", (err as Error)?.message || String(err));
    }

    // --- 2) ALWAYS do a network kick so it shows in Vercel logs (3 retries with small backoff) ---
    try {
      // Prefer the exact origin that handled this request; fall back to resolved base URL.
      const origin = (() => {
        try { return new URL(req.url).origin; } catch { return resolveBaseUrl(); }
      })();
      const base = origin || resolveBaseUrl();

      const kickUrl = `${base}/api/drip/process?kick=1&sessionId=${encodeURIComponent(sessionRow.id)}`;
      console.log("[drip/start] network kick =>", kickUrl);

      const attempt = async (i: number) => {
        try {
          const r = await fetch(kickUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`,
              "Cache-Control": "no-store",
            },
            cache: "no-store",
          });
          const b = await r.text().catch(() => "");
          console.log("[drip/start] network kick response", r.status, b.slice(0, 300));
          if (!r.ok) throw new Error(`kick failed: ${r.status}`);
        } catch (e) {
          const msg = (e as Error)?.message || String(e);
          console.warn(`[drip/start] network kick attempt ${i + 1} failed:`, msg);
          if (i < 2) { await sleep(300 * (i + 1)); return attempt(i + 1); }
        }
      };
      // Fire-and-forget retries, no need to await all
      attempt(0);
    } catch (err2) {
      console.error("[drip/start] network kick outer error:", (err2 as Error)?.message || String(err2));
    }

    return NextResponse.json({
      sessionId: sessionRow.id,
      totalWords: sessionRow.totalWords,
      endsAt: sessionRow.endsAt,
      kicked: true,
    });
  } catch (err: any) {
    console.error("Error starting drip session:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to start drip session" },
      { status: 500 }
    );
  }
}