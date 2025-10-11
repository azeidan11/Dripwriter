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
export async function POST() {
  const now = new Date();

  // Pull a small batch to avoid long-running requests
  const due = await prisma.dripSession.findMany({
    where: { status: "RUNNING", nextAt: { lte: now } },
    orderBy: { nextAt: "asc" },
    take: 10,
  });

  if (due.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  for (const job of due) {
    try {
      // If we've passed endsAt, finish this job
      if (now.getTime() >= job.endsAt.getTime()) {
        await prisma.dripSession.update({
          where: { id: job.id },
          data: { status: "DONE", nextAt: null },
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
      if (plan.napUntil && Date.now() < plan.napUntil) {
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
          data: { nextAt: new Date(Date.now() + 30_000) }, // try again soon
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

      const newDone = Math.min(job.totalWords, job.doneWords + plan.addedWords);
      const finished = newDone >= job.totalWords;

      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          doneWords: newDone,
          idx: plan.newIdx,
          status: finished ? "DONE" : "RUNNING",
          nextAt: finished
            ? null
            : new Date(Date.now() + (45_000 + Math.floor(Math.random() * 45_000))), // 45–90s jitter
        },
      });
    } catch (e: any) {
      // Record error and retry later
      await prisma.dripSession.update({
        where: { id: job.id },
        data: {
          status: "ERROR",
          lastError: (e?.message || String(e)).slice(0, 500),
          nextAt: new Date(Date.now() + 60_000), // retry in 60s
        },
      });
    }
  }

  return NextResponse.json({ processed: due.length });
}