// worker/drip-worker.ts
// Long-lived BullMQ worker that performs one "drip" chunk per job.

import { Worker, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { google } from "googleapis";

// NOTE: import your existing helpers
// - prisma: your Prisma client singleton
// - enqueueDrip: queue helper we created in step 1
// - getValidAccessToken: auto-refreshes Google tokens
// - tokenizeKeepWhitespace (optional if you want to reuse token logic)
import { prisma } from "../lib/db";
import { enqueueDrip } from "../lib/queue";
import { QUEUE_NAME } from "../lib/queue";
import { getValidAccessToken } from "../lib/google";

// -----------------------------------------
// Redis connection (Upstash)
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing");
}

const redis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// -----------------------------------------
// Utility
function nowUtc() { return new Date(); }

function safeSlice(s: string, n = 1500) {
  return s.length > n ? s.slice(0, n) : s;
}

function pickChunk(allWords: string[], start: number) {
  const remaining = allWords.length - start;
  const chunkSize = Math.max(8, Math.min(remaining, 20 + Math.floor(Math.random() * 40)));
  const text = allWords.slice(start, start + chunkSize).join(" ");
  return { text, chunkSize };
}

async function appendToGoogleDoc(docId: string, text: string, accessToken: string, prefixSpace = true) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const docs = google.docs({ version: "v1", auth });

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            text: (prefixSpace ? " " : "") + text,
            endOfSegmentLocation: {}, // append at end
          },
        },
      ],
    },
  });
}

// -----------------------------------------
// Worker: processes jobs from the queue
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY ?? "3");

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    console.log("[worker] picked up job", job.id, job.data);
    const { sessionId } = job.data as { sessionId: string };
    if (!sessionId) {
      console.warn("[worker] missing sessionId in job data");
      return;
    }

    // Load the session
    const session = await prisma.dripSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      console.warn("[worker] no session found for", sessionId);
      return;
    }

    console.log("[worker] loaded session", session.id, "status", session.status);

    if (session.status !== "RUNNING") {
      console.log("[worker] session not running, skipping", session.status);
      return;
    }

    // Safety: if “scheduled” tick came too early (nextAt in future), re-schedule
    if (session.nextAt && session.nextAt.getTime() > Date.now() + 5_000) {
      const delayMs = Math.max(0, session.nextAt.getTime() - Date.now());
      console.log("[worker] session scheduled in future, delaying", delayMs, "ms");
      await enqueueDrip({ sessionId }, { delay: delayMs, jobId: `${sessionId}-next` });
      return;
    }

    // Done already?
    if (session.doneWords >= session.totalWords) {
      console.log("[worker] session already complete", session.id);
      await prisma.dripSession.update({
        where: { id: session.id },
        data: { status: "DONE", nextAt: null, lastError: null },
      });
      return;
    }

    // Compute next chunk
    const words = session.text.split(/\s+/);
    const { text, chunkSize } = pickChunk(words, session.doneWords);

    console.log(`[worker] appending ${chunkSize} words to doc ${session.docId}`);

    // Append to Google Docs
    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId } });
      if (!user) throw new Error("User not found for session");
      const accessToken = await getValidAccessToken(user.id);

      await appendToGoogleDoc(session.docId, text, accessToken, session.doneWords > 0);

      console.log(`[worker] successfully appended chunk for session ${session.id}`);

      const newDone = session.doneWords + chunkSize;

      // Next run timing (human-ish)
      const pauseSec = 45 + Math.floor(Math.random() * 75); // 45–120s
      const nextAt = newDone >= session.totalWords ? null : new Date(Date.now() + pauseSec * 1000);

      await prisma.dripSession.update({
        where: { id: session.id },
        data: {
          doneWords: newDone,
          status: newDone >= session.totalWords ? "DONE" : "RUNNING",
          nextAt,
          lastError: null,
        },
      });

      if (nextAt) {
        const delayMs = Math.max(0, nextAt.getTime() - Date.now());
        console.log(`[worker] requeueing next job for ${session.id} in ${delayMs} ms`);
        await enqueueDrip({ sessionId }, { delay: delayMs, jobId: `${sessionId}-next` });
      }
    } catch (e: any) {
      console.error("[worker] error while appending", e);
      const msg = e?.message || String(e);
      const info = e?.response?.data ? { message: msg, google: e.response.data } : { message: msg };
      const isNoRefresh = /no refresh token/i.test(msg) || /invalid_grant/i.test(msg);

      await prisma.dripSession.update({
        where: { id: session.id },
        data: {
          lastError: safeSlice(JSON.stringify(info)),
          ...(isNoRefresh
            ? { status: "PAUSED", nextAt: null }
            : { nextAt: new Date(Date.now() + (120 + Math.floor(Math.random() * 180)) * 1000) }),
        },
      });

      if (!isNoRefresh) {
        const s2 = await prisma.dripSession.findUnique({ where: { id: session.id } });
        if (s2?.nextAt) {
          const delayMs = Math.max(0, s2.nextAt.getTime() - Date.now());
          console.log("[worker] scheduling retry for", session.id, "in", delayMs, "ms");
          await enqueueDrip({ sessionId }, { delay: delayMs, jobId: `${sessionId}-next` });
        }
      }

      throw e;
    }
  },
  {
    connection: redis,
    concurrency: CONCURRENCY,
    prefix: "{dripwriter}", // MUST match the prefix used when creating the Queue in lib/queue.ts
  }
);

worker.on("ready", () => console.log("[worker] ready and connected to Redis"));
worker.on("completed", (job) => console.log("[worker] completed", job.id));
worker.on("failed", (job, err) =>
  console.warn("[worker] failed", job?.id, err?.message || String(err))
);

// Keep process alive
process.on("SIGINT", async () => {
  console.log("Shutting down worker…");
  await worker.close();
  await redis.quit();
  process.exit(0);
});