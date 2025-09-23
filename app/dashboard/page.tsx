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

export default function DashboardPage() {
  const { data: session } = useSession();
  const signedIn = !!session;

  const [duration, setDuration] = useState<Duration>(30);
  const [text, setText] = useState("");
  const cap = useMemo(() => PRO_CAPS[duration], [duration]);

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

      <section className="mx-auto w-full px-6 md:px-8 pt-10 pb-20">
        <div className="mx-auto max-w-5xl">
          {/* Animated heading like landing */}
          <h1
            ref={ctaRef}
            className={`text-center text-4xl md:text-5xl font-extrabold mb-8 drop-shadow transition-all duration-500 ${
              ctaIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            Ready to Drip Text?
          </h1>

          {/* Card copied to match landing styles */}
          <div
            className="relative rounded-3xl border border-white/20 bg-white/80 backdrop-blur-sm shadow-lg p-6 transform-gpu transition-transform duration-400 ease-out hover:shadow-xl"
            style={{ willChange: "transform" }}
          >
            <h2 className="text-2xl font-bold mb-4 text-black text-left">Try it Now for Free</h2>

            {/* Duration pills - all unlocked except custom "+" */}
            <div>
              <div className="text-sm font-semibold text-black">Total Duration</div>
              <p className="text-sm text-black/70 mt-1">
                Choose how long it will take for your pasted text to finish dripping into your Google Doc.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {DURATIONS.map((opt) => (
                  <label key={opt.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value={opt.value}
                      checked={duration === opt.value}
                      onChange={() => setDuration(opt.value)}
                      className="peer sr-only"
                    />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 text-black/80 backdrop-blur-sm px-4 py-2 shadow-sm transition peer-checked:bg-black peer-checked:text-white peer-checked:border-black/0">
                      {opt.label}
                    </span>
                  </label>
                ))}

                {/* Custom (disabled for now) */}
                <label className="group relative cursor-not-allowed opacity-60">
                  <input type="radio" name="duration" disabled className="sr-only" />
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                    +
                  </span>
                  <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                    Custom (soon)
                  </span>
                </label>
              </div>
            </div>

            {/* Textarea + counters */}
            <div className="mt-5">
              <label htmlFor="prompt" className="sr-only">
                Paste your text here…
              </label>
              <textarea
                id="prompt"
                disabled={!signedIn}
                value={text}
                onChange={(e) => handleChange(e.target.value)}
                className={`w-full h-96 rounded-xl border bg-white text-black p-4 resize-none focus:outline-none focus:ring-2 transform-gpu transition-transform duration-200 ease-out ${
                  over ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-pink-300"
                }`}
                placeholder="Paste your text here..."
              />

              {/* Word count + pro note */}
              <div className={`mt-2 text-xs ${over ? "text-red-500" : "text-black/70"}`}>
                {words}/{cap} words {over && "• You’re over the suggested limit for this duration."}
              </div>
              <div className="mt-1 text-xs italic text-black/60">
                {PRO_CAPS[duration].toLocaleString()} words with Pro / Day Pass
              </div>
            </div>

            {/* Actions (solid fills) */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={!signedIn}
                className="rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Start Dripping (mock)
              </button>
              <button
                type="button"
                disabled={!signedIn}
                className="rounded-full bg-white text-black px-5 py-2 text-sm font-semibold border border-black/10 hover:bg-black/5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Connect Google Doc
              </button>
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
        </div>
      </section>
    </main>
  );
}