// scripts/queue-stats.ts
import { Queue } from "bullmq";
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL!;
const QUEUE_NAME = (process.env.DRIP_QUEUE_NAME ?? "drip").replace(/:/g, "-");
const PREFIX = "{dripwriter}";

async function main() {
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const queue = new Queue(QUEUE_NAME, { connection, prefix: PREFIX });

  const counts = await queue.getJobCounts(
    'waiting',
    'active',
    'delayed',
    'completed',
    'failed',
    'paused'
  );

  console.log({ QUEUE_NAME, PREFIX, ...counts });

  const delayedJobs = await queue.getDelayed(0, 10);
  if (delayedJobs.length) {
    console.log("Top delayed:", delayedJobs.map(j => ({
      id: j.id, name: j.name, delay: j.opts.delay, timestamp: j.timestamp, processedOn: j.processedOn
    })));
  }

  await queue.close();
  await connection.quit();
}

main().catch(e => { console.error(e); process.exit(1); });