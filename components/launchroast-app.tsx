"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getScoreSummary,
  isValidHttpUrl,
  type AuditErrorResponse,
  type AuditInputType,
  type AuditResponseBody,
  type AuditResult,
  type TrustSafetyReview,
  type WebsiteStatus,
} from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";
import { getStoredAuditCount, incrementStoredAuditCount } from "@/lib/storage";
import { ThemeToggle } from "@/components/theme-toggle";

const tabOptions: Array<{ id: AuditInputType; label: string; helper: string }> = [
  {
    id: "url",
    label: "Homepage URL",
    helper:
      "Run a passive live status check alongside the launch-readiness review for a public website URL.",
  },
  {
    id: "copy",
    label: "Draft copy",
    helper:
      "Use this when the page is still being written and you want the roast before the website goes live.",
  },
];

const heroNotes = [
  {
    label: "Signal 01",
    title: "AI roast with clearer messaging",
    description:
      "Turn a first draft or live homepage into sharper language, clearer hierarchy, and stronger launch confidence.",
  },
  {
    label: "Signal 02",
    title: "Passive live status check",
    description:
      "Check whether the submitted public URL is reachable, how it responds, whether it redirects, and whether HTTPS is in place.",
  },
  {
    label: "Signal 03",
    title: "Trust-signal review without scanner behavior",
    description:
      "Review the page for visible trust cues and basic safety signals without probing hidden routes or exploit behavior.",
  },
];

const whoItsFor = [
  {
    label: "Audience 01",
    title: "Founders before launch",
    description:
      "Use it to confirm the site is reachable, the message is clear, and the page feels ready before early users see it.",
  },
  {
    label: "Audience 02",
    title: "Students and indie builders",
    description:
      "Use it when you want a fast launch-readiness check without building a full QA workflow around a small project.",
  },
  {
    label: "Audience 03",
    title: "Teams polishing launch pages",
    description:
      "Use it before a beta, product update, or announcement when you want a sharper external read on the page.",
  },
];

const auditChecks = [
  "Value proposition clarity",
  "Headline and CTA specificity",
  "Offer friction and launch readiness",
  "Trust signals and privacy cues",
  "Live status, redirects, HTTPS, response time",
  "First-time visitor readiness",
];

const faqs = [
  {
    question: "Is LaunchRoast AI free?",
    answer: "Yes. LaunchRoast AI is fully free in the current version.",
  },
  {
    question: "Do you scan for vulnerabilities?",
    answer:
      "No. The Trust & Safety Review and website status check are passive and non-invasive. They do not run exploit tests, scanner payloads, or hidden path probing.",
  },
  {
    question: "What does the website status check do?",
    answer:
      "For a public live URL, it checks reachability, HTTP status, redirects, HTTPS usage, and response timing. It is a launch-state check, not a security scan.",
  },
  {
    question: "Can I paste draft copy instead of a URL?",
    answer:
      "Yes. Switch to the draft copy tab and paste the headline, subheadline, CTA, proof, and offer copy you want reviewed.",
  },
  {
    question: "What happens if the AI API is not configured?",
    answer:
      "The app falls back to a local mock roast so the workflow stays usable without a live AI key.",
  },
];

const previewRows = [
  {
    label: "Website status",
    before: "Launch state unknown",
    after: "Online, HTTPS enabled, one redirect removed",
  },
  {
    label: "Headline rewrite",
    before: "AI tools for modern growth teams",
    after: "Check if your website is ready to launch.",
  },
  {
    label: "CTA rewrite",
    before: "Learn more",
    after: "Check my website",
  },
];

function formatTrustSafetyReview(review: TrustSafetyReview) {
  return [
    `Trust score: ${review.trustScore}/100`,
    "",
    `HTTPS feedback: ${review.httpsFeedback}`,
    `Privacy & terms feedback: ${review.privacyTermsFeedback}`,
    `Contact transparency feedback: ${review.contactTransparencyFeedback}`,
    `Data handling feedback: ${review.dataHandlingFeedback}`,
    `Security claims feedback: ${review.securityClaimsFeedback}`,
    "",
    "Recommended fixes:",
    ...review.recommendedFixes.map((fix) => `- ${fix}`),
  ].join("\n");
}

