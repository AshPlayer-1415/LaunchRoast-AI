import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <main className="legal-shell">
      <div className="legal-shell-inner">
        <div className="top-nav-inner">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-none border border-[color:var(--line)] bg-[rgba(255,255,255,0.025)]">
              <span className="mono-label text-[10px] text-[color:var(--text)]">LR</span>
            </div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--text)]">
              LaunchRoast AI
            </p>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href={alternateHref}
              className="nav-link"
            >
              {alternateLabel}
            </Link>
            <Link href="/" className="btn-secondary px-3 py-2 text-sm">
              Home
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:pt-6">
            <p className="mono-label">{eyebrow}</p>
            <h1 className="editorial-heading-sm mt-4">{title}</h1>
            <p className="body-copy mt-5 text-sm">{intro}</p>
          </aside>

          <article className="surface-card-strong rounded-[32px] p-6 sm:p-8">
            <div className="space-y-8">
              {sections.map((section) => (
                <section
                  key={section.heading}
                  className="border-b border-[color:var(--line)] pb-8 last:border-b-0 last:pb-0"
                >
                  <p className="mono-label">Section</p>
                  <h2 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
                    {section.heading}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-soft)]">{section.body}</p>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}
