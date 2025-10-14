// scripts/fix-session.ts
import { prisma } from "../lib/db";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npx tsx scripts/fix-session.ts <sessionId>");
    process.exit(1);
  }

  const s = await prisma.dripSession.update({
    where: { id },
    data: {
      status: "RUNNING",
      nextAt: new Date(Date.now() - 1000), // force eligible now
      lastError: null,
    },
    select: { id: true, status: true, nextAt: true, doneWords: true, totalWords: true },
  });

  console.log("[fix-session] updated:", s);
  process.exit(0);
}
main().catch((e)=>{ console.error(e); process.exit(1); });