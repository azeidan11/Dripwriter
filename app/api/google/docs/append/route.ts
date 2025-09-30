import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { google } from "googleapis";

// GET: return today's usage/cap so the UI can show remaining words
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string | undefined;
  const plan = ((session as any).plan as string | undefined) ?? "FREE";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const DAILY_CAPS: Record<string, number | null> = {
    FREE: 750,
    STARTER: null, // unlimited
    PRO: null,     // unlimited
    DAYPASS: null,
    DEV: null,
  };

  const cap = DAILY_CAPS[plan] ?? 0;

  // Use string key YYYY-MM-DD (UTC) to match Prisma model's `dateKey`
  const dateKey = new Date().toISOString().slice(0, 10);

  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
    select: { wordsUsed: true },
  });
  const used = usage?.wordsUsed ?? 0;

  if (cap === null) {
    return NextResponse.json({ plan, cap: null, remaining: null, used });
  }
  const remaining = Math.max(0, cap - used);
  return NextResponse.json({ plan, cap, remaining, used });
}

// POST: append text to Google Doc, enforcing Free plan daily cap with `dateKey`
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string | undefined;
  const plan = ((session as any).plan as string | undefined) ?? "FREE";
  const accessToken = (session as any).accessToken as string | undefined;

  if (!userId) return NextResponse.json({ error: "Unauthorized: no user id in session" }, { status: 401 });
  if (!accessToken) return NextResponse.json({ error: "No Google access token" }, { status: 401 });

  try {
    const { docId, text } = await req.json();
    if (!docId || typeof text !== "string") {
      return NextResponse.json({ error: "docId and text required" }, { status: 400 });
    }

    function countWords(str: string) {
      return (str.match(/\S+/g) || []).length;
    }

    function trimToWordLimit(str: string, limit: number) {
      if (limit <= 0) return "";
      const tokens = str.match(/\S+|\s+/g) || [];
      let out: string[] = [];
      let words = 0;
      for (const t of tokens) {
        if (/\S/.test(t)) {
          if (words >= limit) break;
          words++;
        }
        out.push(t);
      }
      return out.join("");
    }

    let allowedText = text;
    let appendedWords = countWords(allowedText);

    if (plan === "FREE") {
      const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const usage = await prisma.dailyUsage.findUnique({
        where: { userId_dateKey: { userId: userId!, dateKey } },
        select: { wordsUsed: true },
      });

      const used = usage?.wordsUsed ?? 0;
      const MAX = 750;
      const remainingBefore = Math.max(0, MAX - used);
      if (remainingBefore <= 0) {
        return NextResponse.json(
          { appended: 0, remaining: 0, error: "Daily word limit reached" },
          { status: 429 }
        );
      }

      if (appendedWords > remainingBefore) {
        allowedText = trimToWordLimit(allowedText, remainingBefore);
        appendedWords = countWords(allowedText);
      }
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const docs = google.docs({ version: "v1", auth });

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          { insertText: { endOfSegmentLocation: {}, text: allowedText } },
        ],
      },
    });

    if (plan === "FREE") {
      const dateKey = new Date().toISOString().slice(0, 10);

      await prisma.dailyUsage.upsert({
        where: { userId_dateKey: { userId: userId!, dateKey } },
        update: { wordsUsed: { increment: appendedWords } },
        create: { userId: userId!, dateKey, wordsUsed: appendedWords },
      });

      const row = await prisma.dailyUsage.findUnique({
        where: { userId_dateKey: { userId: userId!, dateKey } },
        select: { wordsUsed: true },
      });
      const MAX = 750;
      const remaining = Math.max(0, MAX - (row?.wordsUsed ?? 0));
      return NextResponse.json({ appended: appendedWords, remaining });
    }

    return NextResponse.json({ appended: appendedWords, remaining: null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Append failed" }, { status: 500 });
  }
}