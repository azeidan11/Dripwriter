// lib/queue.ts
// Central BullMQ queue + helpers for scheduling drip jobs (Upstash Redis).

import { Queue, JobsOptions, QueueOptions } from "bullmq";
import IORedis from "ioredis";

// ---- Redis connection (Upstash) ----
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing. Add it to your .env(.local) and Vercel env.");
}

// Create a shared Redis connection for queue and worker
export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // name helps identify the connection in Upstash dashboards/logs
  name: "dripwriter-redis",
});

connection.on("connect", () => console.log("[queue] Connected to Upstash Redis"));
connection.on("error", (err) => console.error("[queue] Redis error:", err.message));

// ---- Queue ----
// BullMQ forbids ":" in queue names. Keep it simple and consistent with the worker.
export const QUEUE_NAME = (process.env.DRIP_QUEUE_NAME ?? "drip").replace(/:/g, "-");

const queueOptions: QueueOptions = {
  connection,
  // Use a stable prefix to avoid clashes with other BullMQ users on the same Redis
  prefix: "{dripwriter}",
};

// Singleton-ish queue instance (module-level)
export const dripQueue = new Queue(QUEUE_NAME, queueOptions);

// ---- Public API ----
export type DripJobPayload = {
  sessionId: string; // DB id of DripSession
};

/**
 * Enqueue a drip job (optionally with a delay).
 * Use this from /api/drip/start to kick the first chunk immediately (small delay),
 * and from your worker to schedule the next chunk with a human-ish delay.
 */
export async function enqueueDrip(
  payload: DripJobPayload,
  opts: JobsOptions = {}
) {
  const job = await dripQueue.add("tick", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 1_000,
    ...opts,
  });
  console.log("[queue] enqueued", { id: job.id, name: job.name, payload, opts: { delay: opts.delay } });
  return job;
}