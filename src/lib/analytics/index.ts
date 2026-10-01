import { sendGaEvent } from "./gtag";
import { capturePostHog } from "./posthog";
import {
  ANALYTICS_DEBUG,
  ANALYTICS_ENABLED,
  GA_ENABLED,
  POSTHOG_ENABLED,
  isAnalyticsBlockedPath,
} from "./policy";

export {
  ANALYTICS_DEBUG,
  ANALYTICS_ENABLED,
  GA_ENABLED,
  POSTHOG_ENABLED,
  isAnalyticsBlockedPath,
};

export function trackEvent(eventName: string, properties: Record<string, unknown> = {}): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (isAnalyticsBlockedPath(window.location.pathname)) return;

  if (ANALYTICS_DEBUG) {
    // eslint-disable-next-line no-console
    console.debug("[Analytics]", eventName, properties);
  }

  // Analytics must never turn a successful save/upload/export into a UI error.
  if (GA_ENABLED) {
    try { sendGaEvent(eventName, properties); } catch { /* Collection is best effort. */ }
  }

  if (POSTHOG_ENABLED) {
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safe[key] = value;
      }
    }
    if (eventName === "page_view") {
      // PostHog web analytics recognizes $pageview, not GA4's page_view.
      if (typeof safe.page_location === "string") safe.$current_url = safe.page_location;
      if (typeof safe.page_path === "string") safe.$pathname = safe.page_path.split("?")[0];
      if (typeof safe.page_title === "string") safe.$title = safe.page_title;
      if (typeof safe.page_referrer === "string") safe.$referrer = safe.page_referrer;
    }
    try { capturePostHog(eventName === "page_view" ? "$pageview" : eventName, safe); }
    catch { /* Collection is best effort. */ }
  }
}
