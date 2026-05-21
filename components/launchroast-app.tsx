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
} from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";
import {
  FREE_AUDIT_LIMIT,
  getStoredAuditCount,
  incrementStoredAuditCount,
} from "@/lib/storage";

const tabOptions: { id: AuditInputType; label: string; helper: string }[] = [
  {
    id: "url",
    label: "Homepage URL",
    helper:
      "Use a public landing page URL when you want launch-readiness feedback based on the page itself.",
  },
  {
    id: "copy",
    label: "Draft copy",
    helper:
      "Use this when the page is still being written and you want sharper messaging before launch.",
  },
];

const productSignals = [
  "Clarity score with concise buyer-focused feedback",
  "Headline, CTA, and pricing rewrites that feel product-aware",
  "Trust-signal review without invasive or scanner-like behavior",
];

const whoItsFor = [
  {
    title: "Founders before launch",
    description:
      "Use it to tighten the homepage before early users, investors, or beta traffic form the wrong impression.",
  },
  {
    title: "Marketers iterating fast",
    description:
      "Use it when you want sharper positioning, CTA language, and clearer pricing context between experiments.",
  },
  {
    title: "Product teams rewriting copy",
    description:
      "Use it to turn rough draft copy into a more structured message before design polish or paid traffic.",
  },
];

const auditChecks = [
  "Clarity of the core value proposition",
  "Headline strength and CTA specificity",
  "Pricing friction and offer clarity",
  "Trust signals, privacy cues, and contact transparency",
  "Launch readiness for a first-time visitor",
];

const faqs = [
  {
    question: "Do you scan my website for vulnerabilities?",
    answer:
      "No. The Trust & Safety Review is passive and non-invasive. It comments on visible trust signals and basic safety signals only.",
  },
  {
    question: "Can I use this before launch?",
    answer:
      "Yes. You can use it on a live homepage or on draft copy before the page is published.",
  },
  {
    question: "Can I paste draft copy instead of a URL?",
    answer:
      "Yes. Switch to the draft copy tab and paste your headline, subheadline, CTA, proof, and pricing copy.",
  },
  {
    question: "Is the first audit free?",
    answer:
      "Yes. The first audit is free and tracked locally in your browser.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. The current version does not require an account or authentication.",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "1 audit",
    description: "Try one full roast",
    subcopy: "A complete review of messaging, CTA strength, pricing friction, and trust signals.",
    cta: "Start free",
    featured: false,
    plan: "free" as const,
  },
  {
    name: "Starter",
    price: "$9 for 5 audits",
    description: "5 focused audits for rewrite sprints",
    subcopy: "Ideal for founders and marketers testing a few headline and offer directions quickly.",
    cta: "Choose Starter",
    featured: true,
    plan: "starter" as const,
  },
  {
    name: "Pro",
    price: "$12/month",
    description: "Ongoing audits for teams and marketers",
    subcopy: "Designed for regular homepage iteration across launches, campaigns, and positioning updates.",
    cta: "Choose Pro",
    featured: false,
    plan: "pro" as const,
  },
];

