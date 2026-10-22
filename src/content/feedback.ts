// Site feedback: what visitors tell us from the Studio and the dieline
// generator, wherever they are stuck or missing something, not only after an
// export worked. The kinds, the place it was sent from and the checks the
// form and the API share. Messages are stored with the contact messages
// (kind 'site_feedback') and emailed to the admin.

export const FEEDBACK_KINDS = [
  { value: 'problem', label: 'Something went wrong', prompt: 'What happened, and what did you expect?' },
  { value: 'request', label: 'A box or size I need', prompt: 'Which box, size or option do you need? What is it for?' },
  { value: 'idea', label: 'An idea', prompt: 'What would make this more useful for you?' },
  { value: 'other', label: 'Something else', prompt: 'Tell us anything.' },
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['value'];

/** Facts about where the form was opened (style, size, error), shown to the visitor and sent with the message. */
export type FeedbackContext = Record<string, string | number>;

export type FeedbackRequest = {
  kind: FeedbackKind;
  message: string;
  email: string | null;
  /** Where it was sent from, e.g. 'studio-header' or 'generator-size-error'. */
  source: string;
  pagePath: string | null;
  context: FeedbackContext;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks a message; returns it cleaned, or the first problem in words for the form. */
export function parseFeedback(body: unknown): { ok: true; request: FeedbackRequest } | { ok: false; error: string } {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const kind = FEEDBACK_KINDS.find(item => item.value === input.kind)?.value;
  if (!kind) return { ok: false, error: 'Choose what your message is about.' };
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!message) return { ok: false, error: 'Write a few words so we know what to look at.' };
  if (message.length > 3000) return { ok: false, error: 'Keep the message under 3,000 characters.' };
  const rawEmail = typeof input.email === 'string' ? input.email.trim() : '';
  if (rawEmail && (rawEmail.length > 254 || !EMAIL.test(rawEmail))) return { ok: false, error: 'Check the email address, or leave it empty.' };
  const source = typeof input.source === 'string' && /^[a-z0-9-]{1,60}$/.test(input.source) ? input.source : 'unknown';
  const pagePath = typeof input.pagePath === 'string' && /^\/(?!\/)[^\s]{0,300}$/.test(input.pagePath) ? input.pagePath : null;
  // A few short facts at most; anything else is dropped rather than refused.
  const context: FeedbackContext = {};
  const raw = input.context && typeof input.context === 'object' ? input.context as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(raw).slice(0, 12)) {
    if (!/^[a-zA-Z_]{1,40}$/.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) context[key] = value;
    else if (typeof value === 'string' && value.trim()) context[key] = value.trim().slice(0, 300);
  }
  return { ok: true, request: { kind, message, email: rawEmail || null, source, pagePath, context } };
}

export const feedbackKindLabel = (kind: FeedbackKind) => FEEDBACK_KINDS.find(item => item.value === kind)?.label ?? kind;

/** The message as labelled lines, for the stored message and the admin email. */
export function feedbackLines(request: FeedbackRequest, account: string | null): [string, string][] {
  return [
    ['About', feedbackKindLabel(request.kind)],
    ['Message', request.message],
    ['Reply to', request.email ?? account ?? 'No email given'],
    ...(account ? [['Account', account] as [string, string]] : []),
    ['Sent from', request.source],
    ['Page', request.pagePath ?? '—'],
    ...Object.entries(request.context).map(([key, value]) => [key.replace(/_/g, ' '), String(value)] as [string, string]),
  ];
}
