export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
export const POSTHOG_PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
export const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

export const GA_ENABLED =
  Boolean(GA_MEASUREMENT_ID) &&
  (process.env.NODE_ENV === "production" || ANALYTICS_DEBUG);

export const POSTHOG_ENABLED =
  Boolean(POSTHOG_PROJECT_TOKEN) &&
  (process.env.NODE_ENV === "production" || ANALYTICS_DEBUG);

export const ANALYTICS_ENABLED = GA_ENABLED || POSTHOG_ENABLED;

export function isAnalyticsBlockedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function setGaDisableFlag(disabled: boolean): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
}
