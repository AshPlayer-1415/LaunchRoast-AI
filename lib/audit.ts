export type AuditInputType = "url" | "copy";

export type AuditRequestBody = {
  inputType: AuditInputType;
  content: string;
};

export type TrustSafetyReview = {
  trustScore: number;
  httpsFeedback: string;
  privacyTermsFeedback: string;
  contactTransparencyFeedback: string;
  dataHandlingFeedback: string;
  securityClaimsFeedback: string;
  recommendedFixes: string[];
};

export type WebsiteStatus = {
  checked: boolean;
  inputUrl: string;
  finalUrl?: string;
  isOnline: boolean;
  statusCode?: number;
  statusText?: string;
  responseTimeMs?: number;
  redirected: boolean;
  redirectCount?: number;
  usesHttps: boolean;
  error?: string;
};

export type AuditResult = {
  clarityScore: number;
  mainProblem: string;
  headlineRewrite: string;
  ctaRewrite: string;
  pricingFeedback: string;
  trustSuggestions: string;
  finalLandingCopy: string;
  trustSafetyReview: TrustSafetyReview;
  websiteStatus?: WebsiteStatus;
};

export type AuditResponseBody = {
  audit: AuditResult;
  source: "mock" | "openrouter";
  warning?: string;
  model?: string;
};

export type AuditErrorResponse = {
  error: string;
};

export function getScoreSummary(score: number) {
  if (score >= 85) {
    return "Clear value prop, now tighten the proof.";
  }

  if (score >= 70) {
    return "Solid base, but conversion friction is still visible.";
  }

  if (score >= 55) {
    return "Visitors will understand pieces of it, not the whole pitch.";
  }

  return "The message feels vague before it feels valuable.";
}

export function isAuditInputType(value: unknown): value is AuditInputType {
  return value === "url" || value === "copy";
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
