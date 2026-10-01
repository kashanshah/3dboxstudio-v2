import { POSTHOG_ENABLED, isAnalyticsBlockedPath } from "./policy";

type Properties = Record<string, string | number | boolean>;

type PostHogClient = {
  capture?: (eventName: string, properties?: Properties) => void;
};

type PostHogWindow = Window & {
  posthog?: PostHogClient;
  __posthogCaptureQueue?: Array<[string, Properties]>;
};

export function capturePostHog(eventName: string, properties: Properties = {}): void {
  if (!POSTHOG_ENABLED || typeof window === "undefined") return;
  if (isAnalyticsBlockedPath(window.location.pathname)) return;

  const w = window as PostHogWindow;
  if (typeof w.posthog?.capture === "function") {
    w.posthog.capture(eventName, properties);
    return;
  }

  w.__posthogCaptureQueue = w.__posthogCaptureQueue ?? [];
  w.__posthogCaptureQueue.push([eventName, properties]);
}
