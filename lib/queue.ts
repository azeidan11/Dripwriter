// lib/queue.ts
import { Queue, JobsOptions, QueueOptions } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing. Add it to your .env(.local) and Vercel env.");
}

export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  name: "dripwriter-redis",
});

connection.on("connect", () =>
  console.log("[queue] Connected to Redis", {
    host: (connection.options as any)?.host ?? String(REDIS_URL).replace(/^.*@/,"").replace(/:.*/,""),
  })
);
connection.on("error", (err) => console.error("[queue] Redis error:", err.message));

export const QUEUE_NAME = (process.env.DRIP_QUEUE_NAME ?? "drip").replace(/:/g, "-");

const queueOptions: QueueOptions = {
  connection,
  prefix: "{dripwriter}",
};

export const dripQueue = new Queue(QUEUE_NAME, queueOptions);

export type DripJobPayload = { sessionId: string };

export async function enqueueDrip(
  payload: DripJobPayload,
  opts: JobsOptions = {}
) {
  const jobId = opts.jobId ?? `${payload.sessionId}-${Date.now()}`;
  const job = await dripQueue.add("tick", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 1_000,
    ...opts,
    jobId,
  });
  console.log("[queue] ENQUEUED", {
    jobId: job.id,
    name: job.name,
    payload,
    delay: opts.delay ?? 0,
    queue: QUEUE_NAME,
    prefix: queueOptions.prefix,
  });
  return job;
}

export function describeQueue() {
  return {
    ping: connection.status === "ready" ? "PONG" : connection.status,
    queue: QUEUE_NAME,
    prefix: "{dripwriter}",
    redis: (connection as any)?.connector?.options?.host ??
           process.env.REDIS_URL?.replace(/^.*@/,'').replace(/\/\d+$/,''),
  };
}

// NEW: simple ping you can call from API routes to verify Redis connectivity at runtime
export async function pingQueue(): Promise<string> {
  return connection.ping();
}