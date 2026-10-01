import posthog from "posthog-js";
import { POSTHOG_ENABLED, isAnalyticsBlockedPath } from "./policy";

type Properties = Record<string, string | number | boolean>;

export function capturePostHog(eventName: string, properties: Properties = {}): void {
  if (!POSTHOG_ENABLED || typeof window === "undefined") return;
  if (isAnalyticsBlockedPath(window.location.pathname)) return;
  posthog.capture(eventName, properties);
}
