// lib/queue.ts
import { Queue, JobsOptions, QueueOptions } from "bullmq";
import IORedis from "ioredis";

// ---- Redis URL
const REDIS_URL = process.env.REDIS_URL;
if (!REDIS_URL) {
  throw new Error("REDIS_URL is missing. Add it to .env.local and Vercel envs.");
}

// small helper to show which Redis host we’re hitting
function redisHostFromUrl(u: string) {
  try {
    const url = new URL(u);
    return `${url.hostname}:${url.port || "6379"}`;
  } catch {
    return "(unparsable REDIS_URL)";
  }
}

// ---- Shared connection
export const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  name: "dripwriter-redis",
});

connection.on("connect", () => {
  console.log(
    "[queue] Connected to Redis",
    JSON.stringify({
      host: redisHostFromUrl(REDIS_URL!),
    })
  );
});
connection.on("error", (err) => console.error("[queue] Redis error:", err?.message || String(err)));

// ---- Queue identity
export const QUEUE_NAME = (process.env.DRIP_QUEUE_NAME ?? "drip").replace(/:/g, "-");
const QUEUE_PREFIX = "{dripwriter}"; // keep in sync with worker

const queueOptions: QueueOptions = {
  connection,
  prefix: QUEUE_PREFIX,
};

export const dripQueue = new Queue(QUEUE_NAME, queueOptions);

// loud identity log on module load
console.log(
  "[queue:init]",
  JSON.stringify({
    queueName: QUEUE_NAME,
    prefix: QUEUE_PREFIX,
    redis: redisHostFromUrl(REDIS_URL!),
  })
);

// ---- Public API
export type DripJobPayload = { sessionId: string };

export async function enqueueDrip(payload: DripJobPayload, opts: JobsOptions = {}) {
  const job = await dripQueue.add("tick", payload, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 1_000,
    ...opts,
  });
  console.log("[queue] enqueued", {
    id: job.id,
    name: job.name,
    payload,
    delay: opts.delay ?? 0,
  });
  return job;
}

// optional: quick describer used by the diag route
export function describeQueue() {
  return {
    queueName: QUEUE_NAME,
    prefix: QUEUE_PREFIX,
    redis: redisHostFromUrl(REDIS_URL!),
  };
}