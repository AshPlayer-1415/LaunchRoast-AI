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
    "Check if your website is ready to launch. LaunchRoast AI reviews clarity, trust signals, launch readiness, and live website status for public URLs.",
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
      "Paste a live URL or draft copy and get an AI roast, launch-readiness report, trust-signal review, and live website status check.",
    url: "https://launchroast.ai",
    siteName: "LaunchRoast AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaunchRoast AI",
    description:
      "Check whether your website is live, clear, trustworthy, and ready to share.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("launchroast-theme");document.documentElement.dataset.theme=t==="neon"?"neon":"dark";}catch(e){document.documentElement.dataset.theme="dark";}',
          }}
        />
        <AnalyticsProvider />
        {children}
      </body>
    </html>
  );
}
