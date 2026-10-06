/**
 * New Google accounts are created in a server redirect, so the callback leaves
 * this short-lived cookie for the next page to report GA4's `sign_up` event.
 * PostHog already receives `user_signed_up` from the server.
 */
export const SIGNUP_COOKIE = "3dbs_signup";
export const SIGNUP_COOKIE_MAX_AGE = 600;

export function readSignupCookie(cookie: string): "google" | null {
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${SIGNUP_COOKIE}=`))?.slice(SIGNUP_COOKIE.length + 1);
  return value === "google" ? "google" : null;
}
