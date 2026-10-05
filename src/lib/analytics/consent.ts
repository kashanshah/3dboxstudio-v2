// Analytics consent. Visitors where opt-in consent is required (EEA, UK,
// Switzerland) choose in a banner; elsewhere analytics is on unless the visitor
// opts out in Cookie settings. Until a decision is known nothing is sent:
// events wait in a small queue and are sent or dropped once it resolves.

export type ConsentDecision = "granted" | "denied";
export type ConsentState = ConsentDecision | "pending";

export const CONSENT_STORAGE_KEY = "3dbs_analytics_consent";
export const CONSENT_REGION_STORAGE_KEY = "3dbs_consent_region";
export const OPEN_CONSENT_SETTINGS_EVENT = "3dbs:open-cookie-settings";

type Listener = (state: ConsentState) => void;

const listeners = new Set<Listener>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readStoredConsent(): ConsentDecision | null {
  const value = storage()?.getItem(CONSENT_STORAGE_KEY);
  return value === "granted" || value === "denied" ? value : null;
}

export function readStoredConsentRegion(): "required" | "not_required" | null {
  const value = storage()?.getItem(CONSENT_REGION_STORAGE_KEY);
  return value === "required" || value === "not_required" ? value : null;
}

export function storeConsentRegion(required: boolean): void {
  try { storage()?.setItem(CONSENT_REGION_STORAGE_KEY, required ? "required" : "not_required"); } catch { /* Private mode. */ }
}

/** An explicit choice wins; otherwise visitors outside consent regions are opted in. */
export function initialConsentState(): ConsentState {
  return readStoredConsent() ?? (readStoredConsentRegion() === "not_required" ? "granted" : "pending");
}

let state: ConsentState = initialConsentState();

export function getConsentState(): ConsentState {
  return state;
}

/** Record a decision. `remember` stores it, so the banner does not ask again. */
export function setConsentState(next: ConsentDecision, remember = true): void {
  if (remember) {
    try { storage()?.setItem(CONSENT_STORAGE_KEY, next); } catch { /* Private mode. */ }
  }
  if (state === next) return;
  state = next;
  for (const listener of listeners) listener(next);
}

export function onConsentChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function openCookieSettings(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_CONSENT_SETTINGS_EVENT));
}
