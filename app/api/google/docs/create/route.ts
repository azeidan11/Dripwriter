import { NextResponse } from "next/server";
import { getOAuthFromSession, createDoc } from "@/lib/google";

export async function POST() {
  try {
    const oAuth = await getOAuthFromSession();
    const docId = await createDoc(oAuth, "Dripwriter Draft");
    return NextResponse.json({
      docId,
      url: `https://docs.google.com/document/d/${docId}/edit`,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Failed to create doc" },
      { status: 401 }
    );
  }
}