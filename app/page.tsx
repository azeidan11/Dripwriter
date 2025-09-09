export default function Home() {
  return (
    <main className="min-h-screen text-white">
      {/* Background image + dark overlay for readability */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-[#e38db7] to-[#b35c8f]" />

      {/* Top nav (simple placeholder) */}
      <header className="mx-auto w-full max-w-6xl px-6 py-5 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <div className="size-8 rounded-xl bg-white/10 backdrop-blur-sm grid place-items-center">
            <span className="text-sm font-semibold">DW</span>
          </div>
          <span className="text-base font-semibold tracking-tight">Dripwriter</span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <a className="hover:text-white" href="#features">Features</a>
          <a className="hover:text-white" href="#pricing">Pricing</a>
          <a className="hover:text-white" href="#faq">FAQ</a>
          <a className="rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90" href="#get-started">Sign in</a>
        </nav>
        {/* Mobile actions */}
        <div className="md:hidden flex items-center gap-2">
          <a
            href="#get-started"
            className="rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
          >
            Sign in
          </a>
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
      <section className="mx-auto w-full max-w-5xl px-6 pt-10 pb-16 md:pt-20 md:pb-24">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-white/70">
            New • Write as you go
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Dripwriter
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-white/80 md:text-lg">
            Paste your draft. Pick a duration. We’ll drip it into your Google Doc on a schedule.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="#get-started"
              className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-black/20 hover:bg-white/90"
            >
              Get started free
            </a>
            <a
              href="#demo"
              className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Demo box for your GIF */}
        <div id="demo" className="mx-auto mt-10 w-full max-w-4xl">
          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-2 md:p-3">
            <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl bg-black/50 ring-1 ring-white/10">
              <img
                src="/demo.gif"
                alt="Dripwriter demo"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-sm text-white/60">
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