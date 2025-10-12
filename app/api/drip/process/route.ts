export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDocsClientForUser } from "@/lib/google";
import { computeNextChunk, tokenizeKeepWhitespace } from "@/lib/dripFormula";

/**
 * Processes due drip sessions. Intended to be called by a cron (e.g., every minute).
 * - Selects RUNNING sessions whose nextAt <= now
 * - Computes the next chunk using the same shared formula as the client
 * - Appends the chunk to Google Docs
 * - Updates idx/doneWords/nextAt/status
 */
async function processHandler(req: Request) {
  // Optional hardening: require Vercel Cron or shared secret in production
  const hdrs = req.headers;
  const fromCron = hdrs.get("x-vercel-cron") === "1";
  const auth = hdrs.get("authorization");
  if (process.env.VERCEL_ENV) {
    const okBySecret = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!fromCron && !okBySecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  // Pull a small batch to avoid long-running requests
  const due = await prisma.dripSession.findMany({
    where: { status: "RUNNING", nextAt: { lte: now } },
    orderBy: { nextAt: "asc" },
    take: 10,
  });

  if (due.length === 0) {
    console.log("[cron] no due sessions at", now.toISOString());
    return NextResponse.json({ processed: 0 });
  }

  console.log("[cron] due:", due.map((d: { id: string; nextAt: Date | null | undefined }) => ({ id: d.id, nextAt: d.nextAt })));

  for (const job of due) {
    // Pre-lock this job so overlapping cron runs don't process it twice.
    // We optimistically check idx and nextAt to ensure we're the first mover.
    const lockUntil = new Date(now.getTime() + 30_000); // 30s lock
    const locked = await prisma.dripSession.updateMany({
      where: {
        id: job.id,
        status: "RUNNING",
        nextAt: { lte: now },
        idx: job.idx,
      },
      data: { nextAt: lockUntil },
    });
    if (locked.count === 0) {
      // Another invocation already picked it up.
      continue;
    }
    try {
      // If we've passed endsAt, finish this job
      if (now.getTime() >= job.endsAt.getTime()) {
        await prisma.dripSession.update({
          where: { id: job.id },
          data: { status: "DONE" },
        });
        continue;
      }

      const { tokens } = tokenizeKeepWhitespace(job.text);

      const plan = computeNextChunk({
        tokens,
        idx: job.idx,
        totalWords: job.totalWords,
        doneWords: job.doneWords,
        tickMs: 2000, // keep parity with client base cadence
        startedAt: job.startedAt.getTime(),
        endsAt: job.endsAt.getTime(),
        // tuning: mirror client defaults
        basePauseProb: 0.12,
        lookaheadTicksBase: 8,
        maxBurstBase: 12,
        maxBurstCatchup: 28,
        longNapChance: 0.05,
        mediumNapChance: 0.15,
        longNapRange: [60_000, 180_000],
        mediumNapRange: [15_000, 45_000],
      });

      // If planner requests a nap, just push nextAt and continue
      if (plan.napUntil && now.getTime() < plan.napUntil) {
        await prisma.dripSession.update({
          where: { id: job.id },
          data: { nextAt: new Date(plan.napUntil) },
        });
        continue;
      }

      // Nothing to add right now; schedule a short revisit
      if (!plan.chunkText || plan.addedWords === 0) {
        await prisma.dripSession.update({
          where: { id: job.id },
          data: { nextAt: new Date(now.getTime() + 30_000) }, // try again soon
        });
        continue;
      }

      // Append chunk to the end of the document
      const docs = await getDocsClientForUser(job.userId);
      await docs.documents.batchUpdate({
        documentId: job.docId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: plan.chunkText,
                endOfSegmentLocation: { segmentId: "" }, // append to end
              },
            },
          ],
        },
      });
      console.log("[cron] appended", { id: job.id, add: plan.addedWords, newIdx: plan.newIdx });

      const newDone = Math.min(job.totalWords, job.doneWords + plan.addedWords);
      const finished = newDone >= job.totalWords;

      const updateData: {
        doneWords: number;
        idx: number;
        status: "DONE" | "RUNNING";
        nextAt?: Date;
      } = {
        doneWords: newDone,
        idx: plan.newIdx,
        status: finished ? "DONE" : "RUNNING",
      };
      if (!finished) {
        updateData.nextAt = new Date(now.getTime() + (45_000 + Math.floor(Math.random() * 45_000))); // 45–90s jitter
      }
      await prisma.dripSession.update({
        where: { id: job.id },
        data: updateData,
      });
    } catch (e: any) {
      // Record error and retry later
      console.error("[cron] error processing", { id: job.id, error: e?.message });
      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          status: "ERROR",
          lastError: (e?.message || String(e)).slice(0, 500),
          nextAt: new Date(now.getTime() + 60_000), // retry in 60s
        },
      });
    }
  }

  return NextResponse.json({ processed: due.length });
}

export async function GET(req: Request) {
  return processHandler(req);
}

export async function POST(req: Request) {
  return processHandler(req);
}