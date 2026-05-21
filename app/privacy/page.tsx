import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Read how LaunchRoast AI handles audit requests, local usage tracking, and optional third-party support links.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Policy"
      title="Privacy"
      intro="LaunchRoast AI keeps the current product intentionally simple. The notes below explain how request handling, local usage tracking, and optional support links work in this version."
      alternateHref="/terms"
      alternateLabel="Terms"
      sections={[
        {
          heading: "What we store",
          body:
            "We store a small audit usage counter in localStorage for basic product feedback and a lighter repeat-use experience. Submitted landing page URLs or copy are processed for the current audit request, and a fuller production policy should describe logging, retention, and processor details more explicitly before launch.",
        },
        {
          heading: "How audit requests are handled",
          body:
            "Audit requests are sent to the app server route. If OPENROUTER_API_KEY is configured, the request may be forwarded to OpenRouter for live AI analysis. If no API key is configured, the app falls back to a local mock response instead of failing the request.",
        },
        {
          heading: "Optional support",
          body:
            "The app does not collect card details or process payments directly. If a support link is configured, it opens an external page so visitors can optionally support the project outside the app.",
        },
        {
          heading: "Contact",
          body:
            "For now, use the placeholder contact email support@launchroast.ai until a real support address is ready. Replace it before launch so visitors have a clear path for deletion requests, policy questions, or data handling concerns.",
        },
      ]}
    />
  );
}
