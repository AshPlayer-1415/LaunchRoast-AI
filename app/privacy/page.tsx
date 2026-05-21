import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "Read how LaunchRoast AI handles audit requests, local usage tracking, and passive website status checks.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      eyebrow="Policy"
      title="Privacy"
      intro="LaunchRoast AI keeps the current product intentionally simple. The notes below explain how request handling, local usage tracking, and passive website status checks work in this version."
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
          heading: "Website status checks",
          body:
            "For public URLs, the app can run a passive availability check to confirm whether the page is reachable, whether it redirects, whether HTTPS is used, and how long the request takes. It does not scan vulnerabilities, probe hidden paths, or inspect private networks.",
        },
        {
          heading: "Contact",
          body:
            "Publish a clear support contact before launch so visitors have a reliable path for deletion requests, policy questions, or data handling concerns.",
        },
      ]}
    />
  );
}
