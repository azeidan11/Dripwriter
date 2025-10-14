// scripts/redis-test.ts
import "dotenv/config";
import IORedis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("REDIS_URL is missing. Put the rediss:// URL (no quotes) in your .env");
}

(async () => {
  const redis = new IORedis(url, {
    // Upstash-friendly defaults
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // URL is rediss:// so it uses TLS; this avoids local cert issues
    tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
  });

  const pong = await redis.ping();
  console.log("PING ->", pong);
  await redis.quit();
})();