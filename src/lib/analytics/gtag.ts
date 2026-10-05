import { ANALYTICS_DEBUG, GA_ENABLED, GA_MEASUREMENT_ID, isAnalyticsBlockedPath } from "./policy";
import { getConsentState, onConsentChange } from "./consent";

type GtagWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: (...args: unknown[]) => void;
};

let configured = false;

function getWindow(): GtagWindow | undefined {
  return typeof window === "undefined" ? undefined : (window as GtagWindow);
}

export function ensureGtagInitialized(): boolean {
  const w = getWindow();
  if (!w || !GA_ENABLED || isAnalyticsBlockedPath(w.location.pathname)) return false;

  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }

  if (configured) return true;
  // Consent Mode v2: no advertising use, analytics storage only after consent.
  w.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: getConsentState() === "granted" ? "granted" : "denied",
  });
  w.gtag("js", new Date());
  w.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: false,
    ...(ANALYTICS_DEBUG ? { debug_mode: true } : {}),
  });
  configured = true;
  return true;
}

export function sendGaEvent(eventName: string, properties: Record<string, unknown> = {}): void {
  const w = getWindow();
  if (!w || !ensureGtagInitialized()) return;
  w.gtag?.("event", eventName, properties);
}

onConsentChange((state) => {
  const w = getWindow();
  w?.gtag?.("consent", "update", { analytics_storage: state === "granted" ? "granted" : "denied" });
});
