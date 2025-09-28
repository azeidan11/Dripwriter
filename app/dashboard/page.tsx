"use client";

// app/dashboard/page.tsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

type Duration = 30 | 60 | 120 | 360 | 720 | 1440 | 4320 | 10080;

const DURATIONS: { label: string; value: Duration }[] = [
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "2 hrs", value: 120 },
  { label: "6 hrs", value: 360 },
  { label: "12 hrs", value: 720 },
  { label: "1 day", value: 1440 },
  { label: "3 days", value: 4320 },
  { label: "1 week", value: 10080 },
];
const PRO_CAPS: Record<Duration, number> = {
  30: 2000,
  60: 2500,
  120: 3500,
  360: 4000,
  720: 5000,
  1440: 6000,
  4320: 8000,
  10080: 10000,
};

const STARTER_CAPS: Record<Duration, number> = {
  30: 1500,
  60: 2000,
  120: 2500,
  360: 3500,
  720: 4000,
  1440: 5000,
  4320: 0,     // locked in Starter
  10080: 0,    // locked in Starter
};

type Plan = "dev" | "free" | "starter" | "pro" | "daypass";

// For development we keep everything unlocked.
// Later, read this from the signed-in user's session.
const PLAN: Plan = "dev";

const FREE_CAPS: Record<Duration, number> = {
  30: 1000,
  60: 1500,
  120: 0,
  360: 0,
  720: 0,
  1440: 0,
  4320: 0,
  10080: 0,
};

const CAPS_BY_PLAN: Record<Plan, Record<Duration, number>> = {
  dev: PRO_CAPS,
  pro: PRO_CAPS,
  daypass: PRO_CAPS,
  starter: STARTER_CAPS,
  free: FREE_CAPS,
};

// --- Duration helpers ---
function durationLabel(v: Duration) {
  const m = DURATIONS.find(d => d.value === v)?.label || `${v} min`;
  return m;
}

