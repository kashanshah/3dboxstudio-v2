import type { FeedbackContext, FeedbackKind } from '@/content/feedback';

// Opening the feedback form from anywhere: a component asks with an event
// and the FeedbackHost in the root layout answers, so the form's code loads
// only when someone opens it.

export const FEEDBACK_OPEN_EVENT = '3dbs:feedback-open';
export const FEEDBACK_OFFER_EVENT = '3dbs:feedback-offer';

export type FeedbackOpen = {
  /** Where it was opened, e.g. 'studio-header'; lower case and dashes. */
  source: string;
  kind?: FeedbackKind;
  /** A question to ask instead of the kind's own. */
  prompt?: string;
  context?: FeedbackContext;
};

/** Opens the feedback form. */
export function openFeedback(detail: FeedbackOpen) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<FeedbackOpen>(FEEDBACK_OPEN_EVENT, { detail }));
}

/** After something failed: a small card offering the form, which the visitor can ignore. */
export function offerFeedback(detail: FeedbackOpen & { title: string }) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(FEEDBACK_OFFER_EVENT, { detail }));
}
