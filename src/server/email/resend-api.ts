// Resend's API, or a local stand-in for the browser tests
// (e2e/support/services.mjs) when RESEND_API_URL is set. Never set in production.
export function resendApiUrl(path: string): string {
  return `${process.env.RESEND_API_URL?.trim().replace(/\/+$/, '') || 'https://api.resend.com'}${path}`;
}