function nextDurationSuggestion(words: number, plan: Plan, current: Duration): Duration | null {
  const durationsAsc = [...DURATIONS.map(d=>d.value)].sort((a,b)=>a-b) as Duration[];
  const needed = Math.ceil(words * 1.1);
  for (const d of durationsAsc) {
    if (d <= current) continue; // only suggest longer than current
    if (CAPS_BY_PLAN[plan][d] >= needed) return d;
  }
  return null;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const signedIn = !!session;

  // Normalize PLAN for UI (treat dev as pro for display)
  const effectivePlan: Plan = PLAN === "dev" ? "pro" : PLAN;
  const planDisplay =
    effectivePlan === "free"
      ? "Free Plan"
      : effectivePlan === "starter"
      ? "Starter Plan"
      : effectivePlan === "pro"
      ? "Pro Plan"
      : effectivePlan === "daypass"
      ? "Day Pass"
      : String(effectivePlan);

  const upgradeCta =
    effectivePlan === "free"
      ? "Upgrade Now"
      : effectivePlan === "starter"
      ? "Upgrade to Pro"
      : effectivePlan === "pro"
      ? "Browse Plans"
      : "Browse Plans";

  // Range copy for How It Works — Step 2
  const planMaxLabel =
    effectivePlan === "free"
      ? "1 hr"
      : effectivePlan === "starter"
      ? "1 day"
      : "1 week"; // pro & daypass fall into "1 week"
  const planRangeText = `30 mins up to ${planMaxLabel}`;

  const comingSoon = PLAN !== "dev";

  const [duration, setDuration] = useState<Duration>(30);
  const [text, setText] = useState("");
  // Cursor-following tooltips for coming-soon sidebar items
  const [uploadTip, setUploadTip] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [scanTip, setScanTip] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const [recentTip, setRecentTip] = useState<{ x: number; y: number; show: boolean }>({ x: 0, y: 0, show: false });
  const cap = useMemo(() => CAPS_BY_PLAN[PLAN][duration], [duration]);

  // --- Google Doc connect (no DB) ---
  const [docId, setDocId] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docInput, setDocInput] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [appending, setAppending] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [docInputOpen, setDocInputOpen] = useState(false);
  const [usedDocLocked, setUsedDocLocked] = useState(false);

  // Accepts full URL or raw ID
  function parseDocId(input: string): string | null {
    const raw = input.trim();
    if (!raw) return null;
    // Raw ID (common Google Doc IDs are 20+ URL-safe chars)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(raw) && !raw.includes("http")) return raw;
    // Typical URL formats
    const m = raw.match(/\/document\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  }

  async function handleCreateDoc() {
    try {
      setConnecting(true);
      setConnectError(null);
      const res = await fetch("/api/google/docs/create", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create doc");
      setDocId(data.docId);
      setDocUrl(data.url);
    } catch (e: any) {
      setConnectError(e.message || "Could not create doc");
    } finally {
      setConnecting(false);
    }
  }

  async function handleUseExistingDoc() {
    setConnectError(null);
    const id = parseDocId(docInput);
    if (!id) {
      setConnectError("Paste a valid Google Doc link or ID");
      return;
    }
    setDocId(id);
    setDocUrl(`https://docs.google.com/document/d/${id}/edit`);
    setUsedDocLocked(true);
  }

  async function appendOnce(textChunk: string) {
    if (!docId) {
      setConnectError("Connect or create a Google Doc first");
      return;
    }
    try {
      setAppending(true);
      const res = await fetch("/api/google/docs/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, text: textChunk })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Append failed");
    } catch (e: any) {
      setConnectError(e.message || "Append failed");
    } finally {
      setAppending(false);
    }
  }

  // --- Client-side drip MVP (no DB/worker yet) ---
  type DripStatus = "idle" | "running" | "paused" | "done";
  const [dripStatus, setDripStatus] = useState<DripStatus>("idle");
  const statusRef = useRef<DripStatus>("idle");
  useEffect(() => {
    statusRef.current = dripStatus;
  }, [dripStatus]);
  const [dripProgress, setDripProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const idxRef = useRef<number>(0);
  const tokensRef = useRef<string[]>([]);  // includes words and whitespace tokens (\n, spaces)
  const totalWordsRef = useRef<number>(0); // count of non-whitespace tokens
  const doneWordsRef = useRef<number>(0);  // how many word tokens have been appended
  const totalMsRef = useRef<number>(0);
  const startAtRef = useRef<number>(0);
  const endsAtRef = useRef<number>(0);
  const tickMs = 2000; // ~2s per tick
  // Cadence tuning: pauses + catch-up bursts
  const basePauseProb = 0.12;       // ~12% chance to pause on a tick
  const lookaheadTicksBase = 8;      // allow catching up to ~16s ahead
  const maxBurstBase = 12;           // normal per-tick upper bound (words)
  const maxBurstCatchup = 28;        // when behind and need to catch up
  // Long/medium nap scheduling (for visible variability)
  const napRef = useRef<number>(0); // epoch ms; if now < napRef.current, we skip appending
  const longNapChance = 0.05;       // 5% chance to schedule a long nap when we can afford it
  const mediumNapChance = 0.15;     // 15% chance to schedule a medium nap when we can afford it
  const longNapRange: [number, number] = [60_000, 180_000];   // 1–3 minutes
  const mediumNapRange: [number, number] = [15_000, 45_000];  // 15–45 seconds

  function scheduleNap(range: [number, number]) {
    const [min, max] = range;
    const dur = Math.floor(Math.random() * (max - min + 1)) + min;
    napRef.current = Date.now() + dur;
  }
  const [timeLeftMs, setTimeLeftMs] = useState<number>(0);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function computeTicks(durationMinutes: number) {
    return Math.max(1, Math.round((durationMinutes * 60) / (tickMs / 1000)));
  }

  function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async function tickOnce() {
    if (statusRef.current !== "running") return;

    const totalWords = totalWordsRef.current;
    const doneWords = doneWordsRef.current;
    if (doneWords >= totalWords) {
      setDripStatus("done");
      stopTimer();
      return;
    }

    const now = Date.now();
    const elapsed = now - startAtRef.current;
    const total = Math.max(1, totalMsRef.current);

    // If we're in a scheduled nap window, just update progress/ETA and bail
    if (napRef.current && now < napRef.current) {
      setDripProgress({ done: doneWordsRef.current, total: totalWords });
      return;
    }

    // Compute remaining time & ticks
    const remainingMs = Math.max(0, endsAtRef.current - now);
    const remainingTicks = Math.max(1, Math.round(remainingMs / tickMs));

    // Targets
    const currentTarget = Math.floor(totalWords * Math.min(1, elapsed / total));
    const nextTarget = Math.floor(totalWords * Math.min(1, (elapsed + tickMs) / total));

    // Adaptive lookahead window (bigger when we have time, smaller near the end)
    const lookaheadTicks = Math.min(remainingTicks, lookaheadTicksBase);
    const futureTarget = Math.floor(
      totalWords * Math.min(1, (elapsed + lookaheadTicks * tickMs) / total)
    );

    const remainingWords = totalWords - doneWords;
    const backlog = Math.max(0, currentTarget - doneWords);

    // Decide whether we can afford a nap (ensure we can still finish with catch-up caps)
    const maxPerTickNormal = maxBurstBase;
    const maxPerTickCatchup = maxBurstCatchup;
    const maxPossibleNoNap = remainingTicks * maxPerTickCatchup;
    const canAffordAnyNap = remainingWords <= maxPossibleNoNap;

    // On some ticks, schedule a longer nap *if we can afford it*
    if (canAffordAnyNap && doneWords > 0) {
      // Prefer long naps earlier in the run, medium naps later
      const elapsedPct = elapsed / total;
      const tryLong = Math.random() < longNapChance * (1 - elapsedPct); // more likely early
      const tryMedium = Math.random() < mediumNapChance * (0.5 + 0.5 * elapsedPct); // more likely mid/late
      if (tryLong) {
        scheduleNap(longNapRange);
        setDripProgress({ done: doneWordsRef.current, total: totalWords });
        return;
      }
      if (tryMedium) {
        scheduleNap(mediumNapRange);
        setDripProgress({ done: doneWordsRef.current, total: totalWords });
        return;
      }
    }

    // Base desired increment: don't exceed a limited future target so we can catch up after naps
    let toAddTarget = Math.max(0, futureTarget - doneWords);

    // Ensure we at least meet the next tick's schedule
    const minToMeetNext = Math.max(0, nextTarget - doneWords);

    // Visible start guarantee
    if (doneWords === 0) {
      const firstBurst = Math.max(1, Math.min(12, totalWords));
      toAddTarget = Math.max(toAddTarget, firstBurst);
    }

    // If we're at or above current target, allow aiming toward next target
    if (toAddTarget < minToMeetNext) toAddTarget = minToMeetNext;

    // If we're very close to deadline, guarantee finish: dump remaining words on the last tick
    if (remainingTicks <= 1) {
      toAddTarget = remainingWords;
    }

    // Jitter +/- 2 words
    let toAdd = toAddTarget + (Math.floor(Math.random() * 5) - 2);
    if (toAdd < 0) toAdd = 0;

    // Cap bursts depending on whether we're catching up significantly
    const capacityNormal = remainingTicks * maxPerTickNormal;
    const isCatchingUp = backlog > 0 || remainingWords > capacityNormal;

    const cap = isCatchingUp ? maxPerTickCatchup : maxPerTickNormal;
    if (toAdd > cap) toAdd = cap;

    if (toAdd === 0) {
      setDripProgress({ done: doneWordsRef.current, total: totalWords });
      return;
    }

    // Build token slice preserving whitespace/newlines; count only non-whitespace tokens as words
    const tokens = tokensRef.current;
    let endIdx = idxRef.current;
    let remaining = toAdd;
    let appendedWordCount = 0;
    while (endIdx < tokens.length && remaining > 0) {
      if (/\S/.test(tokens[endIdx])) {
        remaining -= 1;
        appendedWordCount += 1;
      }
      endIdx += 1;
    }

    if (endIdx <= idxRef.current || appendedWordCount === 0) {
      setDripProgress({ done: doneWordsRef.current, total: totalWords });
      return;
    }

    const chunkText = tokens.slice(idxRef.current, endIdx).join("");

    try {
      await appendOnce(chunkText);
      idxRef.current = endIdx;
      doneWordsRef.current = Math.min(totalWords, doneWordsRef.current + appendedWordCount);
      setDripProgress({ done: doneWordsRef.current, total: totalWords });

      if (doneWordsRef.current >= totalWords) {
        setDripStatus("done");
        stopTimer();
      }
    } catch (e) {
      setConnectError((e as any)?.message || "Append failed during drip");
      setDripStatus("paused");
      stopTimer();
    }
  }

  function startClientDrip() {
    if (!signedIn) {
      setConnectError("Sign in first");
      return;
    }
    if (!docId) {
      setConnectError("Connect or create a Google Doc first");
      return;
    }
    const textTrim = text.trim();
    if (!textTrim) {
      setConnectError("Paste some text to drip");
      return;
    }
    const normalized = textTrim.replace(/\r\n/g, "\n");
    const tokens = normalized.match(/\S+|\s+/g) || []; // words OR whitespace
    tokensRef.current = tokens;
    totalWordsRef.current = tokens.filter((t) => /\S/.test(t)).length; // only non-whitespace
    doneWordsRef.current = 0;

    idxRef.current = 0;
    setDripProgress({ done: 0, total: totalWordsRef.current });

    const totalTicks = computeTicks(duration);
    const totalMs = totalTicks * tickMs;
    totalMsRef.current = totalMs;
    startAtRef.current = Date.now();
    endsAtRef.current = startAtRef.current + totalMs;

    napRef.current = 0; // clear any scheduled nap
    setDripStatus("running");
    stopTimer();
    // Kick the first tick on next macrotask to avoid stale state
    setTimeout(() => {
      tickOnce();
      timerRef.current = setInterval(tickOnce, tickMs);
    }, 0);
  }

  function pauseClientDrip() {
    if (dripStatus !== "running") return;
    setDripStatus("paused");
    stopTimer();
  }

  function resumeClientDrip() {
    if (dripStatus !== "paused") return;
    // Recalculate endsAt to preserve remaining duration proportionally
    const { done, total } = dripProgress;
    const remainingFraction = total > 0 ? (total - done) / total : 0;
    const totalTicks = computeTicks(duration);
    const remainingTicks = Math.max(1, Math.round(totalTicks * remainingFraction));
    endsAtRef.current = Date.now() + remainingTicks * tickMs;
    setDripStatus("running");
    stopTimer();
    timerRef.current = setInterval(tickOnce, tickMs);
  }

  function resetToIdle() {
    setDripStatus("idle");
    stopTimer();
    napRef.current = 0;
    idxRef.current = 0;
    tokensRef.current = [];
    totalWordsRef.current = 0;
    doneWordsRef.current = 0;
    setDripProgress({ done: 0, total: 0 });
    // Reset doc selection UI but keep the user's text in the textarea
    setDocId(null);
    setDocUrl(null);
    setDocInput("");
    setDocInputOpen(false);
    setUsedDocLocked(false);
  }

  function cancelClientDrip() {
    resetToIdle();
  }

  useEffect(() => () => stopTimer(), []);
  useEffect(() => {
    if (dripStatus !== "running") return;
    setTimeLeftMs(Math.max(0, endsAtRef.current - Date.now()));
    const id = setInterval(() => {
      setTimeLeftMs(Math.max(0, endsAtRef.current - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [dripStatus]);

  const words = useMemo(() => {
    const trimmed = text.trim();
    return trimmed.length ? trimmed.split(/\s+/).length : 0;
  }, [text]);

  const over = words > cap;

  function handleChange(v: string) {
    const parts = v.trim().split(/\s+/).filter(Boolean);
    if (parts.length > cap) {
      // hard cap at current plan limit, preserving trailing space if user keeps typing
      const limited = parts.slice(0, cap).join(" ");
      const keepSpace = v.endsWith(" ");
      setText(limited + (keepSpace ? " " : ""));
    } else {
      setText(v);
    }
  }

  // Optional subtle entrance like landing headline
  const ctaRef = useRef<HTMLHeadingElement | null>(null);
  const [ctaIn, setCtaIn] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCtaIn(true)),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <main className="min-h-screen text-white">
      {/* exact landing background */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#e38db7] to-[#b35c8f]" />

      <section className="relative mx-auto w-full px-6 md:px-8 pt-10 pb-20 lg:pl-[255px]">
        {/* Fixed left dashboard rail */}
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[239px] select-none">
          <nav className="flex-1 px-4 py-6 flex flex-col">
            <div>
              <div className="text-white font-extrabold drop-shadow mb-4 text-2xl md:text-3xl">Dripwriter</div>
              <div className="ml-[-16px] w-[239px] my-6 h-px bg-black/10" />
              <ul className="mt-1 space-y-2 text-white/90">
                  <li>
                    <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer -mt-3">
                      {/* Insert Text icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                        <rect x="3" y="3" width="18" height="14" rx="2" />
                        <path d="M7 7h10" />
                        <path d="M7 11h6" />
                        <path d="M5 21h14" />
                      </svg>
                      <span className="truncate">Insert Text</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </li>
                  <li>
                    {comingSoon ? (
                      <div
                        className="relative cursor-not-allowed opacity-60 select-none"
                        aria-disabled="true"
                        onMouseEnter={() => setUploadTip((t) => ({ ...t, show: true }))}
                        onMouseLeave={() => setUploadTip({ x: 0, y: 0, show: false })}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          setUploadTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
                        }}
                      >
                        <button type="button" disabled className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 cursor-not-allowed select-none">
                          {/* Upload icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" x2="12" y1="3" y2="15" />
                          </svg>
                          <span className="truncate">Upload File</span>
                        </button>
                        {uploadTip.show && (
                          <span
                            className="pointer-events-none absolute z-50 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg"
                            style={{ left: uploadTip.x + 8, top: uploadTip.y + 18 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                              <circle cx="12" cy="12" r="9" />
                              <path d="m15 9-6 6" />
                            </svg>
                            <span>Coming soon...</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                        {/* Upload icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" x2="12" y1="3" y2="15" />
                        </svg>
                        <span className="truncate">Upload File</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    )}
                  </li>
                  <li>
                    {comingSoon ? (
                      <div
                        className="relative cursor-not-allowed opacity-60 select-none"
                        aria-disabled="true"
                        onMouseEnter={() => setScanTip((t) => ({ ...t, show: true }))}
                        onMouseLeave={() => setScanTip({ x: 0, y: 0, show: false })}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          setScanTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
                        }}
                      >
                        <button type="button" disabled className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 cursor-not-allowed select-none">
                          {/* Scan icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                            <rect x="7" y="8" width="10" height="8" rx="2" />
                          </svg>
                          <span className="truncate">Text Scan</span>
                        </button>
                        {scanTip.show && (
                          <span
                            className="pointer-events-none absolute z-50 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg"
                            style={{ left: scanTip.x + 8, top: scanTip.y + 18 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                              <circle cx="12" cy="12" r="9" />
                              <path d="m15 9-6 6" />
                            </svg>
                            <span>Coming soon...</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                        {/* Scan icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                          <rect x="7" y="8" width="10" height="8" rx="2" />
                        </svg>
                        <span className="truncate">Text Scan</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    )}
                  </li>
                  <li>
                    {comingSoon ? (
                      <div
                        className="relative cursor-not-allowed opacity-60 select-none"
                        aria-disabled="true"
                        onMouseEnter={() => setRecentTip((t) => ({ ...t, show: true }))}
                        onMouseLeave={() => setRecentTip({ x: 0, y: 0, show: false })}
                        onMouseMove={(e) => {
                          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                          setRecentTip({ x: e.clientX - rect.left, y: e.clientY - rect.top, show: true });
                        }}
                      >
                        <button type="button" disabled className="w-[215px] h-10 text-left rounded-lg px-3 text-base flex items-center gap-2 cursor-not-allowed select-none">
                          {/* Recent/History icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                            <path d="M3 3v5h5" />
                            <path d="M3.05 13A9 9 0 1 0 8 3.46" />
                            <path d="M12 7v5l3 3" />
                          </svg>
                          <span className="truncate">Recent Drips</span>
                        </button>
                        {recentTip.show && (
                          <span
                            className="pointer-events-none absolute z-50 inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg"
                            style={{ left: recentTip.x + 8, top: recentTip.y + 18 }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                              <circle cx="12" cy="12" r="9" />
                              <path d="m15 9-6 6" />
                            </svg>
                            <span>Coming soon...</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                        {/* Recent/History icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                          <path d="M3 3v5h5" />
                          <path d="M3.05 13A9 9 0 1 0 8 3.46" />
                          <path d="M12 7v5l3 3" />
                        </svg>
                        <span className="truncate">Recent Drips</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    )}
                  </li>
                  <li>
                    <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                      {/* Rocket icon */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                      </svg>
                      <span className="truncate">Upgrade</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </li>
                </ul>
              </div>
            <div className="mt-auto pt-2">
              {/* Top line for the bottom block */}
              <div className="ml-[-16px] w-[239px] h-px bg-black/10" />

              {/* Quick Links now lives in the bottom block */}
              <div className="mt-3 text-xs uppercase tracking-wide text-white/70">Quick Links</div>
              <ul className="mt-2 space-y-2 text-white/90">
                <li>
                  <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                    {/* File/Text icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      <path d="M10 9H8" />
                      <path d="M16 13H8" />
                      <path d="M16 17H8" />
                    </svg>
                    <span className="truncate">Changelog</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </li>
                <li>
                  <button className="group w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 text-base flex items-center gap-2 cursor-pointer">
                    {/* Feedback/Message icon */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 flex-shrink-0">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="truncate">Feedback</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </li>
              </ul>

              {/* SINGLE shared separator between Quick Links and My Account */}
              <div className="ml-[-16px] w-[239px] my-3 h-px bg-black/10" />

              {/* My Account */}
              <button className="w-[215px] h-10 text-left rounded-lg px-3 hover:bg-white/10 flex items-center gap-3 text-white/90 cursor-pointer">
                {/* Left icon: account circle */}
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"></circle>
                  <circle cx="12" cy="9.5" r="3"></circle>
                  <path d="M6.5 18a7 7 0 0 1 11 0"></path>
                </svg>
                <span className="leading-tight">
                  <span className="block text-white font-medium -mb-0.5">My Account</span>
                  <span className="block text-white/70 text-xs mt-0.5">{planDisplay}</span>
                </span>
                {/* Always-visible right chevron */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>

              {/* Separator below My Account */}
              <div className="ml-[-16px] w-[239px] my-3 h-px bg-black/10" />

              {/* Upgrade pinned at the very bottom */}
              <button className="w-[215px] h-12 mx-auto block inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-lg shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 bg-white hover:bg-white/80 text-black px-4 mt-2 cursor-pointer">
                {/* Left icon: arrow-up inside a circle */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"></circle>
                  <path d="M12 16V8"></path>
                  <path d="m8.5 11.5 3.5-3.5 3.5 3.5"></path>
                </svg>
                <span>{upgradeCta}</span>
                {/* Right chevron */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </nav>
        </aside>

        {/* Fixed vertical divider to the right of the rail */}
        <div className="hidden lg:block fixed left-[239px] top-0 bottom-0 w-px bg-white/40" />

        <div className="px-6 lg:pl-8 lg:pr-4">
          {/* Animated heading like landing */}
          <h1
            ref={ctaRef}
            className={`text-left text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 lg:mb-6 drop-shadow transition-all duration-500 ${
              ctaIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            Insert Text
          </h1>

          {/* Card copied to match landing styles */}
          <div className="relative rounded-3xl border border-white/20 bg-white/80 backdrop-blur-sm shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-4 text-black text-left">Select Duration</h2>
            <p className="text-sm text-black/70 -mt-1 mb-3">Choose how long the drip will run.</p>

            {/* Duration pills - all unlocked except custom "+" */}
            <div>
              <div className="mt-1 flex flex-wrap gap-2 relative z-30">
                {DURATIONS.map((opt) => {
                  // Plan-based gating
                  let locked = false;
                  let tooltip = "";
                  if (PLAN === "free") {
                    locked = opt.value >= 120; // anything beyond 1 hr
                    tooltip = "Upgrade now";
                  } else if (PLAN === "starter") {
                    locked = opt.value === 4320 || opt.value === 10080; // lock 3 days & 1 week
                    tooltip = locked ? "Upgrade to Pro" : "";
                  }

                  if (locked) {
                    return (
                      <label key={opt.value} className="group relative cursor-not-allowed opacity-60 select-none" aria-disabled="true">
                        <input type="radio" name="duration" disabled className="sr-only" />
                        <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm cursor-not-allowed select-none">
                          {opt.label}
                        </span>
                        <span className="pointer-events-none absolute left-1/2 top-full z-50 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                          {tooltip || "Upgrade now"}
                        </span>
                      </label>
                    );
                  }

                  // Unlocked (clickable)
                  return (
                    <label key={opt.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="duration"
                        value={opt.value}
                        checked={duration === opt.value}
                        onChange={() => setDuration(opt.value)}
                        className="peer sr-only"
                      />
                      <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 text-black/80 backdrop-blur-sm px-4 py-2 shadow-sm transition cursor-pointer peer-checked:bg-black peer-checked:text-white peer-checked:border-black/0">
                        {opt.label}
                      </span>
                    </label>
                  );
                })}

                {/* Custom "+" pill: unlocked for dev, disabled for others */}
                {PLAN === "dev" ? (
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value="custom"
                      checked={false}
                      // Optionally, implement custom logic here for "+" selection
                      onChange={() => {/* Could show a modal or custom duration logic here */}}
                      className="peer sr-only"
                    />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 text-black/80 backdrop-blur-sm px-4 py-2 shadow-sm transition cursor-pointer peer-checked:bg-black peer-checked:text-white peer-checked:border-black/0">
                      +
                    </span>
                  </label>
                ) : (
                  <label className="group relative cursor-not-allowed opacity-60 select-none" aria-disabled="true">
                    <input type="radio" name="duration" disabled className="sr-only" />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm cursor-not-allowed select-none">
                      +
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-50 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white shadow-lg group-hover:block">
                      Upgrade now
                    </span>
                  </label>
                )}
              </div>
            </div>

            <div className="my-3 h-px w-full bg-black/10" />

            {/* Textarea + counters */}
            <div className="mt-5 relative z-10">
              <label htmlFor="prompt" className="sr-only">
                Paste your text here…
              </label>
              <textarea
                id="prompt"
                disabled={!signedIn}
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full h-[26rem] rounded-xl border bg-white text-black p-4 resize-none focus:outline-none focus:ring-2 transform-gpu transition-transform duration-200 ease-out ${
                  over ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-pink-300"
                }`}
                placeholder="Paste your text here..."
              />

              {/* Word count + pro note */}
              <div className={`mt-2 text-xs ${over ? "text-red-500" : "text-black/70"}`}>
                {words}/{cap} words {over && "• You’re over the suggested limit for this duration."}
              </div>
              {/* Guidance based on words vs duration (proportional thresholds) */}
              {words > 0 && (
                <div className="mt-1 text-xs text-black/70">
                  {(() => {
                    const shortThresh = Math.max(1, Math.floor(cap * 0.175)); // ~350 for 30min dev cap 2000
                    const heavyThresh = Math.max(1, Math.floor(cap * 0.325)); // ~650 for 30min dev cap 2000
                    if (words < shortThresh) {
                      return (
                        <span>
                          This is a short draft for {durationLabel(duration)} — it may complete noticeably sooner.
                        </span>
                      );
                    }
                    if (words >= heavyThresh) {
                      const sug = nextDurationSuggestion(words, PLAN, duration);
                      return (
                        <>
                          <span className="text-amber-700">That’s a lot of words for {durationLabel(duration)}.</span>{' '}
                          {sug && sug !== duration ? (
                            <span>We suggest {durationLabel(sug)} for a more relaxed drip.</span>
                          ) : null}
                        </>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              {PLAN === "free" && (
                <div className="mt-1 text-xs italic text-black/60">
                  {PRO_CAPS[duration].toLocaleString()} words with Pro / Day Pass
                </div>
              )}
              {PLAN === "starter" && (
                <div className="mt-1 text-xs italic text-black/60">
                  {PRO_CAPS[duration].toLocaleString()} words with Pro
                </div>
              )}
            </div>

            {/* Actions (connect + quick test) */}
            <div className="mt-6 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <button
                  type="button"
                  disabled={!signedIn || connecting}
                  onClick={handleCreateDoc}
                  className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {connecting ? "Creating…" : "Create New Google Doc"}
                </button>

                {/* Toggleable Doc URL input with left→right reveal */}
              <div className="flex-1 flex items-center gap-2">
                  {!docInputOpen ? (
                <button
                  type="button"
                  disabled={!signedIn}
                  onClick={() => { setDocInputOpen(true); setUsedDocLocked(false); }}
                      className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Use existing Google Doc
                </button>
                  ) : (
                    <div className={`flex-1 flex items-center gap-2 overflow-hidden transform-gpu origin-left transition-transform duration-500 ${docInputOpen ? 'scale-x-100' : 'scale-x-0'}`}>
                    <input
                      type="text"
                      value={docInput}
                      onChange={(e) => { setDocInput(e.target.value); setUsedDocLocked(false); }}
                      disabled={!signedIn || usedDocLocked}
                      placeholder="Paste Google Doc URL or ID"
                        className="cursor-text w-full rounded-full border border-black/10 bg-white/80 text-black px-4 py-2 text-sm placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={!signedIn || usedDocLocked}
                      onClick={handleUseExistingDoc}
                      className={`rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap ${usedDocLocked ? 'bg-black/30 text-white cursor-not-allowed' : 'bg-black text-white hover:bg-black/90 cursor-pointer'}`}
                    >
                      Use this Doc
                    </button>
                  </div>
                  )}
              </div>
              </div>

              {docUrl && (
                <div className="text-sm text-black/80 flex items-center gap-3">
                  <span className="inline-flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                      <path d="M9 12h6"/>
                      <path d="M12 9v6"/>
                    </svg>
                    <span className="font-medium">Connected Doc:</span>
                  </span>
                  <a href={docUrl} target="_blank" rel="noreferrer" className="underline">Open in Google Docs</a>
                  {docId && <span className="text-xs text-black/60">(ID: {docId})</span>}
                  {usedDocLocked && dripStatus === 'idle' && !docInputOpen && (
                    <button
                      type="button"
                      onClick={() => { setDocInputOpen(true); setUsedDocLocked(false); }}
                      className="underline text-black/80 hover:text-black cursor-pointer"
                    >
                      Edit Link
                    </button>
                  )}
                </div>
              )}

              {connectError && (
                <div className="text-sm text-red-600">{connectError}</div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                {dripStatus === "done" ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-4 py-2 text-sm font-semibold">
                      ✓ Complete
                    </span>
                    <button
                      type="button"
                      onClick={() => resetToIdle()}
                      className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5"
                    >
                      New drip?
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    {dripStatus === 'idle' && (
                      <>
                        <button
                          type="button"
                          disabled={!signedIn || !docId || !text.trim()}
                          onClick={startClientDrip}
                          className="cursor-pointer rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Start Dripping (client)
                        </button>
                        {/* Keep the single-shot append for debugging */}
                        <button
                          type="button"
                          disabled={!signedIn || !docId || appending || !text.trim()}
                          onClick={() => appendOnce(text.trim().split(/\s+/).slice(0, 12).join(" "))}
                          className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {appending ? "Appending…" : "Append once (test)"}
                        </button>
                      </>
                    )}

                    {dripStatus === 'running' && (
                      <>
                        <button
                          type="button"
                          onClick={pauseClientDrip}
                          className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5"
                        >
                          Pause
                        </button>
                        <button
                          type="button"
                          onClick={cancelClientDrip}
                          className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5"
                        >
                          Cancel
                        </button>
                      </>
                    )}

                    {dripStatus === 'paused' && (
                      <>
                        <button
                          type="button"
                          onClick={resumeClientDrip}
                          className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5"
                        >
                          Resume
                        </button>
                        <button
                          type="button"
                          onClick={cancelClientDrip}
                          className="cursor-pointer rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="text-xs text-black/70 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Status: <span className="font-semibold">{dripStatus}</span>
                  </span>
                  {dripProgress.total > 0 && (
                    <span>
                      {dripProgress.done}/{dripProgress.total} words (~{Math.round((dripProgress.done / Math.max(1, dripProgress.total)) * 100)}%)
                    </span>
                  )}
                  {dripStatus === "running" && (
                    <span>
                      • ETA: {Math.max(0, Math.ceil(timeLeftMs / 1000))}s left
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Signed-out overlay (locks the editor, identical placement) */}
            {!signedIn && (
              <div className="absolute -inset-2 z-10 grid place-items-center rounded-2xl bg-white/40 backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-black font-semibold">Sign in to start dripping</div>
                  <div className="text-black/70 text-sm mt-1">Connect your Google account to continue.</div>
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className="cursor-pointer mt-4 rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90"
                  >
                    Sign in with Google
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* How it works */}
          <section id="how" className="mt-10">
            <div className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md shadow-lg p-6 md:p-8">
              <h2 className="text-left text-3xl md:text-4xl font-extrabold mb-7 text-white drop-shadow">How It Works</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {/* Step 1 */}
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 text-center">
                  <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                    {/* Paste icon (updated path) */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 md:h-8 md:w-8 text-white/90">
                      <path d="M9 2a2 2 0 0 0-2 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6v-2H6V6h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6h1v4h2V6a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2H9Zm0 2h6v3H9V4Z"/>
                    </svg>
                  </div>
                  <div className="text-sm uppercase tracking-wide text-white/70">Step 1</div>
                  <h3 className="mt-1 text-xl font-bold text-white">Paste your draft</h3>
                  <p className="mt-2 text-white/80">Drop your text into the box or paste it from anywhere.</p>
                </div>

                {/* Step 2 */}
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 text-center">
                  <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                    {/* Duration/clock icon (stroke variant) */}
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 md:h-8 md:w-8 text-white">
                      <circle cx="12" cy="12" r="9" />
                      <line x1="12" y1="12" x2="12" y2="7" />
                      <line x1="12" y1="12" x2="15" y2="12" />
                    </svg>
                  </div>
                  <div className="text-sm uppercase tracking-wide text-white/70">Step 2</div>
                  <h3 className="mt-1 text-xl font-bold text-white">Pick a total duration</h3>
                  <p className="mt-2 text-white/80">{`Choose from ${planRangeText} for the drip to take place.`}</p>
                </div>

                {/* Step 3 */}
                <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 text-center">
                  <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                    {/* Google Doc icon (image) */}
                    <img
                      src="/google-docs.png"
                      alt="Google Docs Icon"
                      className="h-7 w-7 md:h-8 md:w-8 object-contain"
                    />
                  </div>
                  <div className="text-sm uppercase tracking-wide text-white/70">Step 3</div>
                  <h3 className="mt-1 text-xl font-bold text-white">Watch it drip into Docs</h3>
                  <p className="mt-2 text-white/80">We type it in on a schedule with natural edits and pauses.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}