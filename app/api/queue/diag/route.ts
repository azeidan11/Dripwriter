// app/api/queue/diag/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { enqueueDrip, describeQueue } from "@/lib/queue";

export async function GET() {
  try {
    const info = describeQueue();
    // enqueue a dummy job (sessionId obviously won’t exist – that’s fine)
    const job = await enqueueDrip({ sessionId: "DIAG-NOOP" }, { delay: 100 });
    return NextResponse.json({ ok: true, info, enqueuedJobId: job.id });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 }
    );
  }
}