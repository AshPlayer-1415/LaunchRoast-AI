import { NextResponse } from "next/server";
import {
  isAuditInputType,
  isValidHttpUrl,
  type AuditInputType,
  type AuditRequestBody,
  type AuditResponseBody,
  type AuditResult,
  type TrustSafetyReview,
  type WebsiteStatus,
} from "@/lib/audit";
import { generateMockAudit } from "@/lib/mock-audit";

export const runtime = "nodejs";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openrouter/free";
const MAX_SOURCE_CHARS = 6000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;

type OpenRouterChatResponse = {
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type FetchPreparation = {
  contentForAudit: string;
  warning?: string;
  url?: string;
  websiteStatus?: WebsiteStatus;
};

class AuditRouteError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  let parsedBody: AuditRequestBody;

  try {
    parsedBody = parseAuditRequest(body);
  } catch (error) {
    if (error instanceof AuditRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: "Invalid audit request." }, { status: 400 });
  }

  let preparation: FetchPreparation = {
    contentForAudit: parsedBody.content,
  };

  try {
    preparation =
      parsedBody.inputType === "url"
        ? await prepareUrlAuditContent(parsedBody.content)
        : { contentForAudit: parsedBody.content };
  } catch (error) {
    if (error instanceof AuditRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: "Unable to process that audit request right now." },
      { status: 500 },
    );
  }

  const mockAudit = generateMockAudit({
    inputType: parsedBody.inputType,
    content: preparation.contentForAudit,
    url: preparation.url,
    websiteStatus: preparation.websiteStatus,
  });

  if (!process.env.OPENROUTER_API_KEY) {
    return buildMockResponse(
      mockAudit,
      combineWarnings(preparation.warning, "Live AI is not configured, so this audit is using the local fallback."),
    );
  }

  try {
    const { audit, model } = await generateOpenRouterAudit({
      inputType: parsedBody.inputType,
      content: preparation.contentForAudit,
      url: preparation.url,
      websiteStatus: preparation.websiteStatus,
    });

    const responseBody: AuditResponseBody = {
      audit: attachWebsiteStatus(audit, preparation.websiteStatus),
      model,
      source: "openrouter",
      warning: preparation.warning,
    };

    return NextResponse.json(responseBody);
  } catch {
    return buildMockResponse(
      mockAudit,
      combineWarnings(
        preparation.warning,
        "The live AI audit failed, so this result is using the local fallback.",
      ),
    );
  }
}

function parseAuditRequest(body: unknown): AuditRequestBody {
  if (!body || typeof body !== "object") {
    throw new AuditRouteError("Request body must be an object.");
  }

  const { inputType, content } = body as Partial<AuditRequestBody>;

  if (!isAuditInputType(inputType)) {
    throw new AuditRouteError('`inputType` must be either "url" or "copy".');
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AuditRouteError("Please enter a URL or landing page copy before generating an audit.");
  }

  return {
    inputType,
    content: content.trim(),
  };
}

