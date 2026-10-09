// The session cookie is httpOnly, so pages cannot tell whether a visitor is
// signed in without asking /api/auth/me. This readable cookie is set and cleared
// with the session so anonymous visitors skip that request. It is only a hint:
// the server never trusts it.
export const SIGNED_IN_HINT_COOKIE = "3dbs_signed_in";

// Sessions created before the hint existed have no hint. Each browser asks
// /api/auth/me once without one; any later sign-in sets the hint itself.
// Sessions last 30 days, so this check can go 30 days after the hint shipped.
const SESSION_CHECKED_KEY = "3dbs_session_checked";

export function hasSignedInHint(): boolean {
  return typeof document !== "undefined" && document.cookie.split(/;\s*/).includes(`${SIGNED_IN_HINT_COOKIE}=1`);
}

export function shouldCheckSession(): boolean {
  if (hasSignedInHint()) return true;
  try { return window.localStorage.getItem(SESSION_CHECKED_KEY) !== "1"; } catch { return true; }
}

export function markSessionChecked(): void {
  try { window.localStorage.setItem(SESSION_CHECKED_KEY, "1"); } catch { /* Private mode. */ }
}
