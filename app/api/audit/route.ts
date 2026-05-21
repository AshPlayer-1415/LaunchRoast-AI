import { NextResponse } from "next/server";
import {
  isAuditInputType,
  isValidHttpUrl,
  type AuditInputType,
  type AuditRequestBody,
  type AuditResponseBody,
  type AuditResult,
  type TrustSafetyReview,
} from "@/lib/audit";
import { generateMockAudit } from "@/lib/mock-audit";

export const runtime = "nodejs";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "openrouter/free";
const MAX_SOURCE_CHARS = 6000;

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

  const mockAudit = generateMockAudit({
    inputType: parsedBody.inputType,
    content: parsedBody.content,
    url: parsedBody.inputType === "url" ? parsedBody.content : undefined,
  });

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
      if (error.status >= 500) {
        return buildMockResponse(mockAudit, "We could not fetch that URL, so this audit is using fallback heuristics.");
      }

      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return buildMockResponse(mockAudit, "We could not fetch that URL, so this audit is using fallback heuristics.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return buildMockResponse(
      generateMockAudit({
        inputType: parsedBody.inputType,
        content: preparation.contentForAudit,
        url: preparation.url,
      }),
      combineWarnings(preparation.warning, "OPENROUTER_API_KEY is not set, so this audit is using the local fallback."),
    );
  }

  try {
    const { audit, model } = await generateOpenRouterAudit({
      inputType: parsedBody.inputType,
      content: preparation.contentForAudit,
      url: preparation.url,
    });

    const responseBody: AuditResponseBody = {
      audit,
      model,
      source: "openrouter",
      warning: preparation.warning,
    };

    return NextResponse.json(responseBody);
  } catch {
    return buildMockResponse(
      generateMockAudit({
        inputType: parsedBody.inputType,
        content: preparation.contentForAudit,
        url: preparation.url,
      }),
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
    };
  }

  const parsedUrl = new URL(rawUrl);

  if (!isPublicHostname(parsedUrl.hostname)) {
    throw new AuditRouteError("Please enter a public http(s) URL. Local and private network addresses are not supported.");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;

    try {
      response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          "User-Agent": "LaunchRoastAI/1.0",
        },
        redirect: "follow",
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new AuditRouteError("Failed to fetch landing page content.", 502);
    }

    const finalUrl = new URL(response.url);

    if (!isPublicHostname(finalUrl.hostname)) {
      throw new AuditRouteError("The destination URL is not a supported public landing page.", 400);
    }

    const html = await response.text();
    const extractedText = extractPageText(html);

    if (!extractedText) {
      return {
        contentForAudit: rawUrl,
        url: finalUrl.toString(),
        warning: "We fetched the page, but could not extract enough visible copy. This audit is using a lighter fallback.",
      };
    }

    return {
      contentForAudit: extractedText.slice(0, MAX_SOURCE_CHARS),
      url: finalUrl.toString(),
    };
  } catch (error) {
    if (error instanceof AuditRouteError) {
      throw error;
    }

    throw new AuditRouteError("Failed to fetch landing page content.", 502);
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
}: {
  inputType: AuditRequestBody["inputType"];
  content: string;
  url?: string;
}) {
  // This request contract is intentionally isolated so model, prompt, and routing
  // can be swapped later without changing the UI or route response shape.
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
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
          content: buildAuditPrompt({ inputType, content, url }),
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
    model: payload.model ?? OPENROUTER_MODEL,
  };
}

function buildAuditPrompt({
  inputType,
  content,
  url,
}: {
  inputType: AuditInputType;
  content: string;
  url?: string;
}) {
  if (inputType === "url" && url) {
    return [
      "Audit this startup landing page using the extracted visible copy below.",
      `Source URL: ${url}`,
      "",
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
