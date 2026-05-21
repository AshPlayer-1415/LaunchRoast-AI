import type { Metadata } from "next";
import { AnalyticsProvider } from "@/components/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://launchroast.ai"),
  title: {
    default: "LaunchRoast AI",
    template: "%s | LaunchRoast AI",
  },
  description:
    "Fix your landing page before users bounce. LaunchRoast AI audits your messaging, CTA, pricing, and trust signals in minutes.",
  applicationName: "LaunchRoast AI",
  category: "business",
  keywords: [
    "landing page audit",
    "SaaS copy critique",
    "startup marketing",
    "conversion copywriting",
    "website roast",
  ],
  authors: [{ name: "LaunchRoast AI" }],
  creator: "LaunchRoast AI",
  publisher: "LaunchRoast AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "LaunchRoast AI",
    description:
      "Paste your startup page and get a clarity score, CTA rewrite, pricing feedback, and stronger landing page copy.",
    url: "https://launchroast.ai",
    siteName: "LaunchRoast AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaunchRoast AI",
    description:
      "Audit your landing page for clarity, conversion, pricing, and trust before users bounce.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
