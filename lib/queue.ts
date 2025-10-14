// lib/queue.ts
// Central BullMQ queue + helpers for scheduling drip jobs.

import { Queue, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";

// ---- Redis connection (Upstash) ----
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing. Add it to your .env and Vercel env.");
}

// Use a singleton so dev hot-reloads don’t create multiple connections.
declare global {
  // eslint-disable-next-line no-var
  var __drip_redis__: IORedis | undefined;
  // eslint-disable-next-line no-var
  var __drip_queue__: Queue | undefined;
  // eslint-disable-next-line no-var
  var __drip_qevents__: QueueEvents | undefined;
}

const redis =
  global.__drip_redis__ ??
  new IORedis(REDIS_URL, {
    name: "dripwriter-redis",
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });

redis.on("connect", () => console.log("[queue] Connected to Upstash Redis"));
redis.on("error", (err) => console.error("[queue] Redis error:", err.message));

if (process.env.NODE_ENV !== "production") global.__drip_redis__ = redis;

// ---- Queue + Events ----
// BullMQ forbids ":" in queue names. Use a safe default and allow env override.
const RAW_QUEUE_NAME = process.env.DRIP_QUEUE_NAME ?? "dripwriter-drip";
const QUEUE_NAME = RAW_QUEUE_NAME.replace(/:/g, "-");

const queue =
  global.__drip_queue__ ??
  new Queue(QUEUE_NAME, {
    connection: redis,
    prefix: "{bullmq}",
    defaultJobOptions: {
      removeOnComplete: 500,
      removeOnFail: 1000,
      attempts: 5,
      backoff: { type: "exponential", delay: 5_000 },
    },
  });

const queueEvents =
  global.__drip_qevents__ ??
  new QueueEvents(QUEUE_NAME, { connection: redis, prefix: "{bullmq}" });

if (process.env.NODE_ENV !== "production") {
  global.__drip_queue__ = queue;
  global.__drip_qevents__ = queueEvents;
}

// Optional: tiny log for local debugging
queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.warn(`[queue][failed] job=${jobId} reason=${failedReason}`);
});
queueEvents.on("completed", ({ jobId }) => {
  console.log(`[queue][done] job=${jobId}`);
});

// ---- Public API ----

export type DripJobPayload = {
  sessionId: string; // DB id of DripSession
};

/**
 * Enqueue a drip job (optionally with a delay).
 * Use this from /api/drip/start to kick the first chunk immediately (delay=0),
 * and from your worker to schedule the next chunk with a humanish delay.
 */
export async function enqueueDrip(
  payload: DripJobPayload,
  opts?: { delayMs?: number; jobId?: string } & Partial<JobsOptions>
) {
  const { delayMs, jobId, ...rest } = opts ?? {};
  console.log("[enqueueDrip] queueing", payload.sessionId, "delay", delayMs ?? 0);
  return queue.add("drip-once", payload, {
    delay: delayMs ?? 0,
    jobId,
    ...rest,
  });
}

export { queue, queueEvents, QUEUE_NAME, redis };