import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Review the placeholder terms for using LaunchRoast AI during this early free version.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Policy"
      title="Terms"
      intro="These terms are still simple placeholder copy for the current product stage. Replace them with reviewed legal language before you add user accounts, enterprise commitments, or any formal commercial offering."
      alternateHref="/privacy"
      alternateLabel="Privacy"
      sections={[
        {
          heading: "Service scope",
          body:
            "LaunchRoast AI provides structured landing page feedback, rewrite suggestions, and trust-signal observations. Outputs are informational and should be reviewed by a human before publication.",
        },
        {
          heading: "Acceptable use",
          body:
            "Do not use the service to submit unlawful material, abuse third-party systems, or attempt to inspect private or internal URLs you do not own or control.",
        },
        {
          heading: "Availability",
          body:
            "The product may rely on third-party AI providers and public web fetching. Availability, latency, and output quality can vary based on those dependencies.",
        },
        {
          heading: "Optional support",
          body:
            "LaunchRoast AI is free to use in this early version. If an external support link is added, any optional support happens off-site and is not processed inside the app.",
        },
        {
          heading: "Contact",
          body:
            "For now, use the placeholder contact email support@launchroast.ai until a real support address is available. Replace it before launch so users have a clear support path.",
        },
      ]}
    />
  );
}
