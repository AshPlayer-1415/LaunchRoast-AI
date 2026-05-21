import Link from "next/link";

export function LegalPageShell({
  eyebrow,
  title,
  intro,
  alternateHref,
  alternateLabel,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  alternateHref: string;
  alternateLabel: string;
  sections: Array<{ heading: string; body: string }>;
}) {
  return (
    <main className="min-h-screen px-4 py-6 text-slate-100 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-3 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-[rgba(124,140,255,0.12)] text-[11px] font-semibold tracking-[0.14em] text-white">
              LR
            </div>
            <p className="text-sm font-semibold tracking-tight text-white">
              LaunchRoast AI
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={alternateHref}
              className="rounded-[12px] px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
            >
              {alternateLabel}
            </Link>
            <Link
              href="/"
              className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition hover:border-white/16 hover:text-white"
            >
              Home
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:pt-6">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-white">
              {title}
            </h1>
            <p className="mt-5 text-sm leading-7 text-slate-400">{intro}</p>
          </aside>

          <article className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-6 shadow-[0_22px_70px_rgba(4,8,24,0.28)] sm:p-8">
            <div className="space-y-8">
              {sections.map((section) => (
                <section
                  key={section.heading}
                  className="border-b border-white/8 pb-8 last:border-b-0 last:pb-0"
                >
                  <h2 className="text-lg font-semibold tracking-[-0.02em] text-white">
                    {section.heading}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {section.body}
                  </p>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