const previewRows = [
  {
    label: "Headline rewrite",
    before: "AI for revenue teams",
    after: "Roast your landing page before customers do.",
  },
  {
    label: "CTA rewrite",
    before: "Learn more",
    after: "Get my landing page review",
  },
  {
    label: "Trust signal",
    before: "Generic security claims",
    after: "Visible privacy, contact, and data-handling cues",
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

function getCtaStrengthScore(result: AuditResult) {
  const actionWords = /(get|start|book|see|fix|launch|try|claim|audit|review)/i;
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
  const [hasLoadedAuditCount, setHasLoadedAuditCount] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copyStatusMessage, setCopyStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    setAuditCount(getStoredAuditCount());
    setHasLoadedAuditCount(true);
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

  useEffect(() => {
    if (showPaywall) {
      trackEvent("paywall_viewed", { auditCount });
    }
  }, [auditCount, showPaywall]);

  useEffect(() => {
    if (!showPaywall) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowPaywall(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showPaywall]);

  const freeAuditsRemaining = Math.max(FREE_AUDIT_LIMIT - auditCount, 0);
  const trimmedInput = input.trim();
  const canRunAudit = useMemo(() => trimmedInput.length > 6, [trimmedInput]);

  const inlineUrlWarning = useMemo(() => {
    if (mode !== "url" || trimmedInput.length === 0 || isValidHttpUrl(trimmedInput)) {
      return null;
    }

    return "This does not look like a valid URL. We can still review it as pasted text.";
  }, [mode, trimmedInput]);

  const validationMessage = useMemo(() => {
    if (!hasLoadedAuditCount) {
      return "Checking your free audit availability.";
    }

    if (trimmedInput.length === 0) {
      return mode === "url"
        ? "Paste a homepage URL to start the review."
        : "Paste draft landing page copy to start the review.";
    }

    if (trimmedInput.length <= 6) {
      return mode === "url"
        ? "Add a full homepage URL so we have enough context."
        : "Add a little more copy so the review has enough material to work with.";
    }

    return null;
  }, [hasLoadedAuditCount, mode, trimmedInput]);

  const usageLabel =
    !hasLoadedAuditCount
      ? "Checking free audit usage"
      : freeAuditsRemaining > 0
        ? `${freeAuditsRemaining} free audit remaining`
        : "Free audit used";

  const isAuditDisabled = !hasLoadedAuditCount || !canRunAudit || isLoading;

  const ctaStrengthScore = result ? getCtaStrengthScore(result) : 84;
  const trustScore = result?.trustSafetyReview.trustScore ?? 78;
  const clarityScore = result?.clarityScore ?? 81;
  const starterPaymentUrl = process.env.NEXT_PUBLIC_STARTER_PAYMENT_URL?.trim() ?? "";
  const proPaymentUrl = process.env.NEXT_PUBLIC_PRO_PAYMENT_URL?.trim() ?? "";

  function openPaymentLink(url: string, plan: "starter" | "pro") {
    trackEvent("upgrade_clicked", {
      location: showPaywall ? "paywall_modal" : "pricing_section",
      plan,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleAudit() {
    if (!canRunAudit) {
      return;
    }

    if (auditCount >= FREE_AUDIT_LIMIT) {
      setShowPaywall(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setWarningMessage(null);

    trackEvent("audit_requested", {
      inputType: mode,
      hasApiFormattedUrl: mode === "url" && isValidHttpUrl(input.trim()),
    });

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputType: mode,
          content: input.trim(),
        }),
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as Partial<AuditErrorResponse>;
        throw new Error(errorPayload.error ?? "Unable to generate an audit right now.");
      }

      const payload = (await response.json()) as AuditResponseBody;
      setResult(payload.audit);
      setWarningMessage(payload.warning ?? null);

      trackEvent("audit_completed", {
        inputType: mode,
        source: payload.source,
        clarityScore: payload.audit.clarityScore,
      });

      const nextCount = incrementStoredAuditCount();
      setAuditCount(nextCount);
      setShowPaywall(nextCount >= FREE_AUDIT_LIMIT);
      document.getElementById("results")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch (error) {
      trackEvent("audit_failed", { inputType: mode });
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to generate an audit right now.",
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

  return (
    <main className="relative overflow-hidden">
      <SiteHeader usageLabel={usageLabel} freeAuditsRemaining={freeAuditsRemaining} />

      <section className="px-4 pb-14 pt-6 sm:px-6 sm:pb-16 sm:pt-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(124,140,255,0.9)]" />
              Launch readiness for SaaS pages
            </div>

            <h1 className="mt-6 max-w-2xl text-[2.45rem] font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-[3rem] lg:text-[3.35rem]">
              Roast your landing page before customers do.
            </h1>

            <p className="mt-5 max-w-xl text-[1.02rem] leading-8 text-slate-300">
              Paste a homepage or draft copy and get a structured review of
              clarity, CTA strength, pricing friction, trust signals, and launch
              readiness.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#audit-input"
                className="inline-flex items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,#7d8dff_0%,#6f74ff_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(73,89,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_46px_rgba(73,89,255,0.34)]"
              >
                Start a roast
              </a>
              <a
                href="#preview"
                className="inline-flex items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition duration-200 hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
              >
                See the product view
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {productSignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
                >
                  {signal}
                </div>
              ))}
            </div>

            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400">
              The Trust &amp; Safety Review is passive and non-invasive. It does
              not test exploits or probe your site. It only comments on visible
              trust signals and basic safety signals from the page or copy you
              provide.
            </p>
          </div>

          <div id="audit-input" className="lg:pt-2">
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-4 shadow-[0_26px_80px_rgba(3,6,18,0.36)] backdrop-blur-xl sm:p-5">
              <div className="rounded-[22px] border border-white/8 bg-[#0b1020]/86 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {tabOptions.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMode(tab.id)}
                      className={`rounded-[16px] px-4 py-3 text-sm font-medium transition duration-200 ${
                        mode === tab.id
                          ? "border border-white/10 bg-[rgba(113,123,255,0.16)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          : "text-slate-400 hover:bg-white/[0.03] hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm leading-6 text-slate-400">
                    {tabOptions.find((tab) => tab.id === mode)?.helper}
                  </p>
                  <div className="hidden rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:block">
                    API ready
                  </div>
                </div>

                {mode === "url" ? (
                  <label className="mt-5 block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Homepage URL
                    </span>
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="https://your-startup.com"
                      className="w-full rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.035)] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-slate-600 focus:border-[rgba(123,136,255,0.55)] focus:bg-[rgba(255,255,255,0.05)]"
                    />
                  </label>
                ) : (
                  <label className="mt-5 block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      Landing page copy
                    </span>
                    <textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Paste your hero, subheadline, CTA, proof points, and pricing copy..."
                      rows={9}
                      className="w-full rounded-[18px] border border-white/10 bg-[rgba(255,255,255,0.035)] px-4 py-4 text-[15px] text-white outline-none transition placeholder:text-slate-600 focus:border-[rgba(123,136,255,0.55)] focus:bg-[rgba(255,255,255,0.05)]"
                    />
                  </label>
                )}

                <div className="mt-4 flex min-h-6 items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/20" />
                  <p className="text-sm text-slate-500">
                    {inlineUrlWarning ??
                      validationMessage ??
                      "The route supports OpenRouter when configured and falls back gracefully when it is not."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAudit}
                  disabled={isAuditDisabled}
                  className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-[18px] bg-[linear-gradient(135deg,#7d8dff_0%,#6d74ff_100%)] px-5 py-4 text-sm font-semibold text-white shadow-[0_16px_42px_rgba(83,93,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(83,93,255,0.34)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {isLoading ? <LoadingSpinner /> : null}
                  <span>{isLoading ? "Generating review" : "Roast my page"}</span>
                </button>

                <div className="mt-4 space-y-3">
                  {errorMessage ? (
                    <StatusMessage tone="error" message={errorMessage} />
                  ) : null}
                  {warningMessage ? (
                    <StatusMessage tone="neutral" message={warningMessage} />
                  ) : null}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs text-slate-500">
                  <span>OpenRouter-compatible route</span>
                  <span>PDF export included</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Who this is for
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
                Built for teams refining the page before it meets real traffic
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
                LaunchRoast AI works best when you already have a page, draft,
                or positioning direction and want a sharper outside read before
                launch or iteration.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {whoItsFor.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5"
                >
                  <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SectionDivider />

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              What the audit checks
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
              A concise review of message quality and launch confidence
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              The audit focuses on what a first-time visitor is likely to notice,
              question, or misunderstand before taking action.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {auditChecks.map((item) => (
              <div
                key={item}
                className="rounded-[20px] border border-white/8 bg-[#0b1020]/72 px-5 py-4 text-sm leading-7 text-slate-300"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="preview" className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Product preview
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
              A report that feels more like product review than generated filler
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Clear structure, minimal noise, and enough editorial guidance to
              make the next rewrite pass obvious.
            </p>
          </div>

          <ProductPreview
            clarityScore={clarityScore}
            trustScore={trustScore}
            ctaStrengthScore={ctaStrengthScore}
          />
        </div>
      </section>

      <SectionDivider />

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                Audit report
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
                Your landing page report
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                Messaging, conversion friction, and trust signals arranged in a
                cleaner report view.
              </p>
              {copyStatusMessage ? (
                <p className="mt-3 text-sm text-slate-300">{copyStatusMessage}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!result}
              className="no-print inline-flex items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-slate-300 transition duration-200 hover:border-white/16 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export as PDF
            </button>
          </div>

          {!result && !isLoading ? (
            <div
              id="results"
              className="print-surface mt-8 rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-8 shadow-[0_24px_70px_rgba(4,8,24,0.28)] sm:p-10"
            >
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/8 bg-white/[0.03] text-sm font-medium text-slate-400">
                  LR
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-white">
                  Your report appears here after the first roast
                </h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  Paste a homepage or draft and we will turn it into a structured
                  review with rewrites, trust-signal feedback, and final copy you
                  can actually ship from.
                </p>
              </div>
            </div>
          ) : null}

          {isLoading ? <LoadingReport /> : null}

          {result && !isLoading ? (
            <div id="results" className="print-surface mt-8 space-y-6">
              <div className="grid gap-4 lg:grid-cols-3">
                <MetricCard
                  label="Clarity score"
                  score={result.clarityScore}
                  description={getScoreSummary(result.clarityScore)}
                />
                <MetricCard
                  label="Trust score"
                  score={result.trustSafetyReview.trustScore}
                  description="A passive read of trust signals and basic safety signals."
                />
                <MetricCard
                  label="CTA strength"
                  score={getCtaStrengthScore(result)}
                  description="A quick read on action clarity, specificity, and momentum."
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <ReportCard
                  title="Main issue"
                  value={result.mainProblem}
                  isCopied={copiedField === "Main issue"}
                  onCopy={() => copyValue("Main issue", result.mainProblem)}
                />
                <ReportCard
                  title="Headline rewrite"
                  value={result.headlineRewrite}
                  isCopied={copiedField === "Headline rewrite"}
                  onCopy={() => copyValue("Headline rewrite", result.headlineRewrite)}
                />
                <ReportCard
                  title="CTA rewrite"
                  value={result.ctaRewrite}
                  isCopied={copiedField === "CTA rewrite"}
                  onCopy={() => copyValue("CTA rewrite", result.ctaRewrite)}
                />
                <ReportCard
                  title="Pricing feedback"
                  value={result.pricingFeedback}
                  isCopied={copiedField === "Pricing feedback"}
                  onCopy={() => copyValue("Pricing feedback", result.pricingFeedback)}
                />
                <TrustReviewCard
                  review={result.trustSafetyReview}
                  isCopied={copiedField === "Trust & Safety Roast"}
                  onCopy={() =>
                    copyValue(
                      "Trust & Safety Roast",
                      formatTrustSafetyReview(result.trustSafetyReview),
                    )
                  }
                />
                <ReportCard
                  title="Trust suggestions"
                  value={result.trustSuggestions}
                  isCopied={copiedField === "Trust suggestions"}
                  onCopy={() => copyValue("Trust suggestions", result.trustSuggestions)}
                />
              </div>

              <ReportCard
                title="Final copy"
                value={result.finalLandingCopy}
                isCopied={copiedField === "Final copy"}
                onCopy={() => copyValue("Final copy", result.finalLandingCopy)}
              />
            </div>
          ) : null}
        </div>
      </section>

      <SectionDivider />

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              FAQ
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
              Common questions before you run the first roast
            </h2>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.question}
                className="rounded-[22px] border border-white/8 bg-white/[0.03] p-5"
              >
                <h3 className="text-base font-semibold tracking-[-0.02em] text-white">
                  {item.question}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SectionDivider />

      <section id="pricing" className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-[2.15rem]">
              Choose the pace that matches your rewrite cycle
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-400">
              Start with one complete review, then upgrade if you want faster
              iteration across launches, campaigns, or positioning work.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <PricingCard
                key={tier.name}
                tier={tier}
                starterPaymentUrl={starterPaymentUrl}
                proPaymentUrl={proPaymentUrl}
                onStartFree={() => {
                  trackEvent("pricing_cta_clicked", { tier: tier.name });
                  document.getElementById("audit-input")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                onOpenPaymentLink={openPaymentLink}
              />
            ))}
          </div>
        </div>
      </section>

      <footer className="px-4 pb-10 pt-2 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/8 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="leading-7">
              LaunchRoast AI helps teams tighten landing page messaging before they
              spend more on design, traffic, or another vague rewrite pass.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Contact placeholder: support@launchroast.ai
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#preview" className="transition hover:text-white">
              Preview
            </a>
            <a href="#results" className="transition hover:text-white">
              Report
            </a>
            <a href="#pricing" className="transition hover:text-white">
              Pricing
            </a>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {showPaywall ? (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-[rgba(3,6,18,0.72)] p-4 backdrop-blur-md sm:p-6">
          <button
            type="button"
            aria-label="Close upgrade modal"
            onClick={() => setShowPaywall(false)}
            className="absolute inset-0 cursor-default"
          />
          <div
            className="relative w-full max-w-xl rounded-[30px] border border-white/10 bg-[#090e1a]/96 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.38)] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                  Free limit reached
                </p>
                <h3 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.03em] text-white">
                  Keep the review loop moving
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/16 hover:text-white"
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-400">
              Billing is still a placeholder, but this flow is ready to become a
              clean upgrade path once you connect a checkout provider.
            </p>

            <div className="mt-6 grid gap-3">
              <MiniPlan
                name="Starter"
                description="Five focused audits for rewrite sprints"
                price="$9"
                actionLabel={starterPaymentUrl ? "Open Starter payment link" : "Payment link coming soon"}
                disabled={!starterPaymentUrl}
                onClick={
                  starterPaymentUrl
                    ? () => openPaymentLink(starterPaymentUrl, "starter")
                    : undefined
                }
              />
              <MiniPlan
                name="Pro"
                description="Ongoing audits for teams and marketers"
                price="$12/mo"
                actionLabel={proPaymentUrl ? "Open Pro payment link" : "Payment link coming soon"}
                disabled={!proPaymentUrl}
                onClick={
                  proPaymentUrl ? () => openPaymentLink(proPaymentUrl, "pro") : undefined
                }
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-[14px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-300 transition hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
              >
                Keep exploring
              </button>
              <div className="flex-1 rounded-[14px] border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-400">
                Add Starter or Pro payment links in your environment to enable direct upgrades.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function SiteHeader({
  usageLabel,
  freeAuditsRemaining,
}: {
  usageLabel: string;
  freeAuditsRemaining: number;
}) {
  return (
    <header className="px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-[18px] border border-white/8 bg-white/[0.02] px-4 py-3 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/10 bg-[rgba(124,140,255,0.12)] text-[11px] font-semibold tracking-[0.14em] text-white">
            LR
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">
              LaunchRoast AI
            </p>
          </div>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <HeaderLink href="#preview" label="Preview" />
          <HeaderLink href="#results" label="Report" />
          <HeaderLink href="#pricing" label="Pricing" />
          <HeaderRoute href="/privacy" label="Privacy" />
          <HeaderRoute href="/terms" label="Terms" />
        </div>

        <div className="hidden sm:flex">
          <UsageBadge
            usageLabel={usageLabel}
            freeAuditsRemaining={freeAuditsRemaining}
          />
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-[12px] px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
    >
      {label}
    </a>
  );
}

function HeaderRoute({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[12px] px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-white"
    >
      {label}
    </Link>
  );
}

function UsageBadge({
  usageLabel,
  freeAuditsRemaining,
}: {
  usageLabel: string;
  freeAuditsRemaining: number;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: FREE_AUDIT_LIMIT }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-6 rounded-full ${
              index < freeAuditsRemaining
                ? "bg-[rgba(124,140,255,0.92)]"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <span>{usageLabel}</span>
    </div>
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
      className={`rounded-[16px] border px-4 py-3 text-sm leading-6 ${
        tone === "error"
          ? "border-[rgba(255,110,110,0.18)] bg-[rgba(255,110,110,0.08)] text-[rgb(255,186,186)]"
          : "border-white/8 bg-white/[0.03] text-slate-400"
      }`}
    >
      {message}
    </div>
  );
}

function SectionDivider() {
  return (
    <div className="px-4 sm:px-6">
      <div className="mx-auto max-w-7xl border-t border-white/8" />
    </div>
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
    <div className="mt-10 overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] shadow-[0_26px_80px_rgba(4,8,24,0.3)]">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3 sm:px-5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
        <div className="ml-auto text-xs text-slate-500">LaunchRoast report preview</div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
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
                className="grid gap-3 rounded-[20px] border border-white/8 bg-[#0b1020]/82 p-4 sm:grid-cols-[150px_minmax(0,1fr)]"
              >
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {row.label}
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-slate-500 line-through decoration-white/20">
                    {row.before}
                  </p>
                  <p className="text-sm leading-6 text-white">{row.after}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="border-t border-white/8 bg-[#0a0f1b]/94 p-5 lg:border-l lg:border-t-0 sm:p-6">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
            Report sidebar
          </p>
          <div className="mt-4 space-y-4">
            <SidebarStat label="Main issue" value="Outcome too soft above the fold" />
            <SidebarStat label="Pricing" value="Context appears too late" />
            <SidebarStat label="Trust" value="Legal and contact cues need stronger visibility" />
            <SidebarStat label="Launch readiness" value="Close, but still leaking confidence" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PreviewMetric({ label, score }: { label: string; score: number }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-[#0b1020]/82 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white">
        {score}
        <span className="text-sm text-slate-500">/100</span>
      </p>
    </div>
  );
}

function SidebarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
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
    <div id="results" className="print-surface mt-8 space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="print-card rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
          >
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/8" />
            <div className="mt-4 h-8 w-20 animate-pulse rounded-2xl bg-white/8" />
            <div className="mt-4 h-3 w-3/4 animate-pulse rounded-full bg-white/8" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="print-card rounded-[24px] border border-white/8 bg-white/[0.03] p-5"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 animate-pulse rounded-full bg-white/8" />
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

function MetricCard({
  label,
  score,
  description,
}: {
  label: string;
  score: number;
  description: string;
}) {
  return (
    <div className="print-card rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.032),rgba(255,255,255,0.018))] p-5">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-3 flex items-end gap-2">
        <p className="text-[2rem] font-semibold tracking-[-0.04em] text-white">{score}</p>
        <span className="pb-1 text-sm text-slate-500">/100</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

function ReportCard({
  title,
  value,
  isCopied,
  onCopy,
}: {
  title: string;
  value: string;
  isCopied: boolean;
  onCopy: () => void;
}) {
  return (
    <section className="print-card rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">{title}</h3>
        <CopyButton isCopied={isCopied} onCopy={onCopy} />
      </div>
      <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-300">{value}</p>
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
    <section className="print-card rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.018))] p-5 xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-white">
            Trust &amp; Safety Review
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Passive trust-signal feedback based on the page or copy provided.
          </p>
        </div>
        <CopyButton isCopied={isCopied} onCopy={onCopy} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="rounded-[20px] border border-white/8 bg-[#0b1020]/84 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Trust score</p>
          <p className="mt-2 text-[2.4rem] font-semibold tracking-[-0.04em] text-white">
            {review.trustScore}
            <span className="text-sm text-slate-500">/100</span>
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <TrustField label="HTTPS feedback" value={review.httpsFeedback} />
          <TrustField
            label="Privacy & terms feedback"
            value={review.privacyTermsFeedback}
          />
          <TrustField
            label="Contact transparency"
            value={review.contactTransparencyFeedback}
          />
          <TrustField label="Data handling" value={review.dataHandlingFeedback} />
          <div className="md:col-span-2">
            <TrustField
              label="Security claims feedback"
              value={review.securityClaimsFeedback}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[20px] border border-white/8 bg-[#0b1020]/74 p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
          Recommended fixes
        </p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-300">
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
    <div className="rounded-[18px] border border-white/8 bg-[#0b1020]/74 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{value}</p>
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
      className={`rounded-[12px] border px-3 py-1.5 text-xs font-medium transition duration-200 ${
        isCopied
          ? "border-[rgba(123,136,255,0.38)] bg-[rgba(123,136,255,0.14)] text-white"
          : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/16 hover:bg-white/[0.05] hover:text-white"
      }`}
    >
      {isCopied ? "Copied" : "Copy"}
    </button>
  );
}

function PricingCard({
  tier,
  starterPaymentUrl,
  proPaymentUrl,
  onStartFree,
  onOpenPaymentLink,
}: {
  tier: (typeof pricingTiers)[number];
  starterPaymentUrl: string;
  proPaymentUrl: string;
  onStartFree: () => void;
  onOpenPaymentLink: (url: string, plan: "starter" | "pro") => void;
}) {
  const paymentUrl =
    tier.plan === "starter"
      ? starterPaymentUrl
      : tier.plan === "pro"
        ? proPaymentUrl
        : "";

  const isPaymentPlan = tier.plan === "starter" || tier.plan === "pro";
  const isDisabledPayment = isPaymentPlan && !paymentUrl;

  return (
    <div
      className={`rounded-[28px] border p-1 ${
        tier.featured
          ? "border-[rgba(123,136,255,0.22)] bg-[linear-gradient(180deg,rgba(123,136,255,0.12),rgba(255,255,255,0.02))]"
          : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex h-full flex-col rounded-[24px] bg-[#0a0f1b]/92 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.02em] text-white">
              {tier.name}
            </h3>
            <p className="mt-2 text-sm text-slate-400">{tier.description}</p>
          </div>
          {tier.featured ? (
            <span className="rounded-full border border-[rgba(123,136,255,0.24)] bg-[rgba(123,136,255,0.12)] px-3 py-1 text-xs text-[rgb(204,210,255)]">
              Recommended
            </span>
          ) : null}
        </div>

        <p className="mt-8 text-[2rem] font-semibold tracking-[-0.04em] text-white">
          {tier.price}
        </p>
        <p className="mt-4 flex-1 text-sm leading-7 text-slate-400">{tier.subcopy}</p>

        <button
          type="button"
          onClick={() => {
            if (tier.plan === "free") {
              onStartFree();
              return;
            }

            if (paymentUrl) {
              onOpenPaymentLink(paymentUrl, tier.plan);
            }
          }}
          disabled={isDisabledPayment}
          className={`mt-8 inline-flex items-center justify-center rounded-[14px] px-4 py-3 text-sm font-semibold transition duration-200 ${
            tier.featured
              ? "bg-[linear-gradient(135deg,#7d8dff_0%,#6d74ff_100%)] text-white shadow-[0_16px_42px_rgba(83,93,255,0.26)] hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(83,93,255,0.32)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
              : "border border-white/10 bg-white/[0.03] text-white hover:border-white/16 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
          }`}
        >
          {isDisabledPayment ? "Payment link coming soon" : tier.cta}
        </button>
      </div>
    </div>
  );
}

function MiniPlan({
  name,
  description,
  price,
  actionLabel,
  disabled,
  onClick,
}: {
  name: string;
  description: string;
  price: string;
  actionLabel: string;
  disabled: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-[#0b1020]/82 px-4 py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{name}</p>
          <p className="text-sm text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium text-white">{price}</p>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-white/16 hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-white/10 disabled:hover:bg-white/[0.03]"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
