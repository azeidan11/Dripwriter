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
        {/* Mobile Sign in button */}
        <a
          href="#get-started"
          className="md:hidden rounded-full bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
        >
          Sign in
        </a>
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