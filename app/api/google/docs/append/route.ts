import { NextResponse } from "next/server";
import { getOAuthFromSession, appendAtEnd } from "@/lib/google";

export async function POST(req: Request) {
  try {
    const { docId, text } = await req.json();
    if (!docId || typeof text !== "string") {
      return NextResponse.json(
        { error: "docId and text required" },
        { status: 400 }
      );
    }

    const oAuth = await getOAuthFromSession();
    await appendAtEnd(oAuth, docId, text);    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Append failed" },
      { status: 401 }
    );
  }
}