"use client";
import { useState, useEffect, useRef } from "react";
import { useSession, signIn } from "next-auth/react";

export default function Home() {
  const [duration, setDuration] = useState<30 | 60>(30); // minutes
  const [text, setText] = useState("");
  const [demoInView, setDemoInView] = useState(false);
  const demoRef = useRef<HTMLDivElement | null>(null);
  // Problem/Outcome reveal states and ref
  const [whyLeftIn, setWhyLeftIn] = useState(false);
  const [whyRightIn, setWhyRightIn] = useState(false);
  const whySectionRef = useRef<HTMLDivElement | null>(null);
  // How it works (3 steps) reveal
  const [how1In, setHow1In] = useState(false);
  const [how2In, setHow2In] = useState(false);
  const [how3In, setHow3In] = useState(false);
  const howSectionRef = useRef<HTMLDivElement | null>(null);
  // FAQ stagger-in animation
  const [faqIn, setFaqIn] = useState(false);
  const faqSectionRef = useRef<HTMLDivElement | null>(null);
  // CTA ("Ready to Drip Text?") word-by-word reveal
  const [ctaIn, setCtaIn] = useState(false);
  const ctaRef = useRef<HTMLHeadingElement | null>(null);
  // Expand/collapse state for Problem/Outcome lists
  const [whyLeftExpanded, setWhyLeftExpanded] = useState(false);
  const [whyRightExpanded, setWhyRightExpanded] = useState(false);
  // Helper to toggle both panels at once
  const toggleWhyBoth = (expand: boolean) => {
    setWhyLeftExpanded(expand);
    setWhyRightExpanded(expand);
  };

  useEffect(() => {
    const el = demoRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setDemoInView(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate Problem/Outcome cards in when section enters viewport
  useEffect(() => {
    const el = whySectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setWhyLeftIn(true);
            // Stagger the right card slightly after the left
            setTimeout(() => setWhyRightIn(true), 120);
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate How-it-works cards with a left-to-right stagger
  useEffect(() => {
    const el = howSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setHow1In(true);
            setTimeout(() => setHow2In(true), 100);
            setTimeout(() => setHow3In(true), 200);
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.65 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Animate FAQ items with a stagger when FAQ scrolls into view
  useEffect(() => {
    const el = faqSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setFaqIn(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.45 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Trigger CTA word-by-word reveal when heading enters viewport
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setCtaIn(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px", threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Smooth FAQ expand/collapse using measured heights
  useEffect(() => {
    const faqRoot = document.getElementById("faq");
    if (!faqRoot) return;
    const items = Array.from(faqRoot.querySelectorAll<HTMLDetailsElement>("details.faq"));

    // Make the entire card clickable, except interactive elements/summary
    const onBoxClick = (ev: Event) => {
      const d = ev.currentTarget as HTMLDetailsElement;
      const target = ev.target as HTMLElement;
      // If the click originated inside the summary or on interactive elements, let default behavior occur
      if (target.closest('summary') || target.closest('a, button, input, textarea, select')) return;
      d.open = !d.open; // toggle; will fire our `toggle` listener below
    };

    // Initialize all answers to collapsed state
    items.forEach((d) => {
      const content = d.querySelector<HTMLElement>(".faq-content");
      if (content) {
        content.style.overflow = "hidden";
        content.style.maxHeight = d.open ? `${content.scrollHeight}px` : "0px";
      }
      d.addEventListener('click', onBoxClick);
    });

    const onToggle = (ev: Event) => {
      const d = ev.currentTarget as HTMLDetailsElement;
      const content = d.querySelector<HTMLElement>(".faq-content");
      if (!content) return;

      // Ensure we have the current full height
      const full = content.scrollHeight;
      content.style.overflow = "hidden";
      // Use consistent timing across browsers
      const heightMs = 600;
      const fadeMs = 450;
      content.style.transition = `max-height ${heightMs}ms ease, opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease`;

      if (d.open) {
        // Opening: from 0 to full, fade + slide in
        content.style.maxHeight = "0px";
        content.style.opacity = "0";
        content.style.transform = "translateY(-4px)";
        // Also fade children (answer text) every time on open
        const kids = Array.from(content.children) as HTMLElement[];
        kids.forEach((k) => {
          k.style.transition = 'opacity 420ms ease';
          k.style.opacity = '0';
        });
        // Force reflow so the transition starts from 0 each time
        void content.offsetHeight;
        requestAnimationFrame(() => {
          content.style.maxHeight = `${full}px`;
          content.style.opacity = "1";
          content.style.transform = "translateY(0)";
          kids.forEach((k) => {
            // force a reflow per child then fade to 1
            void k.offsetHeight;
            k.style.opacity = '1';
          });
        });
      } else {
        // Closing: set to current height, then go to 0
        content.style.maxHeight = `${full}px`;
        const kids = Array.from(content.children) as HTMLElement[];
        kids.forEach((k) => {
          k.style.transition = 'opacity 300ms ease';
          k.style.opacity = '0';
        });
        requestAnimationFrame(() => {
          content.style.maxHeight = "0px";
          content.style.opacity = "0";
          content.style.transform = "translateY(-4px)";
        });
      }
    };

    items.forEach((d) => d.addEventListener("toggle", onToggle));
    return () => items.forEach((d) => {
      d.removeEventListener("toggle", onToggle);
      d.removeEventListener("click", onBoxClick);
    });
  }, []);

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
      <div className="fixed inset-0 -z-10 bg-[#b35c8f]" />

      {/* Top nav (simple placeholder) */}
      <header className="mx-auto w-full px-6 md:px-8 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-white/10 backdrop-blur-sm grid place-items-center">
            <span className="text-sm font-semibold">DW</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Dripwriters</span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <a className="hover:text-white text-base" href="#features">Features</a>
          <a className="hover:text-white text-base" href="#pricing">Pricing</a>
          <a className="hover:text-white text-base" href="#faq">FAQ</a>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="cursor-pointer rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90 text-base"
          >
            Sign in
          </button>
        </nav>
        {/* Mobile actions */}
        <div className="md:hidden flex items-center gap-2">
          <button
            type="button"
            onClick={() => signIn("google")}
            className="cursor-pointer rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
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
      <section className="mx-auto w-full px-6 md:px-8 pt-20 pb-20 md:pt-28 md:pb-28 relative">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs uppercase tracking-wide text-white/70">
          AI-powered • Human-paced
          </span>
          <h1 className="mt-6 text-6xl font-extrabold leading-tight tracking-tight md:text-8xl">
            Dripwriter
          </h1>
          <p className="mx-auto mt-6 max-w-4xl text-white/85 text-xl md:text-3xl">
            Paste your text. Pick a duration. Watch it drip into your Google Doc on your schedule.
          </p>

          <div className="mt-10 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => signIn("google")}
              className="cursor-pointer rounded-full bg-white px-6 py-4 text-base font-semibold text-black shadow-lg shadow-black/20 hover:bg-white/90"
            >
              Get started free
            </button>
            <a
              href="#demo"
              className="rounded-full border border-white/20 bg-white/5 px-6 py-4 text-base font-semibold text-white hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* New centered arrow above the GIF */}
        <div className="mt-30 text-center">
          <span className="inline-block animate-bounce text-white text-5xl font-bold">↓</span>
        </div>
        {/* Testimonials - seamless marquee above GIF (no reset) */}
        <div className="mx-auto mt-10 w-full max-w-8xl">
          <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.15)] overflow-hidden glass-fade relative">
            <div className="w-full py-6">
              <div className="marquee-outer">
                <div className="marquee-inner">
              {/* group A */}
              <div className="marquee-group">
                <span className="testimonial-pill">“I’m literally writing essays… without writing. Hit start and it does the typing.”</span>
                <span className="testimonial-pill">“This is so clever — it even takes breaks mid‑way like I got distracted.”</span>
                <span className="testimonial-pill">“I can doomscroll and ‘write’ at the same time. Productivity unlocked.”</span>
                <span className="testimonial-pill">“Version history looks like a real person typed it. Chef’s kiss.”</span>
                <span className="testimonial-pill">“Finally can go make a snack while my draft ‘appears’ in Google Docs.”</span>
                <span className="testimonial-pill">“Picks a pace, groups sentences like paragraphs — feels human.”</span>
                <span className="testimonial-pill">“Set 1 hour, come back to a finished draft. Wild.”</span>
                <span className="testimonial-pill">“Looks like natural edits — starts, pauses, keeps going.”</span>
              </div>
              {/* group B (exact duplicate for seamless loop) */}
              <div className="marquee-group" aria-hidden="true">
                <span className="testimonial-pill">“I’m literally writing essays… without writing. Hit start and it does the typing.”</span>
                <span className="testimonial-pill">“This is so clever — it even takes breaks mid‑way like I got distracted.”</span>
                <span className="testimonial-pill">“I can doomscroll and ‘write’ at the same time. Productivity unlocked.”</span>
                <span className="testimonial-pill">“Version history looks like a real person typed it. Chef’s kiss.”</span>
                <span className="testimonial-pill">“Finally can go make a snack while my draft ‘appears’ in Google Docs.”</span>
                <span className="testimonial-pill">“Picks a pace, groups sentences like paragraphs — feels human.”</span>
                <span className="testimonial-pill">“Set 1 hour, come back to a finished draft. Wild.”</span>
                <span className="testimonial-pill">“Looks like natural edits — starts, pauses, keeps going.”</span>
              </div>
            </div>
          </div>

          <style jsx>{`
            @keyframes marquee {
              0%   { transform: translate3d(0,0,0); }
              100% { transform: translate3d(-50%,0,0); }
            }
            .marquee-outer {
              overflow: hidden;
              mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
              -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
            }
            .marquee-inner {
              display: flex;
              width: max-content; /* shrink-wrap contents */
              will-change: transform;
              backface-visibility: hidden;
              transform: translate3d(0,0,0);
              animation: marquee 60s linear infinite;
            }
            .marquee-group {
              display: flex;
              align-items: center;
              gap: 1rem;
              padding-right: 1rem; /* tiny buffer so copy boundaries don't collide */
            }
            @media (min-width: 768px) {
              .marquee-group { gap: 1.5rem; padding-right: 1.5rem; }
            }
            .testimonial-pill {
              display: inline-flex;
              align-items: center;
              white-space: nowrap;
              padding: 14px 18px; /* taller */
              border-radius: 9999px;
              border: 1px solid rgba(255,255,255,0.18);
              background: rgba(255,255,255,0.10);
              backdrop-filter: blur(6px);
              color: #fff;
              font-size: 15px; /* slightly larger */
              line-height: 1.2;
              box-shadow: 0 2px 8px rgba(0,0,0,0.18);
            }
            @media (min-width: 768px) {
              .testimonial-pill { font-size: 16px; padding: 16px 24px; }
            }
          `}</style>
          <style jsx global>{`
            .glass-fade {
              /* fade the left/right edges of the glass wrapper */
              mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
              -webkit-mask-image: linear-gradient(to right, transparent, black 3%, black 97%, transparent);
            }
          `}</style>
                </div>
              </div>
            </div>
        {/* Problem → Outcome (Why it exists) */}
        <section id="why" ref={whySectionRef} className="mx-auto w-full px-6 md:px-8 py-14 md:py-20">
          <div className="mx-auto w-full max-w-7xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              {/* Problem (left) */}
              <div className={`rounded-3xl p-6 md:p-8 border border-white/15 bg-gradient-to-br from-emerald-400/25 via-teal-400/20 to-sky-400/20 backdrop-blur-sm transform-gpu transition-all duration-250 md:duration-300 ease-out ${whyLeftIn ? 'opacity-100 translate-y-0 translate-x-0' : 'opacity-0 translate-y-2 -translate-x-3'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
                  Problem
                </div>
                <h3 className="mt-3 text-2xl md:text-3xl font-extrabold">Why copy–paste isn’t cutting it</h3>
                <div className="mt-4 relative">
                  <div
                    className={`overflow-hidden transition-[max-height] duration-500 ease-out ${whyLeftExpanded ? '' : 'pb-2'}`}
                    style={{ maxHeight: whyLeftExpanded ? '2000px' : '280px' }}
                  >
                    <ul className="space-y-3 text-white/85 md:text-lg">
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Dumping AI text into Docs looks like a single burst — not how people actually type.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[50px] md:min-h-[58px]">
                        <span className="mt-1">•</span>
                        <span>Version history feels unnatural when everything appears at once.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[54px] md:min-h-[62px] -mt-3">
                        <span className="mt-1">•</span>
                        <span>No human pacing — no pauses, no paragraph rhythm, just a wall of text.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>You’re stuck at the keyboard to make it look gradual.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Hard to pace long drafts — everything lands too fast or too slow.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Copy/paste juggling between tabs wastes time and breaks focus.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>No simple way to resume a session where you left off.</span>
                      </li>
                    </ul>
                  </div>
                  {!whyLeftExpanded ? (
                    <button
                      type="button"
                      onClick={() => toggleWhyBoth(true)}
                      className="mt-0 text-sm text-white/85 underline cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.05] hover:font-bold"
                    >
                      Read more
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleWhyBoth(false)}
                      className="mt-0 text-sm text-white/85 underline cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.05] hover:font-bold"
                    >
                      Collapse
                    </button>
                  )}
                </div>
              </div>

              {/* Outcome (right) */}
              <div className={`rounded-3xl p-6 md:p-8 border border-white/15 bg-gradient-to-br from-rose-500/25 via-fuchsia-500/20 to-purple-500/20 backdrop-blur-sm transform-gpu transition-all duration-250 md:duration-300 ease-out ${whyRightIn ? 'opacity-100 translate-y-0 translate-x-0' : 'opacity-0 translate-y-2 translate-x-3'}`}>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-wide text-white/80">
                  Outcome
                </div>
                <h3 className="mt-3 text-2xl md:text-3xl font-extrabold">What Dripwriter gives you</h3>
                <div className="mt-4 relative">
                  <div
                    className={`overflow-hidden transition-[max-height] duration-500 ease-out ${whyRightExpanded ? '' : 'pb-2'}`}
                    style={{ maxHeight: whyRightExpanded ? '2000px' : '280px' }}
                  >
                    <ul className="space-y-3 text-white/85 md:text-lg">
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Natural, human-paced edits that unfold over time — paragraphs, not dumps.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[50px] md:min-h-[58px]">
                        <span className="mt-1">•</span>
                        <span>Clean, believable version history as the doc fills in on a schedule.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px] -mt-3">
                        <span className="mt-1">•</span>
                        <span>Smart pauses that mimic real writing breaks and research moments.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Freedom to step away — set your duration and come back to completed progress.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Set-and-forget pacing — your draft unfolds on a schedule you control.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Direct Google Docs connection — no manual copying once you start.</span>
                      </li>
                      <li className="flex items-start gap-3 min-h-[56px] md:min-h-[64px]">
                        <span className="mt-1">•</span>
                        <span>Pause and resume controls so you can pick up exactly where you left off.</span>
                      </li>
                    </ul>
                  </div>
                  {!whyRightExpanded ? (
                    <button
                      type="button"
                      onClick={() => toggleWhyBoth(true)}
                      className="mt-0 text-sm text-white/85 underline cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.05] hover:font-bold"
                    >
                      Read more
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleWhyBoth(false)}
                      className="mt-0 text-sm text-white/85 underline cursor-pointer transition-transform duration-150 ease-out hover:scale-[1.05] hover:font-bold"
                    >
                      Collapse
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* How it works (3 steps) */}
        <section id="how" ref={howSectionRef} className="mx-auto w-full px-6 md:px-8 pt-8 md:pt-10 pb-12 md:pb-16">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="text-center text-3xl md:text-4xl font-extrabold mb-8">How It Works</h2>
            <p className="text-center text-white/80 max-w-2xl mx-auto mb-10 md:mb-12">Three simple steps to turn your draft into a human‑paced Google Doc.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Step 1 */}
              <div className={`rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm p-6 text-center transform-gpu transition-all duration-400 md:duration-500 ease-out ${how1In ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                  {/* Paste icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 md:h-8 md:w-8 text-white/90">
                    <path d="M9 2a2 2 0 0 0-2 2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6v-2H6V6h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6h1v4h2V6a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2H9Zm0 2h6v3H9V4Z"/>
                  </svg>
                </div>
                <div className="text-sm uppercase tracking-wide text-white/70">Step 1</div>
                <h3 className="mt-1 text-xl font-bold">Paste your draft</h3>
                <p className="mt-2 text-white/80">Drop your text into the box or paste it from anywhere.</p>
              </div>

              {/* Step 2 */}
              <div className={`rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm p-6 text-center transform-gpu transition-all duration-400 md:duration-500 ease-out ${how2In ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                  {/* Duration/clock icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-7 w-7 md:h-8 md:w-8 text-white">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="12" x2="12" y2="7" />
                    <line x1="12" y1="12" x2="15" y2="12" />
                  </svg>
                </div>
                <div className="text-sm uppercase tracking-wide text-white/70">Step 2</div>
                <h3 className="mt-1 text-xl font-bold">Pick a total duration</h3>
                <p className="mt-2 text-white/80">Choose 30 min or 1 hr in the free plan (more with Pro).</p>
              </div>

              {/* Step 3 */}
              <div className={`rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm p-6 text-center transform-gpu transition-all duration-400 md:duration-500 ease-out ${how3In ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}>
                <div className="mx-auto mb-4 size-14 md:size-16 rounded-2xl grid place-items-center border border-white/20 bg-white/10">
                  {/* Google Doc / drip icon */}
                  <img
                    src="/google-docs.png"
                    alt="Google Docs Icon"
                    className="h-7 w-7 md:h-8 md:w-8 object-contain"
                  />
                </div>
                <div className="text-sm uppercase tracking-wide text-white/70">Step 3</div>
                <h3 className="mt-1 text-xl font-bold">Watch it drip into Docs</h3>
                <p className="mt-2 text-white/80">We type it in on a schedule with natural edits and pauses.</p>
              </div>
            </div>
          </div>
        </section>
        {/* Demo box for your GIF */}
        <div
          id="demo"
          ref={demoRef}
          className={`mx-auto mt-6 w-full max-w-5xl transform-gpu transition-all duration-300 ease-out ${
            demoInView ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-2"
          }`}
        >
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
      <section className="mx-auto w-full px-6 md:px-8 pt-0 md:pt-4 pb-20">
        <div className="mx-auto max-w-5xl">
          <h2 ref={ctaRef} className="text-center text-4xl md:text-5xl font-extrabold text-white mb-6">
            {["Ready", "to", "Drip", "Text?"].map((word, i) => (
              <span
                key={word + i}
                className={`inline-block transition-all duration-500 ease-out ${ctaIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                {word}
                {i < 3 ? '\u00A0' : ''}
              </span>
            ))}
          </h2>
          <div
            className="rounded-3xl border border-white/20 bg-white/80 backdrop-blur-sm shadow-lg p-6 relative transform-gpu transition-transform duration-400 ease-out hover:scale-[1.03] hover:shadow-xl"
            style={{ willChange: 'transform' }}
          >
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
                      className="cursor-pointer mt-4 rounded-full bg-black text-white px-5 py-2 text-sm font-semibold hover:bg-black/90"
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
                  className={`w-full h-96 rounded-xl border bg-white text-black p-4 resize-none focus:outline-none focus:ring-2 transform-gpu transition-transform duration-200 ease-out hover:scale-[1.01] focus:scale-[1.01] ${
                    over ? "border-red-400 focus:ring-red-300" : "border-gray-300 focus:ring-pink-300"
                  } ${!signedIn ? "opacity-60" : ""}`}
                  style={{ willChange: 'transform' }}
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

      {/* FAQ (Expandable) */}
      <section id="faq" ref={faqSectionRef} className="mx-auto w-full px-6 md:px-8 pt-25 md:pt-25 -mt-10 md:-mt-10 pb-12 md:pb-16">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl md:text-4xl font-extrabold mb-6">Frequently Asked Questions</h2>
          <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md shadow-[0_8px_30px_rgba(0,0,0,0.15)] p-8 md:p-10 min-h-[26rem] md:min-h-[30rem]">
            <div className={`space-y-5 faq-enter ${faqIn ? 'in' : ''}`}>
            {/* Item 1 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">How does Dripwriter work with Google Docs?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                After you sign in with Google and grant permission, Dripwriter connects to your Docs and types your pasted text over time according to the duration you pick.
              </div>
            </details>

            {/* Item 2 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">What does “total duration” mean?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                It’s the overall time window (e.g., 30 minutes or 1 hour) during which your draft is gradually entered into your Google Doc.
              </div>
            </details>

            {/* Item 3 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">Can I leave my computer while it’s running?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                Yes. Once started, Dripwriter handles the pacing automatically. You can pause or stop from the app at any time.
              </div>
            </details>

            {/* Item 4 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">What’s included in the free tier?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                Access to 30 min and 1 hr durations with word caps. Longer schedules and higher caps are available with Pro.
              </div>
            </details>

            {/* Item 5 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">Does it change my writing?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                No. Dripwriter simply enters the text you provide at a human pace. You stay in control of the content.
              </div>
            </details>

            {/* Item 6 */}
            <details className="faq group rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-base md:text-lg font-semibold">Can I connect multiple Google accounts?</span>
                <svg className="h-5 w-5 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd"/></svg>
              </summary>
              <div className="faq-content mt-3 text-white/85 overflow-hidden">
                Support for switching accounts is planned. For now, connect the account you’ll use for your Docs.
              </div>
            </details>
            </div>
          </div>
        </div>

        {/* FAQ chevron and smooth expand/collapse */}
        <style jsx global>{`
          /* Hide default marker */
          details > summary::-webkit-details-marker { display: none; }
          /* Rotate chevron when open (for browsers without group-open support) */
          details[open] summary svg { transform: rotate(180deg); }

          /* Staggered reveal for FAQ items */
          .faq-enter details.faq {
            opacity: 0;
            transform: translateY(8px);
            transition: opacity 420ms ease, transform 420ms ease;
          }
          .faq-enter.in details.faq { opacity: 1; transform: translateY(0); }
          .faq-enter.in details.faq:nth-child(1) { transition-delay: 0ms; }
          .faq-enter.in details.faq:nth-child(2) { transition-delay: 70ms; }
          .faq-enter.in details.faq:nth-child(3) { transition-delay: 140ms; }
          .faq-enter.in details.faq:nth-child(4) { transition-delay: 210ms; }
          .faq-enter.in details.faq:nth-child(5) { transition-delay: 280ms; }
          .faq-enter.in details.faq:nth-child(6) { transition-delay: 350ms; }

          /* Smooth expand/collapse for FAQ answers */
          .faq .faq-content {
            max-height: 0;
            opacity: 0;
            transform: translateY(-4px);
            transition: max-height 600ms ease, opacity 450ms ease, transform 450ms ease;
          }
          .faq[open] .faq-content {
            max-height: 600px;
          }

          /* Respect reduced motion */
          @media (prefers-reduced-motion: reduce) {
            .faq .faq-content { transition: none; }
          }
        `}</style>
      </section>

      {/* Software Section */}


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