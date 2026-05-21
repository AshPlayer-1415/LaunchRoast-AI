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
          heading: "Status checks",
          body:
            "For public URLs, LaunchRoast AI may run a passive website status check to report reachability, HTTP response details, redirects, HTTPS usage, and response timing. It does not run vulnerability scans or exploit testing.",
        },
        {
          heading: "Contact",
          body:
            "Publish a clear support contact before launch so users have a reliable path for questions about acceptable use, policies, or service expectations.",
        },
      ]}
    />
  );
}
