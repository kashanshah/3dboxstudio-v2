import { sendGaEvent } from "./gtag";
import { capturePostHog } from "./posthog";
import { getConsentState, onConsentChange } from "./consent";
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

const MAX_PENDING_EVENTS = 50;
/** `posthog: false` sends to GA4 only, for events PostHog already receives from the server. */
export type TrackOptions = { posthog?: boolean };
const pendingEvents: Array<[string, Record<string, unknown>, TrackOptions]> = [];

onConsentChange((state) => {
  const queued = pendingEvents.splice(0);
  if (state === "granted") for (const [eventName, properties, options] of queued) sendEvent(eventName, properties, options);
});

export function trackEvent(eventName: string, properties: Record<string, unknown> = {}, options: TrackOptions = {}): void {
  if (!ANALYTICS_ENABLED || typeof window === "undefined") return;
  if (isAnalyticsBlockedPath(window.location.pathname)) return;
  const consent = getConsentState();
  if (consent === "denied") return;
  if (consent === "pending") {
    if (pendingEvents.length < MAX_PENDING_EVENTS) pendingEvents.push([eventName, properties, options]);
    return;
  }
  sendEvent(eventName, properties, options);
}

function sendEvent(eventName: string, properties: Record<string, unknown>, options: TrackOptions = {}): void {
  if (ANALYTICS_DEBUG) {
    // eslint-disable-next-line no-console
    console.debug("[Analytics]", eventName, properties);
  }

  // Analytics must never turn a successful save/upload/export into a UI error.
  if (GA_ENABLED) {
    try { sendGaEvent(eventName, properties); } catch { /* Collection is best effort. */ }
  }

  if (POSTHOG_ENABLED && options.posthog !== false) {
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
