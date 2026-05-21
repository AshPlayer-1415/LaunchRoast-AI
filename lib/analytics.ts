type AnalyticsPayload = Record<string, string | number | boolean | null | undefined>;

function logAnalytics(event: string, payload?: AnalyticsPayload) {
  // Replace this with your analytics SDK later. The placeholder stays silent in
  // production so deployment is safe before a real provider is chosen.
  if (process.env.NODE_ENV !== "production") {
    console.info("[analytics]", event, payload ?? {});
  }
}

export function trackPageView(pathname: string) {
  logAnalytics("page_view", { pathname });
}

export function trackEvent(event: string, payload?: AnalyticsPayload) {
  logAnalytics(event, payload);
}
