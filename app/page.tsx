"use client";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export default function Home() {
  const [duration, setDuration] = useState<30 | 60>(30); // minutes
  const [text, setText] = useState("");

  const { data: session } = useSession();
  const signedIn = !!session;

  const cap = duration === 30 ? 1200 : 1600; // adjust if you want different caps
  const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
  const over = words > cap;

  function handleChange(v: string) {
    const arr = v.trim().split(/\s+/).filter(Boolean);
    const tooMany = arr.length > cap;
    const kept = tooMany ? arr.slice(0, cap).join(" ") + (v.endsWith(" ") ? " " : "") : v;
    setText(kept);
  }
  return (
    <main className="min-h-screen text-white">
      {/* Background image + dark overlay for readability */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#e38db7] to-[#b35c8f]" />

      {/* Top nav (simple placeholder) */}
      <header className="mx-auto w-full px-6 md:px-8 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-white/10 backdrop-blur-sm grid place-items-center">
            <span className="text-sm font-semibold">DW</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Dripwriter</span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <a className="hover:text-white text-base" href="#features">Features</a>
          <a className="hover:text-white text-base" href="#pricing">Pricing</a>
          <a className="hover:text-white text-base" href="#faq">FAQ</a>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90 text-base"
          >
            Sign in
          </button>
        </nav>
        {/* Mobile actions */}
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
          >
            Sign in
          </button>
          {/* Mobile hamburger (full-screen glass overlay, left-aligned menu) */}
          <details className="mobmenu relative">
            <summary
              className="list-none select-none cursor-pointer text-white text-2xl leading-none"
              aria-label="Toggle menu"
            >
              <span className="open-icon block">☰</span>
              <span className="close-icon hidden">×</span>
            </summary>
            {/* Full-screen overlay panel */}
            <div className="fixed inset-0 z-50 bg-white/10 backdrop-blur-xl">
              <div className="h-full w-full flex">
                {/* Left-side stacked nav */}
                <nav className="w-3/4 max-w-xs bg-white/10 border-r border-white/15 p-6 text-white">
                  <div className="text-xs uppercase tracking-wider text-white/70 mb-4">Menu</div>
                  <a className="block text-lg font-semibold py-2 hover:text-white/80" href="#features">Features</a>
                  <a className="block text-lg font-semibold py-2 hover:text-white/80" href="#pricing">Pricing</a>
                  <a className="block text-lg font-semibold py-2 hover:text-white/80" href="#faq">FAQ</a>
                </nav>
                {/* Click-through area fills the rest; tap ×/☰ to close */}
                <div className="flex-1" />
              </div>
            </div>
            <style>{`
              details.mobmenu .close-icon { display: none; }
              details.mobmenu[open] .open-icon { display: none; }
              details.mobmenu[open] .close-icon { display: block; }
              details.mobmenu[open] summary {
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 60;
                background: rgba(255,255,255,0.08);
                backdrop-filter: blur(12px);
                border-radius: 9999px;
                padding: 0.25rem 0.5rem;
                line-height: 1;
              }
            `}</style>
          </details>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full px-6 md:px-8 pt-2 pb-16 md:pt-5 md:pb-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
          AI-powered • Human-paced
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Dripwriter
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-white/80 md:text-lg">
            Paste your text. Pick a duration. Watch it drip it into your Google Doc on your schedule.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-black/20 hover:bg-white/90"
            >
              Get started free
            </button>
            <a
              href="#demo"
              className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Demo box for your GIF */}
        <div id="demo" className="mx-auto mt-10 w-full max-w-5xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-2 md:p-3">
            <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl bg-black/50 ring-1 ring-white/10">
              <img
                src="/demo.gif"
                alt="Dripwriter demo"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Software Section */}
      <section className="mx-auto w-full px-6 md:px-8 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-white/20 bg-white/80 backdrop-blur-sm shadow-lg p-6 relative">
            <h2 className="text-2xl font-bold mb-4 text-black text-left">Try it Now for Free</h2>
            <div className="relative">
              {/* Overlay only over content below the heading */}
              {!signedIn && (
                <div className="absolute -inset-2 z-10 grid place-items-center rounded-2xl bg-white/40 backdrop-blur-sm">
                  <div className="text-center px-6">
                    <h3 className="text-black text-lg font-semibold">Sign in to continue</h3>
                    <p className="text-black/70 text-sm mt-1">Connect Google to unlock the editor.</p>
                    <button
                      onClick={() => signIn("google")}
                      className="mt-4 rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90"
                    >
                      Sign in with Google
                    </button>
                  </div>
                </div>
              )}
              {/* Duration toggles (controlled for cap logic) */}
              <div className="mb-4">
                <div className="text-base font-semibold text-black/80 mb-1">Total Duration</div>
                <p className="text-sm text-black/60 mb-3">
                  Choose how long it will take for your pasted text to finish dripping into your Google Doc.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {/* 30 min */}
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value="30"
                      className="peer sr-only"
                      defaultChecked
                      onChange={() => setDuration(30)}
                    />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 text-black/80 backdrop-blur-sm px-4 py-2 shadow-sm transition
                                     peer-checked:bg-black peer-checked:text-white peer-checked:border-black/0">
                      30 min
                    </span>
                  </label>
                  {/* 1 hr */}
                  <label className="cursor-pointer">
                    <input
                      type="radio"
                      name="duration"
                      value="60"
                      className="peer sr-only"
                      onChange={() => setDuration(60)}
                    />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 text-black/80 backdrop-blur-sm px-4 py-2 shadow-sm transition
                                     peer-checked:bg-black peer-checked:text-white peer-checked:border-black/0">
                      1 hr
                    </span>
                  </label>
                  {/* 2 hrs (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="120" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      2 hrs
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* 6 hrs (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="360" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      6 hrs
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* 12 hrs (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="720" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      12 hrs
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* 1 day (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="1440" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      1 day
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* 3 days (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="4320" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      3 days
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* 1 week (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="10080" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      1 week
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock
                    </span>
                  </label>
                  {/* More (locked) */}
                  <label className="group relative cursor-not-allowed opacity-60">
                    <input type="radio" name="duration" value="more" className="sr-only" disabled />
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/60 text-black/60 backdrop-blur-sm px-4 py-2 shadow-sm">
                      +
                    </span>
                    <span className="pointer-events-none absolute left-1/2 top-full z-10 hidden -translate-x-1/2 translate-y-2 whitespace-nowrap rounded-md bg-black px-2 py-1 text-xs text-white group-hover:block">
                      Upgrade to unlock more
                    </span>
                  </label>
                </div>
              </div>

              {/* Word-capped textarea with live count */}
              <div>
                <textarea
                  disabled={!signedIn}
                  value={text}
                  onChange={(e) => handleChange(e.target.value)}
                  className={`w-full h-96 rounded-xl border bg-white text-black p-4 resize-none focus:outline-none focus:ring-2 ${
                    over ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-pink-300"
                  } ${!signedIn ? "opacity-60" : ""}`}
                  placeholder="Paste your text here..."
                />
                <div className={`mt-2 text-xs ${over ? "text-red-500" : "text-black/70"}`}>
                  {words}/{cap} words
                  {over && <span className="ml-2">• You’ve hit the limit for this duration.</span>}
                </div>
                <div className="mt-1 text-xs italic text-black/60">
                  {duration === 30 ? "1,600+ words with Pro" : "2,000+ words with Pro"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full px-6 md:px-8 pb-10 text-sm text-white/60">
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Dripwriter. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#privacy" className="hover:text-white">Privacy</a>
            <a href="#terms" className="hover:text-white">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  );
}