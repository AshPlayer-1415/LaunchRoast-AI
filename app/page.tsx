import type { Metadata } from "next";
import { LaunchRoastApp } from "@/components/launchroast-app";

export const metadata: Metadata = {
  title: "Landing Page Audit Tool",
  description:
    "Paste your landing page URL or copy and get a structured roast with clearer messaging, CTA rewrites, pricing feedback, and trust suggestions.",
};

export default function HomePage() {
  return <LaunchRoastApp />;
}