async function prepareUrlAuditContent(rawUrl: string): Promise<FetchPreparation> {
  if (!isValidHttpUrl(rawUrl)) {
    return {
      contentForAudit: rawUrl,
      warning: "This does not look like a valid URL. We analyzed the text you pasted instead.",
      websiteStatus: {
        checked: false,
        inputUrl: rawUrl,
        isOnline: false,
        redirected: false,
        usesHttps: false,
        error: "Invalid URL format.",
      },
    };
  }

  const parsedUrl = new URL(rawUrl);

  if (!isPublicHostname(parsedUrl.hostname)) {
    throw new AuditRouteError("Please enter a public http(s) URL. Local and private network addresses are not supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    let currentUrl = parsedUrl;
    let redirectCount = 0;
    let response: Response | null = null;

    while (redirectCount <= MAX_REDIRECTS) {
      response = await fetch(currentUrl.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "LaunchRoastAI/1.0",
        },
        redirect: "manual",
      });

      if (!isRedirectStatus(response.status)) {
        break;
      }

      const location = response.headers.get("location");
      if (!location) {
        break;
      }

      const redirectedUrl = new URL(location, currentUrl);
      if (!isPublicHostname(redirectedUrl.hostname)) {
        throw new AuditRouteError("The destination URL is not a supported public landing page.", 400);
      }

      currentUrl = redirectedUrl;
      redirectCount += 1;
    }

    if (!response) {
      throw new Error("No response returned.");
    }

    if (redirectCount > MAX_REDIRECTS) {
      throw new Error("Too many redirects.");
    }

    const finalUrl = new URL(currentUrl.toString());
    const responseTimeMs = Date.now() - startedAt;
    const websiteStatus: WebsiteStatus = {
      checked: true,
      inputUrl: rawUrl,
      finalUrl: redirectCount > 0 ? finalUrl.toString() : undefined,
      isOnline: response.status >= 200 && response.status < 400,
      statusCode: response.status,
      statusText: response.statusText || undefined,
      responseTimeMs,
      redirected: redirectCount > 0,
      redirectCount,
      usesHttps: finalUrl.protocol === "https:",
    };

    if (!websiteStatus.isOnline) {
      return {
        contentForAudit: rawUrl,
        url: finalUrl.toString(),
        websiteStatus,
        warning: `The website responded with HTTP ${response.status}, so the audit is using lighter fallback heuristics for the live page copy.`,
      };
    }

    const html = await response.text();
    const extractedText = extractPageText(html);

    if (!extractedText) {
      return {
        contentForAudit: rawUrl,
        url: finalUrl.toString(),
        websiteStatus,
        warning: "We reached the page, but could not extract enough visible copy. This audit is using a lighter fallback.",
      };
    }

    return {
      contentForAudit: extractedText.slice(0, MAX_SOURCE_CHARS),
      url: finalUrl.toString(),
      websiteStatus,
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startedAt;

    if (error instanceof AuditRouteError) {
      throw error;
    }

    return {
      contentForAudit: rawUrl,
      url: parsedUrl.toString(),
      websiteStatus: {
        checked: true,
        inputUrl: rawUrl,
        isOnline: false,
        redirected: false,
        usesHttps: parsedUrl.protocol === "https:",
        responseTimeMs,
        error: getStatusErrorMessage(error),
      },
      warning: "We could not reach that live URL, so the audit is using fallback heuristics for the page content.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractPageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isPublicHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "::1"
  ) {
    return false;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const octets = normalized.split(".").map(Number);
    const [a, b] = octets;

    if (a === 10 || a === 127 || a === 0) {
      return false;
    }
    if (a === 169 && b === 254) {
      return false;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return false;
    }
    if (a === 192 && b === 168) {
      return false;
    }
  }

  return true;
}

async function generateOpenRouterAudit({
  inputType,
  content,
  url,
  websiteStatus,
}: {
  inputType: AuditRequestBody["inputType"];
  content: string;
  url?: string;
  websiteStatus?: WebsiteStatus;
}) {
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
  // This request contract is intentionally isolated so model, prompt, and routing
  // can be swapped later without changing the UI or route response shape.
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a conversion-focused landing page auditor for startups and SaaS companies. Return valid JSON only. Do not wrap JSON in markdown. Use exactly these top-level keys: clarityScore, mainProblem, headlineRewrite, ctaRewrite, pricingFeedback, trustSuggestions, finalLandingCopy, trustSafetyReview. trustSafetyReview must be an object with exactly these keys: trustScore, httpsFeedback, privacyTermsFeedback, contactTransparencyFeedback, dataHandlingFeedback, securityClaimsFeedback, recommendedFixes. clarityScore and trustScore must be integers from 0 to 100. trustSuggestions should be a newline-separated string of concise recommendations. recommendedFixes must be an array of short strings. Keep the trustSafetyReview passive and non-invasive. Focus only on trust signals and basic safety signals visible from the page or copy. Do not mention hacking, penetration testing, vulnerability scanning, SQL injection, XSS payloads, ports, admin paths, login forms, or exploit behavior.",
        },
        {
          role: "user",
          content: buildAuditPrompt({ inputType, content, url, websiteStatus }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("OpenRouter request failed.");
  }

  const payload = (await response.json()) as OpenRouterChatResponse;
  const rawContent = getChoiceContent(payload);
  const parsed = JSON.parse(rawContent);
  return {
    audit: validateAuditResult(parsed),
    model: payload.model ?? model,
  };
}

function buildAuditPrompt({
  inputType,
  content,
  url,
  websiteStatus,
}: {
  inputType: AuditInputType;
  content: string;
  url?: string;
  websiteStatus?: WebsiteStatus;
}) {
  if (inputType === "url" && url) {
    const statusContext = websiteStatus
      ? [
          "Website status context:",
          `- Checked: ${websiteStatus.checked ? "yes" : "no"}`,
          `- Online: ${websiteStatus.isOnline ? "yes" : "no"}`,
          websiteStatus.statusCode ? `- HTTP status: ${websiteStatus.statusCode}` : undefined,
          websiteStatus.responseTimeMs
            ? `- Response time: ${websiteStatus.responseTimeMs}ms`
            : undefined,
          `- HTTPS: ${websiteStatus.usesHttps ? "yes" : "no"}`,
          `- Redirected: ${websiteStatus.redirected ? "yes" : "no"}`,
          websiteStatus.finalUrl ? `- Final URL: ${websiteStatus.finalUrl}` : undefined,
          websiteStatus.error ? `- Status error: ${websiteStatus.error}` : undefined,
          "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    return [
      "Audit this startup landing page using the extracted visible copy below.",
      `Source URL: ${url}`,
      "",
      statusContext,
      "Extracted landing page text:",
      content,
      "",
      "Return only the JSON object.",
    ].join("\n");
  }

  return [
    "Audit this startup landing page copy.",
    "",
    "Landing page copy:",
    content,
    "",
    "Return only the JSON object.",
  ].join("\n");
}

function getChoiceContent(payload: OpenRouterChatResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error("OpenRouter returned an empty response.");
}

function validateAuditResult(value: unknown): AuditResult {
  if (!value || typeof value !== "object") {
    throw new Error("Audit response was not an object.");
  }

  const audit = value as Partial<AuditResult>;
  const requiredStringFields: Array<
    | "mainProblem"
    | "headlineRewrite"
    | "ctaRewrite"
    | "pricingFeedback"
    | "trustSuggestions"
    | "finalLandingCopy"
  > = [
    "mainProblem",
    "headlineRewrite",
    "ctaRewrite",
    "pricingFeedback",
    "trustSuggestions",
    "finalLandingCopy",
  ];

  if (!Number.isInteger(audit.clarityScore) || audit.clarityScore! < 0 || audit.clarityScore! > 100) {
    throw new Error("Audit response did not include a valid clarityScore.");
  }

  for (const field of requiredStringFields) {
    if (typeof audit[field] !== "string" || audit[field]!.trim().length === 0) {
      throw new Error(`Audit response did not include a valid ${field}.`);
    }
  }

  const clarityScore = audit.clarityScore as number;
  const mainProblem = audit.mainProblem as string;
  const headlineRewrite = audit.headlineRewrite as string;
  const ctaRewrite = audit.ctaRewrite as string;
  const pricingFeedback = audit.pricingFeedback as string;
  const trustSuggestions = audit.trustSuggestions as string;
  const finalLandingCopy = audit.finalLandingCopy as string;
  const trustSafetyReview = validateTrustSafetyReview(audit.trustSafetyReview);

  return {
    clarityScore,
    mainProblem: mainProblem.trim(),
    headlineRewrite: headlineRewrite.trim(),
    ctaRewrite: ctaRewrite.trim(),
    pricingFeedback: pricingFeedback.trim(),
    trustSuggestions: trustSuggestions.trim(),
    finalLandingCopy: finalLandingCopy.trim(),
    trustSafetyReview,
  };
}

function attachWebsiteStatus(audit: AuditResult, websiteStatus?: WebsiteStatus): AuditResult {
  if (!websiteStatus) {
    return audit;
  }

  return {
    ...audit,
    websiteStatus,
  };
}

function validateTrustSafetyReview(value: unknown): TrustSafetyReview {
  if (!value || typeof value !== "object") {
    throw new Error("Audit response did not include a valid trustSafetyReview.");
  }

  const review = value as Partial<TrustSafetyReview>;
  const stringFields: Array<
    keyof Omit<TrustSafetyReview, "trustScore" | "recommendedFixes">
  > = [
    "httpsFeedback",
    "privacyTermsFeedback",
    "contactTransparencyFeedback",
    "dataHandlingFeedback",
    "securityClaimsFeedback",
  ];

  if (!Number.isInteger(review.trustScore) || review.trustScore! < 0 || review.trustScore! > 100) {
    throw new Error("Audit response did not include a valid trustSafetyReview.trustScore.");
  }

  for (const field of stringFields) {
    if (typeof review[field] !== "string" || review[field]!.trim().length === 0) {
      throw new Error(`Audit response did not include a valid trustSafetyReview.${field}.`);
    }
  }

  if (
    !Array.isArray(review.recommendedFixes) ||
    review.recommendedFixes.length === 0 ||
    review.recommendedFixes.some(
      (item) => typeof item !== "string" || item.trim().length === 0,
    )
  ) {
    throw new Error("Audit response did not include a valid trustSafetyReview.recommendedFixes.");
  }

  return {
    trustScore: review.trustScore as number,
    httpsFeedback: (review.httpsFeedback as string).trim(),
    privacyTermsFeedback: (review.privacyTermsFeedback as string).trim(),
    contactTransparencyFeedback: (review.contactTransparencyFeedback as string).trim(),
    dataHandlingFeedback: (review.dataHandlingFeedback as string).trim(),
    securityClaimsFeedback: (review.securityClaimsFeedback as string).trim(),
    recommendedFixes: review.recommendedFixes.map((item) => item.trim()),
  };
}

function buildMockResponse(audit: AuditResult, warning?: string) {
  const responseBody: AuditResponseBody = {
    audit,
    source: "mock",
    warning,
  };

  return NextResponse.json(responseBody);
}

function combineWarnings(...warnings: Array<string | undefined>) {
  const filtered = warnings.filter(Boolean);
  return filtered.length > 0 ? filtered.join(" ") : undefined;
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function getStatusErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "The request timed out before the website responded.";
    }

    if (error.message === "Too many redirects.") {
      return "The website redirected too many times to complete a status check.";
    }
  }

  return "The website could not be reached during the status check.";
}
