export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createDocForUser } from "@/lib/google";

export async function POST() {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.userId as string | undefined;
    if (!session || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const docId = await createDocForUser(userId, "Dripwriter Draft");
    return NextResponse.json({
      docId,
      url: `https://docs.google.com/document/d/${docId}/edit`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Failed to create doc" },
      { status: 500 }
    );
  }
}