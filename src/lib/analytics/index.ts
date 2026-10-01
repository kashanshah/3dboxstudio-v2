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

  if (GA_ENABLED) sendGaEvent(eventName, properties);

  if (POSTHOG_ENABLED) {
    const safe: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        safe[key] = value;
      }
    }
    capturePostHog(eventName, safe);
  }
}