function formatWebsiteStatus(status: WebsiteStatus) {
  return [
    `Availability: ${status.isOnline ? "Online" : "Down"}`,
    status.statusCode
      ? `HTTP status: ${status.statusCode}${status.statusText ? ` ${status.statusText}` : ""}`
      : "HTTP status: unavailable",
    status.responseTimeMs
      ? `Response time: ${status.responseTimeMs}ms`
      : "Response time: unavailable",
    `HTTPS: ${status.usesHttps ? "Yes" : "No"}`,
    `Redirected: ${status.redirected ? "Yes" : "No"}`,
    status.finalUrl ? `Final URL: ${status.finalUrl}` : undefined,
    status.error ? `Error: ${status.error}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function getCtaStrengthScore(result: AuditResult) {
  const actionWords = /(get|start|book|see|fix|launch|try|claim|audit|review|check)/i;
  let score = 70;

  if (actionWords.test(result.ctaRewrite)) {
    score += 10;
  }
  if (result.ctaRewrite.length >= 12 && result.ctaRewrite.length <= 34) {
    score += 8;
  }
  if (/\bmy\b|\byour\b/i.test(result.ctaRewrite)) {
    score += 5;
  }

  return Math.min(96, score);
}

export function LaunchRoastApp() {
  const [mode, setMode] = useState<AuditInputType>("url");
  const [input, setInput] = useState("");
  const [auditCount, setAuditCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [auditSource, setAuditSource] = useState<AuditResponseBody["source"] | null>(null);
  const [auditModel, setAuditModel] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  useEffect(() => {
    setAuditCount(getStoredAuditCount());
  }, []);

  useEffect(() => {
    if (!copiedField) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopiedField(null);
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [copiedField]);

  useEffect(() => {
    if (!copyStatusMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCopyStatusMessage(null);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [copyStatusMessage]);

  const trimmedInput = input.trim();
  const canRunAudit = useMemo(() => trimmedInput.length > 6, [trimmedInput]);

  const inlineUrlWarning = useMemo(() => {
    if (mode !== "url" || trimmedInput.length === 0 || isValidHttpUrl(trimmedInput)) {
      return null;
    }

    return "This does not look like a valid public URL. We can still roast the text you pasted.";
  }, [mode, trimmedInput]);

  const validationMessage = useMemo(() => {
    if (trimmedInput.length === 0) {
      return mode === "url"
        ? "Paste a live public URL to start the launch check."
        : "Paste draft website copy to start the roast.";
    }

    if (trimmedInput.length <= 6) {
      return mode === "url"
        ? "Add a fuller URL so the checker has enough context."
        : "Add a little more draft copy so the roast has enough material to work with.";
    }

    return null;
  }, [mode, trimmedInput]);

  const usageLabel =
    auditCount > 0
      ? `${auditCount} ${auditCount === 1 ? "check" : "checks"} run on this browser`
      : "Free tool";

  const isAuditDisabled = !canRunAudit || isLoading;
  const clarityScore = result?.clarityScore ?? 81;
  const trustScore = result?.trustSafetyReview.trustScore ?? 78;
  const ctaStrengthScore = result ? getCtaStrengthScore(result) : 84;

  function jumpToInput(nextMode: AuditInputType) {
    setMode(nextMode);
    document.getElementById("audit-input")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function handleAudit() {
    if (!canRunAudit) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setWarningMessage(null);

    trackEvent("audit_requested", {
      inputType: mode,
      hasApiFormattedUrl: mode === "url" && isValidHttpUrl(trimmedInput),
    });

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputType: mode,
          content: trimmedInput,
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as Partial<AuditErrorResponse>;
        throw new Error(errorPayload.error ?? "Unable to generate a report right now.");
      }

      const payload = (await response.json()) as AuditResponseBody;
      setResult(payload.audit);
      setAuditSource(payload.source);
      setAuditModel(payload.model ?? null);
      setWarningMessage(payload.warning ?? null);

      trackEvent("audit_completed", {
        inputType: mode,
        source: payload.source,
        clarityScore: payload.audit.clarityScore,
      });

      const nextCount = incrementStoredAuditCount();
      setAuditCount(nextCount);
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      trackEvent("audit_failed", { inputType: mode });
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to generate a report right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      setCopyStatusMessage(`Copied ${label.toLowerCase()}.`);
    } catch {
      setCopyStatusMessage("Clipboard access is unavailable in this browser.");
    }
  }

  function handleExportReport() {
    if (!result || isPrintingReport) {
      return;
    }

    const body = document.body;
    const cleanup = () => {
      body.classList.remove("printing-report");
      setIsPrintingReport(false);
    };

    setIsPrintingReport(true);
    body.classList.add("printing-report");

    const fallbackTimeout = window.setTimeout(cleanup, 2000);

    const handleAfterPrint = () => {
      window.clearTimeout(fallbackTimeout);
      cleanup();
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    window.setTimeout(() => {
      window.print();
    }, 60);
  }

  return (
    <main className="relative overflow-hidden">
      <SiteHeader usageLabel={usageLabel} />

      <section className="section-shell pt-10 sm:pt-12">
        <div className="section-inner grid gap-10 lg:grid-cols-[minmax(0,1.08fr)_420px] lg:items-start">
          <div className="max-w-3xl">
            <p className="mono-label">Free AI-powered launch checker</p>
            <h1 className="editorial-heading mt-6 max-w-3xl">
              Check if your website is ready to launch.
            </h1>
            <p className="body-copy mt-6 max-w-2xl text-[1.02rem]">
              Paste a live URL or draft copy to get an AI roast, launch-readiness
              report, trust-signal review, and live website status check.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => jumpToInput("url")}
                className="btn-primary"
              >
                Check my website
              </button>
              <button
                type="button"
                onClick={() => jumpToInput("copy")}
                className="btn-secondary"
              >
                Paste draft copy
              </button>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {heroNotes.map((note) => (
                <article key={note.title} className="feature-panel min-h-[180px]">
                  <p className="mono-label">{note.label}</p>
                  <h2 className="mt-4 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
                    {note.title}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-[color:var(--text-soft)]">
                    {note.description}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div id="audit-input" className="lg:pt-2">
            <div className="input-shell">
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] pb-5">
                <div>
                  <p className="mono-label">Control panel</p>
                  <h2 className="mt-3 text-xl font-medium tracking-[-0.03em] text-[color:var(--text)]">
                    Run a launch check
                  </h2>
                </div>
                <span className="status-badge">Public URLs only</span>
              </div>

              <div className="mt-5 segmented-shell">
                {tabOptions.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setMode(tab.id)}
                    className={`segmented-option ${mode === tab.id ? "is-active" : ""}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <p className="mt-5 text-sm leading-7 text-[color:var(--text-soft)]">
                {tabOptions.find((tab) => tab.id === mode)?.helper}
              </p>

              {mode === "url" ? (
                <label className="mt-5 block">
                  <span className="mono-label">Website URL</span>
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="https://your-site.com"
                    className="input-field mt-3"
                  />
                </label>
              ) : (
                <label className="mt-5 block">
                  <span className="mono-label">Draft copy</span>
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Paste your headline, subheadline, CTA, proof points, and offer copy..."
                    rows={9}
                    className="input-field mt-3"
                  />
                </label>
              )}

              <div className="mt-4 rounded-[18px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.018)] px-4 py-3">
                <p className="text-sm leading-7 text-[color:var(--text-muted)]">
                  {inlineUrlWarning ??
                    validationMessage ??
                    (mode === "url"
                      ? "Live URLs get a passive status check for reachability, redirects, HTTPS, and response timing."
                      : "Draft copy skips the status check and focuses on the message, CTA, offer, and trust structure.")}
                </p>
              </div>

              <button
                type="button"
                onClick={handleAudit}
                disabled={isAuditDisabled}
                className="btn-primary mt-5 w-full gap-3"
              >
                {isLoading ? <LoadingSpinner /> : null}
                <span>{isLoading ? "Generating report" : "Check my website"}</span>
              </button>

              <div className="mt-4 space-y-3">
                {errorMessage ? <StatusMessage tone="error" message={errorMessage} /> : null}
                {warningMessage ? (
                  <StatusMessage tone="neutral" message={warningMessage} />
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 border-t border-[color:var(--line)] pt-5 sm:grid-cols-2">
                <MiniMeta label="Mode" value={mode === "url" ? "Live URL check" : "Draft copy roast"} />
                <MiniMeta label="Output" value="Export-ready report" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      <section className="section-shell">
        <div className="section-inner">
          <div className="max-w-2xl">
            <p className="mono-label">Who this is for</p>
            <h2 className="editorial-heading-sm mt-4">
              Built for launch pages that need one more serious pass
            </h2>
            <p className="body-copy mt-5 max-w-xl">
              LaunchRoast AI works best when you already have a page, draft, or
              direction and want a sharper read before launch, a beta invite, or
              a public announcement.
            </p>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {whoItsFor.map((item) => (
              <article key={item.title} className="feature-panel">
                <p className="mono-label">{item.label}</p>
                <h3 className="mt-4 text-xl font-medium tracking-[-0.03em] text-[color:var(--text)]">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[color:var(--text-soft)]">
                  {item.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      <section className="section-shell">
        <div className="section-inner">
          <div className="max-w-2xl">
            <p className="mono-label">What the audit checks</p>
            <h2 className="editorial-heading-sm mt-4">
              A calmer report on launch readiness, message quality, and trust
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {auditChecks.map((item, index) => (
              <article key={item} className="feature-panel min-h-[150px]">
                <p className="mono-label">Check {String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
                  {item}
                </h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider" />

      <section id="preview" className="section-shell">
        <div className="section-inner">
          <div className="max-w-2xl">
            <p className="mono-label">Product preview</p>
            <h2 className="editorial-heading-sm mt-4">
              A signal board that reads like a real product, not an AI dump
            </h2>
          </div>

          <ProductPreview
            clarityScore={clarityScore}
            trustScore={trustScore}
            ctaStrengthScore={ctaStrengthScore}
          />
        </div>
      </section>

      <div className="section-divider" />

      <section id="report-section" className="section-shell">
        <div className="section-inner">
          <div className="no-print border-b border-[color:var(--line)] pb-6">
            <p className="mono-label">Audit report</p>
            <h2 className="editorial-heading-sm mt-4">Generated launch report</h2>
            <p className="body-copy mt-5 max-w-2xl">
              Launch readiness, message quality, live status, and trust signals
              arranged into one export-ready view.
            </p>
          </div>

          {!result && !isLoading ? (
            <div
              id="results"
              className="surface-card-strong print-surface mt-8 rounded-[32px] p-8 sm:p-10"
            >
              <div className="mx-auto max-w-2xl text-center">
                <p className="mono-label">Awaiting input</p>
                <h3 className="editorial-heading-sm mt-5">
                  Your report appears here after the first check
                </h3>
                <p className="body-copy mt-5 text-sm">
                  Paste a live website or draft copy and LaunchRoast AI will
                  turn it into a structured launch-readiness report with rewrites,
                  trust notes, and a status check for public URLs.
                </p>
              </div>
            </div>
          ) : null}

          {isLoading ? <LoadingReport /> : null}

          {result && !isLoading ? (
            <div
              id="results"
              className="surface-card-strong print-surface mt-8 rounded-[32px] p-5 sm:p-6"
            >
              <div id="audit-report-export" className="space-y-6">
                <div className="flex flex-col gap-4 border-b border-[color:var(--line)] pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="mono-label">Report output</p>
                    <h3 className="editorial-heading-sm mt-3">
                      LaunchRoast AI report
                    </h3>
                    <p className="body-copy mt-4 max-w-2xl text-sm">
                      Website status, clarity, trust signals, CTA strength, and
                      rewrite guidance in one serious report.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ReportBadge tone="accent">
                        {auditSource === "openrouter" ? "Live AI" : "Mock fallback"}
                      </ReportBadge>
                      <ReportBadge>
                        {result.websiteStatus ? "URL audit" : "Copy audit"}
                      </ReportBadge>
                      {auditModel ? <ReportBadge>{auditModel}</ReportBadge> : null}
                    </div>
                    {copyStatusMessage ? (
                      <p className="no-print mt-4 text-sm text-[color:var(--text-soft)]">
                        {copyStatusMessage}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={handleExportReport}
                    disabled={!result || isPrintingReport}
                    className="btn-secondary no-print"
                  >
                    {isPrintingReport ? "Preparing PDF" : "Export PDF"}
                  </button>
                </div>

                <div
                  className={`grid gap-4 ${
                    result.websiteStatus ? "xl:grid-cols-4" : "md:grid-cols-3"
                  }`}
                >
                  {result.websiteStatus ? (
                    <SummaryMetric
                      label="Website status"
                      value={result.websiteStatus.isOnline ? "Online" : "Down"}
                      detail={
                        result.websiteStatus.responseTimeMs
                          ? `${result.websiteStatus.responseTimeMs}ms response`
                          : result.websiteStatus.error ?? "Status unavailable"
                      }
                      tone={result.websiteStatus.isOnline ? "positive" : "default"}
                    />
                  ) : null}
                  <SummaryMetric
                    label="Clarity score"
                    value={`${result.clarityScore}/100`}
                    detail={getScoreSummary(result.clarityScore)}
                  />
                  <SummaryMetric
                    label="Trust score"
                    value={`${result.trustSafetyReview.trustScore}/100`}
                    detail="Passive read of visible trust and safety signals."
                  />
                  <SummaryMetric
                    label="CTA strength"
                    value={`${getCtaStrengthScore(result)}/100`}
                    detail="A quick read on action clarity and momentum."
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  {result.websiteStatus ? (
                    <WebsiteStatusCard
                      status={result.websiteStatus}
                      isCopied={copiedField === "Website status"}
                      onCopy={() =>
                        copyValue("Website status", formatWebsiteStatus(result.websiteStatus!))
                      }
                    />
                  ) : null}
                  <ReportCard
                    title="Main issue"
                    subtitle="The core friction holding the page back."
                    value={result.mainProblem}
                    isCopied={copiedField === "Main issue"}
                    onCopy={() => copyValue("Main issue", result.mainProblem)}
                  />
                  <ReportCard
                    title="Headline rewrite"
                    subtitle="A stronger opening line for the page."
                    value={result.headlineRewrite}
                    isCopied={copiedField === "Headline rewrite"}
                    onCopy={() => copyValue("Headline rewrite", result.headlineRewrite)}
                  />
                  <ReportCard
                    title="CTA rewrite"
                    subtitle="A tighter action prompt."
                    value={result.ctaRewrite}
                    isCopied={copiedField === "CTA rewrite"}
                    onCopy={() => copyValue("CTA rewrite", result.ctaRewrite)}
                  />
                  <ReportCard
                    title="Offer feedback"
                    subtitle="How the offer lands for a first-time visitor."
                    value={result.pricingFeedback}
                    isCopied={copiedField === "Offer feedback"}
                    onCopy={() => copyValue("Offer feedback", result.pricingFeedback)}
                  />
                  <TrustReviewCard
                    review={result.trustSafetyReview}
                    isCopied={copiedField === "Trust & Safety Review"}
                    onCopy={() =>
                      copyValue(
                        "Trust & Safety Review",
                        formatTrustSafetyReview(result.trustSafetyReview),
                      )
                    }
                  />
                  <ReportCard
                    title="Trust suggestions"
                    subtitle="Practical visible cues to tighten next."
                    value={result.trustSuggestions}
                    isCopied={copiedField === "Trust suggestions"}
                    onCopy={() => copyValue("Trust suggestions", result.trustSuggestions)}
                  />
                </div>

                <ReportCard
                  title="Final copy"
                  subtitle="A tighter draft to build from."
                  value={result.finalLandingCopy}
                  isCopied={copiedField === "Final copy"}
                  onCopy={() => copyValue("Final copy", result.finalLandingCopy)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="section-divider" />

      <section className="section-shell">
        <div className="section-inner">
          <div className="max-w-2xl">
            <p className="mono-label">FAQ</p>
            <h2 className="editorial-heading-sm mt-4">
              Common questions before you run the check
            </h2>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {faqs.map((item) => (
              <details key={item.question} className="feature-panel group">
                <summary className="flex cursor-pointer items-start justify-between gap-4">
                  <div>
                    <p className="mono-label">Question</p>
                    <h3 className="mt-4 text-base font-medium tracking-[-0.02em] text-[color:var(--text)]">
                      {item.question}
                    </h3>
                  </div>
                  <span className="mono-label pt-1 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-sm leading-7 text-[color:var(--text-soft)]">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="px-4 pb-10 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-[color:var(--line)] py-6 text-sm text-[color:var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="leading-7 text-[color:var(--text-soft)]">
              LaunchRoast AI is a free AI-powered launch checker for websites,
              homepages, and draft copy that need a clearer pre-launch pass.
            </p>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              Free tool. Contact placeholder: support@launchroast.ai
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#preview" className="nav-link px-0 py-0">
              Preview
            </a>
            <a href="#results" className="nav-link px-0 py-0">
              Report
            </a>
            <Link href="/privacy" className="nav-link px-0 py-0">
              Privacy
            </Link>
            <Link href="/terms" className="nav-link px-0 py-0">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SiteHeader({ usageLabel }: { usageLabel: string }) {
  return (
    <header className="top-nav no-print">
      <div className="top-nav-inner">
        <Link href="/" className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-none border border-[color:var(--line)] bg-[rgba(255,255,255,0.025)]">
            <span className="mono-label text-[10px] text-[color:var(--text)]">LR</span>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color:var(--text)]">
              LaunchRoast AI
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex">
          <a href="#preview" className="nav-link">
            Preview
          </a>
          <a href="#results" className="nav-link">
            Report
          </a>
          <Link href="/privacy" className="nav-link">
            Privacy
          </Link>
          <Link href="/terms" className="nav-link">
            Terms
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <span className="status-badge hidden md:inline-flex">{usageLabel}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ProductPreview({
  clarityScore,
  trustScore,
  ctaStrengthScore,
}: {
  clarityScore: number;
  trustScore: number;
  ctaStrengthScore: number;
}) {
  return (
    <div className="surface-card-strong mt-10 overflow-hidden rounded-[32px]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--line)] px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[color:var(--text-muted)]/60" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--text-muted)]/40" />
          <span className="h-2 w-2 rounded-full bg-[color:var(--text-muted)]/30" />
        </div>
        <p className="mono-label">LaunchRoast board</p>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <PreviewMetric label="Clarity" score={clarityScore} />
            <PreviewMetric label="Trust" score={trustScore} />
            <PreviewMetric label="CTA" score={ctaStrengthScore} />
          </div>

          <div className="mt-5 space-y-3">
            {previewRows.map((row) => (
              <div
                key={row.label}
                className="grid gap-3 rounded-[22px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.016)] p-4 sm:grid-cols-[160px_minmax(0,1fr)]"
              >
                <p className="mono-label">{row.label}</p>
                <div className="space-y-2">
                  <p className="text-sm text-[color:var(--text-muted)] line-through decoration-[color:var(--line-strong)]">
                    {row.before}
                  </p>
                  <p className="text-sm leading-7 text-[color:var(--text)]">{row.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-[color:var(--line)] bg-[rgba(255,255,255,0.012)] p-5 lg:border-l lg:border-t-0 sm:p-6">
          <p className="mono-label">Report sidebar</p>
          <div className="mt-4 space-y-4">
            <SidebarStat label="Main issue" value="Outcome needs to land faster above the fold." />
            <SidebarStat label="Status" value="Public URL reachable and safe to share." />
            <SidebarStat label="Trust" value="Privacy, contact, and proof cues need better visibility." />
            <SidebarStat label="Launch" value="Close, but still worth one final copy pass." />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewMetric({ label, score }: { label: string; score: number }) {
  return (
    <div className="metric-panel">
      <p className="mono-label">{label}</p>
      <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[color:var(--text)]">
        {score}
        <span className="ml-1 text-sm text-[color:var(--text-muted)]">/100</span>
      </p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] p-4">
      <p className="mono-label">{label}</p>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-soft)]">{value}</p>
    </div>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] px-4 py-3">
      <p className="mono-label">{label}</p>
      <p className="mt-2 text-sm text-[color:var(--text-soft)]">{value}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white [animation-delay:160ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white [animation-delay:320ms]" />
    </span>
  );
}

function LoadingReport() {
  return (
    <div id="results" className="mt-8 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="metric-panel print-card">
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/8" />
            <div className="mt-4 h-8 w-24 animate-pulse rounded-full bg-white/8" />
            <div className="mt-4 h-3 w-3/4 animate-pulse rounded-full bg-white/8" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="report-panel print-card">
            <div className="flex items-center justify-between gap-4">
              <div className="h-4 w-36 animate-pulse rounded-full bg-white/8" />
              <div className="h-8 w-14 animate-pulse rounded-full bg-white/8" />
            </div>
            <div className="mt-5 space-y-3">
              <div className="h-3 animate-pulse rounded-full bg-white/8" />
              <div className="h-3 animate-pulse rounded-full bg-white/8" />
              <div className="h-3 w-4/5 animate-pulse rounded-full bg-white/8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="metric-panel print-card">
      <p className="mono-label">{label}</p>
      <p
        className={`mt-3 text-[1.7rem] font-medium tracking-[-0.04em] ${
          tone === "positive" ? "text-[color:var(--success)]" : "text-[color:var(--text)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-soft)]">{detail}</p>
    </div>
  );
}

function ReportBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <span className={`status-badge ${tone === "accent" ? "status-badge-accent" : ""}`}>
      {children}
    </span>
  );
}

function ReportCard({
  title,
  subtitle,
  value,
  isCopied,
  onCopy,
}: {
  title: string;
  subtitle: string;
  value: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="report-panel print-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label">{title}</p>
          <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">{subtitle}</p>
        </div>
        <CopyButton isCopied={isCopied} onCopy={onCopy} />
      </div>
      <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[color:var(--text-soft)]">
        {value}
      </p>
    </section>
  );
}

function WebsiteStatusCard({
  status,
  isCopied,
  onCopy,
}: {
  status: WebsiteStatus;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="report-panel print-card xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label">Website status</p>
          <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
            Website status
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            Passive reachability and launch-state signals for the submitted live URL.
          </p>
        </div>
        <CopyButton isCopied={isCopied} onCopy={onCopy} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusField
          label="Availability"
          value={status.isOnline ? "Online" : "Down"}
          tone={status.isOnline ? "positive" : "default"}
        />
        <StatusField
          label="HTTP status"
          value={
            status.statusCode
              ? `${status.statusCode}${status.statusText ? ` ${status.statusText}` : ""}`
              : "Unavailable"
          }
        />
        <StatusField
          label="Response time"
          value={status.responseTimeMs ? `${status.responseTimeMs}ms` : "Unavailable"}
        />
        <StatusField label="HTTPS" value={status.usesHttps ? "Yes" : "No"} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <TrustField
          label="Redirected"
          value={
            status.redirected
              ? `Yes${typeof status.redirectCount === "number" ? `, ${status.redirectCount} hop${status.redirectCount === 1 ? "" : "s"}` : ""}`
              : "No redirect was needed."
          }
        />
        <TrustField label="Final URL" value={status.finalUrl ?? status.inputUrl} />
      </div>

      {status.error ? (
        <div className="mt-4 rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] p-4">
          <p className="mono-label">Status note</p>
          <p className="mt-3 text-sm leading-7 text-[color:var(--text-soft)]">{status.error}</p>
        </div>
      ) : null}
    </section>
  );
}

function TrustReviewCard({
  review,
  isCopied,
  onCopy,
}: {
  review: TrustSafetyReview;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="report-panel print-card xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono-label">Trust & safety</p>
          <h3 className="mt-3 text-lg font-medium tracking-[-0.02em] text-[color:var(--text)]">
            Trust &amp; Safety Review
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            Passive, non-invasive feedback based on visible trust signals only.
          </p>
        </div>
        <CopyButton isCopied={isCopied} onCopy={onCopy} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="metric-panel">
          <p className="mono-label">Trust score</p>
          <p className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[color:var(--text)]">
            {review.trustScore}
            <span className="ml-1 text-sm text-[color:var(--text-muted)]">/100</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TrustField label="HTTPS feedback" value={review.httpsFeedback} />
          <TrustField label="Privacy & terms feedback" value={review.privacyTermsFeedback} />
          <TrustField label="Contact transparency" value={review.contactTransparencyFeedback} />
          <TrustField label="Data handling" value={review.dataHandlingFeedback} />
          <div className="md:col-span-2">
            <TrustField
              label="Security claims feedback"
              value={review.securityClaimsFeedback}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] p-5">
        <p className="mono-label">Recommended fixes</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[color:var(--text-soft)]">
          {review.recommendedFixes.map((fix) => (
            <li key={fix}>{fix}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TrustField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] p-4">
      <p className="mono-label">{label}</p>
      <p className="mt-3 text-sm leading-7 text-[color:var(--text-soft)]">{value}</p>
    </div>
  );
}

function StatusField({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive";
}) {
  return (
    <div className="rounded-[20px] border border-[color:var(--line)] bg-[rgba(255,255,255,0.015)] p-4">
      <p className="mono-label">{label}</p>
      <p
        className={`mt-3 text-sm font-medium ${
          tone === "positive" ? "text-[color:var(--success)]" : "text-[color:var(--text)]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function CopyButton({
  isCopied,
  onCopy,
}: {
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`no-print inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] transition duration-200 ${
        isCopied
          ? "border-[color:var(--line-strong)] bg-[color:var(--accent-soft)] text-[color:var(--text)]"
          : "border-[color:var(--line)] bg-[rgba(255,255,255,0.02)] text-[color:var(--text-muted)] hover:border-[color:var(--line-strong)] hover:text-[color:var(--text)]"
      }`}
    >
      {isCopied ? "Copied" : "Copy"}
    </button>
  );
}

function StatusMessage({
  tone,
  message,
}: {
  tone: "error" | "neutral";
  message: string;
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-sm leading-7 ${
        tone === "error"
          ? "border-[rgba(255,110,110,0.22)] bg-[rgba(255,110,110,0.08)] text-[rgb(255,205,205)]"
          : "border-[color:var(--line)] bg-[rgba(255,255,255,0.02)] text-[color:var(--text-soft)]"
      }`}
    >
      {message}
    </div>
  );
}
