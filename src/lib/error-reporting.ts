// Sends errors in the visitor's browser to Admin → Errors (POST /api/errors).
// Only errors from this site's own scripts: extensions, translators and
// other sites' scripts are left out, and so are the hydration errors a
// translator causes by rewriting the page. A few per page at most, each once.

export const CLIENT_ERROR_KINDS = ['uncaught_error', 'unhandled_rejection', 'studio_view_crashed'] as const;
export type ClientErrorKind = typeof CLIENT_ERROR_KINDS[number];

const MAX_PER_PAGE = 5;
const IGNORED = /ResizeObserver loop|^Script error\.?$/i;
// React's hydration mismatch errors (minified in production).
const HYDRATION = /Minified React error #(418|423|425)\b|Hydration failed|error while hydrating/i;

/**
 * Whether a browser translator has rewritten the page: Google Translate marks
 * <html translated-ltr/rtl> and wraps text in <font>, Microsoft's (Edge) adds
 * _msttexthash attributes. Translated text no longer matches what React
 * rendered, so React rebuilds it and reports a hydration error that is not a
 * fault in the site.
 */
export function isPageTranslated(doc: Document = document) {
  return /\btranslated-(ltr|rtl)\b/.test(doc.documentElement.className)
    || doc.documentElement.hasAttribute('_msttexthash')
    || Boolean(doc.querySelector('[_msttexthash], [_mstmutation], font[style*="vertical-align: inherit"]'));
}

let sent = 0;
const seen = new Set<string>();

function ownScript(url: unknown) {
  return typeof url === 'string' && url.startsWith(`${window.location.origin}/_next/`);
}
function ownStack(stack: unknown) {
  return typeof stack === 'string' && stack.includes(`${window.location.origin}/_next/`);
}

export function reportClientError(kind: ClientErrorKind, error: unknown, details: Record<string, string | number | boolean> = {}) {
  if (typeof window === 'undefined' || sent >= MAX_PER_PAGE) return;
  const err = error instanceof Error ? error : null;
  const message = (err ? err.message : String(error ?? '')).slice(0, 500);
  if (!message || IGNORED.test(message)) return;
  if (HYDRATION.test(message) && isPageTranslated()) return;
  const key = `${kind}\0${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent += 1;
  const body = JSON.stringify({
    kind,
    message,
    path: window.location.pathname,
    details: { ...details, ...(err ? { name: err.name } : {}), ...(err?.stack ? { stack: err.stack.split('\n').slice(0, 8).join('\n') } : {}) },
  });
  void fetch('/api/errors', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
}

let installed = false;
export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', event => {
    if (!ownScript(event.filename) && !ownStack(event.error?.stack)) return;
    reportClientError('uncaught_error', event.error ?? event.message, event.lineno ? { line: event.lineno, column: event.colno } : {});
  });
  window.addEventListener('unhandledrejection', event => {
    if (!(event.reason instanceof Error) || !ownStack(event.reason.stack)) return;
    reportClientError('unhandled_rejection', event.reason);
  });
}
