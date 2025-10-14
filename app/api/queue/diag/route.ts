// app/api/queue/diag/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { enqueueDrip, pingQueue, QUEUE_NAME } from "@/lib/queue";

export async function GET() {
  try {
    // prove Redis connectivity from this lambda
    const ping = await pingQueue().catch((e: any) => `ERR: ${e?.message || String(e)}`);
    // enqueue a dummy job (sessionId obviously won’t exist – that’s fine)
    const job = await enqueueDrip({ sessionId: "DIAG-NOOP" }, { delay: 100 });
    return NextResponse.json({
      ok: true,
      ping,               // expect "PONG"
      queue: QUEUE_NAME,  // which queue we are targeting
      enqueuedJobId: job.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}