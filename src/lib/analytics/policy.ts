export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
export const POSTHOG_PROJECT_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim() ?? "";
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ?? "";
export const ANALYTICS_DEBUG = process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true";

export const GA_ENABLED =
  Boolean(GA_MEASUREMENT_ID) &&
  (process.env.NODE_ENV === "production" || ANALYTICS_DEBUG);

export const POSTHOG_ENABLED =
  Boolean(POSTHOG_PROJECT_TOKEN) &&
  (process.env.NODE_ENV === "production" || ANALYTICS_DEBUG);

export const ANALYTICS_ENABLED = GA_ENABLED || POSTHOG_ENABLED;

// Customer artwork is served only to the signed-in owner. Session replay renders
// recordings off-site without that session, so recorded artwork could never be
// shown there and every replay request for it failed with a 401. Blocking these
// elements also keeps customer artwork out of recordings.
const PRIVATE_MEDIA_PATHS = ["/api/media/", "/api/legacy-designs/", "/api/admin/"];

export const REPLAY_BLOCK_SELECTOR = PRIVATE_MEDIA_PATHS
  .flatMap(path => [`[src*="${path}"]`, `[srcset*="${path}"]`, `[style*="${path}"]`])
  .join(", ");

// Password-reset and email-verification links carry single-use secrets in the
// query string. They must never reach analytics, replays or referrers.
const SECRET_QUERY_PARAM = /([?&](?:token)=)[^&#]*/gi;

/** Replaces secret query values in a full URL or a path?query string. */
export function redactUrl(value: string): string {
  return value.replace(SECRET_QUERY_PARAM, "$1[redacted]");
}

export function isAnalyticsBlockedPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function setGaDisableFlag(disabled: boolean): void {
  if (typeof window === "undefined" || !GA_MEASUREMENT_ID) return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
}
