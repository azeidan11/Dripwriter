import { enqueueDrip } from "../lib/queue";

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error("Usage: npx tsx scripts/enqueue-test.ts <sessionId>");
    process.exit(1);
  }
  const job = await enqueueDrip({ sessionId }, { delay: 500, jobId: `${sessionId}-manual` });
  console.log("[enqueue-test] enqueued", job.id);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });