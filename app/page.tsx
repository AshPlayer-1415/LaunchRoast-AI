import type { Metadata } from "next";
import { LaunchRoastApp } from "@/components/launchroast-app";

export const metadata: Metadata = {
  title: "Website Launch Readiness Checker",
  description:
    "Paste your website URL or draft copy and get a structured roast with launch-readiness feedback, trust suggestions, and a live status check for public URLs.",
};

export default function HomePage() {
  return <LaunchRoastApp />;
}
