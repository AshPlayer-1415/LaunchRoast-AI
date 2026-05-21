import type { AuditInputType, AuditResult, TrustSafetyReview } from "@/lib/audit";

export type MockAuditRequest = {
  inputType: AuditInputType;
  content: string;
  url?: string;
};

const fillerWords = new Set([
  "revolutionary",
  "innovative",
  "cutting-edge",
  "seamless",
  "powerful",
  "best-in-class",
  "world-class",
]);

const trustIdeas = [
  "Add one specific customer outcome with a measurable result near the hero.",
  "Show recognizable logos or a short proof strip above the fold.",
  "Include a founder, team, or product screenshot so the page feels real.",
  "Answer the first objection directly with a short FAQ near pricing.",
];

function normalizeInput(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function getDomainLabel(rawInput: string, url?: string) {
  try {
    const urlToParse = url ?? rawInput;
    const parsedUrl = new URL(urlToParse);
    return parsedUrl.hostname.replace(/^www\./, "");
  } catch {
    return "your product";
  }
}

function sentenceCount(input: string) {
  return input
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function detectFillerCount(input: string) {
  return input
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => fillerWords.has(word)).length;
}

function buildTrustSafetyReview({
  inputType,
  normalized,
  url,
}: {
  inputType: AuditInputType;
  normalized: string;
  url?: string;
}): TrustSafetyReview {
  const lower = normalized.toLowerCase();
  const hasHttps = url ? url.startsWith("https://") : /https|secure/i.test(normalized);
  const hasPrivacy = /privacy|gdpr|ccpa|policy/i.test(lower);
  const hasTerms = /terms|conditions/i.test(lower);
  const hasContact = /contact|email|support|hello@|founder|team/i.test(lower);
  const hasDataHandling = /data|storage|stored|encrypted|retention|compliance|processor/i.test(
    lower,
  );
  const hasSecurityClaims = /security|soc 2|soc2|iso 27001|encryption|access control/i.test(
    lower,
  );

  let trustScore = 74;

  if (!hasHttps && inputType === "url") {
    trustScore -= 10;
  }
  if (!hasPrivacy) {
    trustScore -= 8;
  }
  if (!hasTerms) {
    trustScore -= 6;
  }
  if (!hasContact) {
    trustScore -= 7;
  }
  if (!hasDataHandling) {
    trustScore -= 6;
  }
  if (!hasSecurityClaims) {
    trustScore -= 4;
  }

  trustScore = Math.max(48, Math.min(96, trustScore));

  const httpsFeedback =
    hasHttps
      ? "The page gives a basic secure-transport signal, which helps visitors feel safer sharing details."
      : "There is no clear HTTPS trust signal in the material provided. If the live page is secure, make sure that confidence is not undermined by mixed messaging or unclear browser cues.";

  const privacyTermsFeedback =
    hasPrivacy || hasTerms
      ? "You show at least part of the legal trust layer. Make privacy and terms links easy to spot in the footer and near any form that asks for visitor data."
      : "Privacy and terms signals are either missing or too hard to notice. Visitors often look for these pages as a basic credibility check before converting.";

  const contactTransparencyFeedback =
    hasContact
      ? "There is some visible contact or team transparency, which helps the company feel more accountable and real."
      : "The page could do more to show who is behind the product. A visible contact email, support path, or team signal would reduce hesitation.";

  const dataHandlingFeedback =
    hasDataHandling
      ? "The copy hints at how customer data is handled, which is useful. Tighten this with a short plain-English note about what is collected and why."
      : "Data handling expectations are not obvious yet. Add a short explanation of what visitor or customer data you collect, where it is used, and when it is retained.";

  const securityClaimsFeedback =
    hasSecurityClaims
      ? "You mention security-oriented trust signals, which is good. Keep the claims specific and support them with simple proof rather than broad reassurance."
      : "Security reassurance is light. If security matters to your buyers, add modest, specific trust signals like encryption, access controls, or compliance status without over-claiming.";

  const recommendedFixes = [
    !hasPrivacy || !hasTerms
      ? "Add visible Privacy and Terms links in the footer and near any lead capture form."
      : "Keep Privacy and Terms links visible in the footer and beside data collection points.",
    !hasContact
      ? "Show a support email, contact page, or founder/team signal so the company feels reachable."
      : "Strengthen contact transparency with a clear support path or response expectation.",
    !hasDataHandling
      ? "Add a short plain-English data handling note that explains what is collected and why."
      : "Clarify data usage in one concise sentence close to signup or demo forms.",
    !hasSecurityClaims
      ? "Use simple security trust signals only where relevant, and avoid vague claims that sound inflated."
      : "Back up any security claims with specific details or a link to supporting documentation.",
  ];

  return {
    trustScore,
    httpsFeedback,
    privacyTermsFeedback,
    contactTransparencyFeedback,
    dataHandlingFeedback,
    securityClaimsFeedback,
    recommendedFixes,
  };
}

export function generateMockAudit({
  inputType,
  content,
  url,
}: MockAuditRequest): AuditResult {
  const normalized = normalizeInput(content);
  const words = normalized.split(" ").filter(Boolean);
  const domainLabel = getDomainLabel(normalized, url);
  const fillerCount = detectFillerCount(normalized);
  const sentences = sentenceCount(normalized);
  const mentionPricing = /\$|price|pricing|plan|month|annual/i.test(normalized);
  const mentionOutcome = /save|grow|reduce|book|convert|ship|close|automate/i.test(
    normalized,
  );

  let score = 78;

  if (words.length < 18) {
    score -= 10;
  }
  if (words.length > 150) {
    score -= 7;
  }
  if (sentences > 8) {
    score -= 5;
  }
  if (fillerCount > 0) {
    score -= Math.min(fillerCount * 4, 12);
  }
  if (!mentionPricing) {
    score -= 6;
  }
  if (!mentionOutcome) {
    score -= 8;
  }

  score = Math.max(42, Math.min(96, score));

  const mainProblem =
    inputType === "url"
      ? `The page likely explains ${domainLabel}, but it probably does not state the buyer outcome fast enough. Visitors need a concrete reason to care in the first screen.`
      : "The copy describes the product, but the outcome, urgency, and proof are not doing enough work together. The message needs a sharper promise and fewer generic claims.";

  const headlineRewrite =
    inputType === "url"
      ? `Turn ${domainLabel} into the obvious choice with a headline that promises a concrete result.`
      : "Show the outcome first: what the user gets, how fast, and why it beats the old way.";

  const ctaRewrite =
    inputType === "url"
      ? "Get my landing page roast"
      : "See the stronger version";

  const pricingFeedback = mentionPricing
    ? "Your pricing is at least present, which lowers uncertainty. Make the cheapest plan easier to compare, state who each plan is for, and attach one tangible outcome to each tier."
    : "The page needs pricing context earlier. Even if you do not show full numbers, signal starting price, who the offer is for, or what determines cost so visitors do not assume the worst.";

  const trustSuggestions = trustIdeas.join("\n");
  const trustSafetyReview = buildTrustSafetyReview({
    inputType,
    normalized,
    url,
  });

  const finalLandingCopy = [
    "Headline",
    `Fix the message leak before visitors bounce from ${domainLabel}.`,
    "",
    "Subheadline",
    "Get an instant landing page roast with a clarity score, stronger headline, sharper CTA, pricing feedback, and trust fixes your team can ship today.",
    "",
    "Primary CTA",
    "Roast My Page",
    "",
    "Proof strip",
    "Built for founders, SaaS marketers, and product teams tightening conversion before spending more on traffic.",
    "",
    "Pricing nudge",
    "Try one free audit, then upgrade when you want more iterations.",
  ].join("\n");

  return {
    clarityScore: score,
    mainProblem,
    headlineRewrite,
    ctaRewrite,
    pricingFeedback,
    trustSuggestions,
    finalLandingCopy,
    trustSafetyReview,
  };
}
