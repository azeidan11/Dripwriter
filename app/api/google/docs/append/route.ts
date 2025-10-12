export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appendAtEndForUser } from "@/lib/google";

function dateKeyForTZ(tz?: string | null) {
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const d = parts.find(p => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`; // YYYY-MM-DD
  } catch {}
  return new Date().toISOString().slice(0, 10);
}

function isValidTZ(tz: string | null | undefined) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

// GET: return today's usage/cap so the UI can show remaining words
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string | undefined;
  const plan = ((session as any).plan as string | undefined) ?? "FREE";
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Optional tz param from client; if valid, persist on user
  try {
    const u = new URL(req.url);
    const tzParam = u.searchParams.get('tz');
    if (isValidTZ(tzParam)) {
      await prisma.user.update({ where: { id: userId }, data: { tz: tzParam! } });
    }
  } catch {}

  // Read (possibly updated) tz and compute local dateKey
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tz: true } });
  const dateKey = dateKeyForTZ(user?.tz);

  const DAILY_CAPS: Record<string, number | null> = {
    FREE: 750,
    STARTER: null,
    PRO: null,
    DAYPASS: null,
    DEV: null,
  };
  const cap = DAILY_CAPS[plan] ?? 0;

  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
    select: { wordsUsed: true },
  });
  const used = usage?.wordsUsed ?? 0;

  if (cap === null) {
    return NextResponse.json({ plan, cap: null, remaining: null, used, tz: user?.tz ?? null });
  }
  const remaining = Math.max(0, cap - used);
  return NextResponse.json({ plan, cap, remaining, used, tz: user?.tz ?? null });
}

// POST: append text to Google Doc, enforcing Free plan daily cap with `dateKey`
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session as any).userId as string | undefined;
  const plan = ((session as any).plan as string | undefined) ?? "FREE";

  if (!userId) return NextResponse.json({ error: "Unauthorized: no user id in session" }, { status: 401 });

  try {
    const { docId, text } = await req.json();
    if (!docId || typeof text !== "string") {
      return NextResponse.json({ error: "docId and text required" }, { status: 400 });
    }

    // Fetch user's timezone once and compute dateKey in their local day
    const userRow = await prisma.user.findUnique({ where: { id: userId }, select: { tz: true } });
    const dateKey = dateKeyForTZ(userRow?.tz);

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

    await appendAtEndForUser(userId!, docId, allowedText);

    if (plan === "FREE") {
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