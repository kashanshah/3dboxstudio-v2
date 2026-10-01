import { ANALYTICS_DEBUG, GA_MEASUREMENT_ID } from "./policy";

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
  if (!w || !GA_MEASUREMENT_ID) return false;

  w.dataLayer = w.dataLayer ?? [];
  if (!w.gtag) {
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
  }

  if (configured) return true;
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
  if (!w || !GA_MEASUREMENT_ID) return;
  ensureGtagInitialized();
  w.gtag?.("event", eventName, properties);
}
