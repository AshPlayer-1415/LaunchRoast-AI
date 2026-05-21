import { getScoreSummary, type AuditInputType, type AuditResult } from "@/lib/audit";

type PdfSource = "mock" | "openrouter";

export type ExportAuditPdfOptions = {
  audit: AuditResult;
  source: PdfSource;
  model?: string | null;
  inputType: AuditInputType;
  submittedContent: string;
  generatedAt: string;
};

const PAGE_MARGIN = 54;
const ROW_GAP = 12;
const SECTION_GAP = 18;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

const COLORS = {
  ink: [24, 28, 34] as const,
  body: [62, 69, 80] as const,
  muted: [103, 112, 126] as const,
  border: [218, 223, 230] as const,
  panel: [249, 250, 252] as const,
  panelStrong: [242, 245, 249] as const,
  accent: [73, 88, 193] as const,
  success: [33, 137, 96] as const,
  error: [180, 78, 78] as const,
};

function formatPdfDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getAuditSubject(inputType: AuditInputType, submittedContent: string) {
  if (inputType === "copy") {
    return "Draft copy audit";
  }

  try {
    const parsed = new URL(submittedContent);
    return parsed.toString();
  } catch {
    return submittedContent;
  }
}

function getPdfFileName(inputType: AuditInputType, submittedContent: string) {
  if (inputType === "copy") {
    return "launchroast-report-draft-copy.pdf";
  }

  try {
    const parsed = new URL(submittedContent);
    const hostname = parsed.hostname.replace(/^www\./, "").replace(/[^a-z0-9.-]/gi, "-");
    return `launchroast-report-${hostname || "website"}.pdf`;
  } catch {
    return "launchroast-report.pdf";
  }
}

function normalizeTextBlock(text: string) {
  return text.replace(/\r\n/g, "\n").trim();
}

