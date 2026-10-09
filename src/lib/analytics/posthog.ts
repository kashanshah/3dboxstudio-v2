import type { PostHog } from "posthog-js";
import { getConsentState, onConsentChange } from "./consent";
import { POSTHOG_ENABLED, isAnalyticsBlockedPath } from "./policy";

type Properties = Record<string, string | number | boolean>;
type PostHogCall = (posthog: PostHog) => void;

// posthog-js is downloaded by instrumentation-client only after consent, so
// calls made before it has started wait here, and are dropped on decline.
const MAX_PENDING_CALLS = 50;
let client: PostHog | null = null;
const pendingCalls: PostHogCall[] = [];

onConsentChange(state => {
  if (state === "denied") pendingCalls.length = 0;
});

export function setPostHogClient(posthog: PostHog): void {
  client = posthog;
  for (const call of pendingCalls.splice(0)) {
    try { call(posthog); } catch { /* Collection is best effort. */ }
  }
}

export function withPostHog(call: PostHogCall): void {
  if (typeof window === "undefined") return;
  if (client) call(client);
  else if (getConsentState() !== "denied" && pendingCalls.length < MAX_PENDING_CALLS) pendingCalls.push(call);
}

export function capturePostHog(eventName: string, properties: Properties = {}): void {
  if (!POSTHOG_ENABLED || typeof window === "undefined") return;
  if (isAnalyticsBlockedPath(window.location.pathname)) return;
  withPostHog(posthog => posthog.capture(eventName, properties));
}
