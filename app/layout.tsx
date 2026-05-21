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
    "Roast your landing page before customers do. LaunchRoast AI reviews clarity, CTA strength, offer friction, and trust signals in minutes.",
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
      "Paste a homepage or draft copy and get a structured review of clarity, CTA strength, offer friction, and trust signals.",
    url: "https://launchroast.ai",
    siteName: "LaunchRoast AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaunchRoast AI",
    description:
      "Audit your landing page for clarity, conversion, offer friction, and trust before users bounce.",
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