export async function exportAuditReportPdf({
  audit,
  source,
  model,
  inputType,
  submittedContent,
  generatedAt,
}: ExportAuditPdfOptions) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    compress: true,
  });

  let cursorY = PAGE_MARGIN;

  const ensureSpace = (height: number) => {
    if (cursorY + height <= PAGE_HEIGHT - PAGE_MARGIN) {
      return;
    }

    doc.addPage();
    cursorY = PAGE_MARGIN;
  };

  const drawRule = () => {
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(1);
    doc.line(PAGE_MARGIN, cursorY, PAGE_WIDTH - PAGE_MARGIN, cursorY);
    cursorY += 18;
  };

  const drawWrappedText = ({
    text,
    x,
    y,
    width,
    font = "helvetica",
    style = "normal",
    size = 11,
    lineHeight = 16,
    color = COLORS.body,
  }: {
    text: string;
    x: number;
    y: number;
    width: number;
    font?: "helvetica" | "times";
    style?: "normal" | "bold";
    size?: number;
    lineHeight?: number;
    color?: readonly number[];
  }) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, width);
    doc.text(lines, x, y);
    return lines.length * lineHeight;
  };

  const drawLabel = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(label.toUpperCase(), PAGE_MARGIN, cursorY);
    cursorY += 16;
  };

  const drawSectionHeading = (title: string) => {
    ensureSpace(40);
    drawLabel(title);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
    doc.text(title, PAGE_MARGIN, cursorY);
    cursorY += 18;
  };

  const drawParagraphBlock = (title: string, body: string) => {
    const text = normalizeTextBlock(body);
    const textLines = doc.splitTextToSize(text, CONTENT_WIDTH - 28);
    const lineHeight = 15;
    const blockHeight = 18 + 18 + textLines.length * lineHeight + 24;
    ensureSpace(blockHeight);

    drawSectionHeading(title);
    const blockY = cursorY;
    doc.setFillColor(COLORS.panel[0], COLORS.panel[1], COLORS.panel[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(PAGE_MARGIN, blockY, CONTENT_WIDTH, textLines.length * lineHeight + 24, 10, 10, "FD");
    cursorY += 18;
    drawWrappedText({
      text,
      x: PAGE_MARGIN + 14,
      y: cursorY,
      width: CONTENT_WIDTH - 28,
      size: 11,
      lineHeight,
      color: COLORS.body,
    });
    cursorY = blockY + textLines.length * lineHeight + 24 + SECTION_GAP;
  };

  const drawBulletBlock = (title: string, bullets: string[]) => {
    const prepared = bullets.map((item) => doc.splitTextToSize(item, CONTENT_WIDTH - 52));
    const bulletsHeight =
      prepared.reduce((sum, lines) => sum + lines.length * 15 + 6, 0) + 18;
    const blockHeight = 18 + 18 + bulletsHeight + 20;
    ensureSpace(blockHeight);

    drawSectionHeading(title);
    const blockY = cursorY;
    doc.setFillColor(COLORS.panel[0], COLORS.panel[1], COLORS.panel[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(PAGE_MARGIN, blockY, CONTENT_WIDTH, bulletsHeight + 18, 10, 10, "FD");
    cursorY += 18;

    prepared.forEach((lines) => {
      doc.setFillColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
      doc.circle(PAGE_MARGIN + 18, cursorY - 4, 2, "F");
      drawWrappedText({
        text: lines.join("\n"),
        x: PAGE_MARGIN + 30,
        y: cursorY,
        width: CONTENT_WIDTH - 44,
        size: 11,
        lineHeight: 15,
        color: COLORS.body,
      });
      cursorY += lines.length * 15 + 6;
    });

    cursorY = blockY + bulletsHeight + 18 + SECTION_GAP;
  };

  const drawKeyValueBlock = (
    title: string,
    rows: Array<{ label: string; value: string; tone?: "default" | "positive" | "error" }>,
  ) => {
    const prepared = rows.map((row) => ({
      ...row,
      lines: doc.splitTextToSize(row.value, CONTENT_WIDTH - 176),
    }));
    const rowsHeight =
      prepared.reduce((sum, row) => sum + Math.max(20, row.lines.length * 14) + 14, 0) + 12;
    const blockHeight = 18 + 18 + rowsHeight + 20;
    ensureSpace(blockHeight);

    drawSectionHeading(title);
    const blockY = cursorY;
    doc.setFillColor(COLORS.panel[0], COLORS.panel[1], COLORS.panel[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(PAGE_MARGIN, blockY, CONTENT_WIDTH, rowsHeight + 18, 10, 10, "FD");
    cursorY += 18;

    prepared.forEach((row, index) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
      doc.text(row.label.toUpperCase(), PAGE_MARGIN + 14, cursorY);

      const toneColor =
        row.tone === "positive"
          ? COLORS.success
          : row.tone === "error"
            ? COLORS.error
            : COLORS.body;

      drawWrappedText({
        text: row.lines.join("\n"),
        x: PAGE_MARGIN + 150,
        y: cursorY,
        width: CONTENT_WIDTH - 164,
        size: 11,
        lineHeight: 14,
        color: toneColor,
      });

      cursorY += Math.max(20, row.lines.length * 14) + 14;

      if (index < prepared.length - 1) {
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.line(PAGE_MARGIN + 14, cursorY - 7, PAGE_MARGIN + CONTENT_WIDTH - 14, cursorY - 7);
      }
    });

    cursorY = blockY + rowsHeight + 18 + SECTION_GAP;
  };

  const drawSummaryCards = (
    cards: Array<{
      label: string;
      value: string;
      detail: string;
      tone?: "default" | "positive";
    }>,
  ) => {
    const cardWidth = (CONTENT_WIDTH - ROW_GAP) / 2;
    let index = 0;

    while (index < cards.length) {
      const rowCards = cards.slice(index, index + 2);
      const measured = rowCards.map((card) => {
        const detailLines = doc.splitTextToSize(card.detail, cardWidth - 24);
        return { card, detailLines, height: 88 + detailLines.length * 13 };
      });
      const rowHeight = Math.max(...measured.map((item) => item.height));
      ensureSpace(rowHeight);

      measured.forEach((item, columnIndex) => {
        const x = PAGE_MARGIN + columnIndex * (cardWidth + ROW_GAP);
        doc.setFillColor(COLORS.panelStrong[0], COLORS.panelStrong[1], COLORS.panelStrong[2]);
        doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
        doc.roundedRect(x, cursorY, cardWidth, rowHeight, 12, 12, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
        doc.text(item.card.label.toUpperCase(), x + 14, cursorY + 18);

        const valueColor =
          item.card.tone === "positive" ? COLORS.success : COLORS.ink;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        doc.text(item.card.value, x + 14, cursorY + 44);

        drawWrappedText({
          text: item.card.detail,
          x: x + 14,
          y: cursorY + 65,
          width: cardWidth - 24,
          size: 10,
          lineHeight: 13,
          color: COLORS.body,
        });
      });

      cursorY += rowHeight + ROW_GAP;
      index += 2;
    }
  };

  const summaryCards = [
    ...(audit.websiteStatus
      ? [
          {
            label: "Website status",
            value: audit.websiteStatus.isOnline ? "Online" : "Down",
            detail: audit.websiteStatus.responseTimeMs
              ? `${audit.websiteStatus.responseTimeMs}ms response`
              : audit.websiteStatus.error ?? "Status unavailable",
            tone: audit.websiteStatus.isOnline ? ("positive" as const) : ("default" as const),
          },
        ]
      : []),
    {
      label: "Clarity score",
      value: `${audit.clarityScore}/100`,
      detail: getScoreSummary(audit.clarityScore),
      tone: "default" as const,
    },
    {
      label: "Trust score",
      value: `${audit.trustSafetyReview.trustScore}/100`,
      detail: "Passive read of visible trust and safety signals.",
      tone: "default" as const,
    },
    {
      label: "CTA strength",
      value: `${getCtaStrengthScore(audit)}/100`,
      detail: "A quick read on action clarity and momentum.",
      tone: "default" as const,
    },
  ];

  const subject = getAuditSubject(inputType, submittedContent);
  const dateLabel = formatPdfDate(generatedAt);

  doc.setFillColor(250, 249, 246);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");
  drawLabel("LaunchRoast AI");
  drawWrappedText({
    text: "Website Launch Readiness Report",
    x: PAGE_MARGIN,
    y: cursorY + 12,
    width: CONTENT_WIDTH,
    font: "times",
    style: "bold",
    size: 27,
    lineHeight: 30,
    color: COLORS.ink,
  });
  cursorY += 42;
  drawWrappedText({
    text: subject,
    x: PAGE_MARGIN,
    y: cursorY,
    width: CONTENT_WIDTH,
    size: 11,
    lineHeight: 16,
    color: COLORS.body,
  });
  cursorY += subject.length > 72 ? 34 : 20;

  drawKeyValueBlock("Report details", [
    { label: "Generated", value: dateLabel },
    { label: "Audit type", value: inputType === "url" ? "Website URL audit" : "Draft copy audit" },
    { label: "Output source", value: source === "openrouter" ? "Live AI response" : "Mock fallback" },
    ...(model ? [{ label: "Model", value: model }] : []),
  ]);

  drawRule();
  drawSectionHeading("Summary");
  drawSummaryCards(summaryCards);
  cursorY += 6;

  if (audit.websiteStatus) {
    drawKeyValueBlock("Website status details", [
      {
        label: "Availability",
        value: audit.websiteStatus.isOnline ? "Online" : "Down",
        tone: audit.websiteStatus.isOnline ? "positive" : "error",
      },
      {
        label: "HTTP status",
        value: audit.websiteStatus.statusCode
          ? `${audit.websiteStatus.statusCode}${audit.websiteStatus.statusText ? ` ${audit.websiteStatus.statusText}` : ""}`
          : "Unavailable",
      },
      {
        label: "Response time",
        value: audit.websiteStatus.responseTimeMs
          ? `${audit.websiteStatus.responseTimeMs}ms`
          : "Unavailable",
      },
      {
        label: "HTTPS",
        value: audit.websiteStatus.usesHttps ? "Yes" : "No",
      },
      {
        label: "Redirected",
        value: audit.websiteStatus.redirected
          ? `Yes${typeof audit.websiteStatus.redirectCount === "number" ? `, ${audit.websiteStatus.redirectCount} hop${audit.websiteStatus.redirectCount === 1 ? "" : "s"}` : ""}`
          : "No redirect was needed.",
      },
      {
        label: "Final URL",
        value: audit.websiteStatus.finalUrl ?? audit.websiteStatus.inputUrl,
      },
      ...(audit.websiteStatus.error
        ? [
            {
              label: "Status note",
              value: audit.websiteStatus.error,
              tone: "error" as const,
            },
          ]
        : []),
    ]);
  }

  drawParagraphBlock("Main issue", audit.mainProblem);
  drawParagraphBlock("Headline rewrite", audit.headlineRewrite);
  drawParagraphBlock("CTA rewrite", audit.ctaRewrite);
  drawParagraphBlock("Offer feedback", audit.pricingFeedback);

  drawKeyValueBlock("Trust & Safety Review", [
    {
      label: "Trust score",
      value: `${audit.trustSafetyReview.trustScore}/100`,
      tone: "default",
    },
    { label: "HTTPS feedback", value: audit.trustSafetyReview.httpsFeedback },
    {
      label: "Privacy & terms",
      value: audit.trustSafetyReview.privacyTermsFeedback,
    },
    {
      label: "Contact transparency",
      value: audit.trustSafetyReview.contactTransparencyFeedback,
    },
    { label: "Data handling", value: audit.trustSafetyReview.dataHandlingFeedback },
    {
      label: "Security claims",
      value: audit.trustSafetyReview.securityClaimsFeedback,
    },
  ]);

  drawBulletBlock("Recommended fixes", audit.trustSafetyReview.recommendedFixes);
  drawParagraphBlock("Trust suggestions", audit.trustSuggestions);
  drawParagraphBlock("Final copy", audit.finalLandingCopy);

  doc.save(getPdfFileName(inputType, submittedContent));
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
