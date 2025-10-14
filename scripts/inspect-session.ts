// scripts/inspect-session.ts
import { prisma } from "../lib/db";

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("Usage: npx tsx scripts/inspect-session.ts <sessionId>");
    process.exit(1);
  }
  const s = await prisma.dripSession.findUnique({
    where: { id },
    select: {
      id: true, status: true, doneWords: true, totalWords: true,
      nextAt: true, userId: true, docId: true, lastError: true,
    },
  });
  console.log(JSON.stringify(s, null, 2));
  process.exit(0);
}
main().catch((e)=>{ console.error(e); process.exit(1); });