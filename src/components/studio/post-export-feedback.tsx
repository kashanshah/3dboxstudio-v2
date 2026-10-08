"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { capturePostHog } from "@/lib/analytics/posthog";
import "./post-export-feedback.css";

export const POST_EXPORT_FEEDBACK_EVENT = "3dbs:export-success";
const LAST_PROMPT_KEY = "3dbs_feedback_last_prompt_v1";
const RATED_KEY = "3dbs_feedback_rated_v1";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

type ExportDetail = { format?: string; templateId?: string };
function getStorage(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function store(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* Storage may be unavailable. */ }
}

export function PostExportFeedback() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const context = useRef<ExportDetail>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onExport = (event: Event) => {
      if (getStorage(RATED_KEY)) return;
      const last = Number(getStorage(LAST_PROMPT_KEY) || "0");
      if (last > 0 && Date.now() - last < THIRTY_DAYS) return;
      context.current = (event as CustomEvent<ExportDetail>).detail ?? {};
      store(LAST_PROMPT_KEY, String(Date.now()));
      previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.setTimeout(() => { setRating(null); setFeedback(""); setSubmitted(false); setOpen(true); }, 450);
    };
    window.addEventListener(POST_EXPORT_FEEDBACK_EVENT, onExport);
    return () => window.removeEventListener(POST_EXPORT_FEEDBACK_EVENT, onExport);
  }, []);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')];
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus.current?.focus(); };
  }, [open]);

  const chooseRating = (value: number) => {
    if (rating !== null) return;
    // This is captured immediately; closing the modal never discards the rating.
    setRating(value);
    store(RATED_KEY, String(Date.now()));
    trackEvent("export_feedback_rated", {
      rating: value, export_format: context.current.format ?? "unknown",
      template_id: context.current.templateId ?? "unknown", survey_version: 1,
    });
  };

  const submit = () => {
    if (rating === null || submitted) return;
    const comment = feedback.trim().slice(0, 1000);
    if (comment) {
      // Free-form feedback stays in PostHog, not GA4 event parameters.
      capturePostHog("export_feedback_submitted", {
        rating, feedback: comment, export_format: context.current.format ?? "unknown",
        template_id: context.current.templateId ?? "unknown", survey_version: 1,
      });
    }
    setSubmitted(true);
    setOpen(false);
  };

  if (!open) return null;
  const moods = [
    { emoji: "😣", label: "Very poor" },
    { emoji: "🙁", label: "Not great" },
    { emoji: "😐", label: "Okay" },
    { emoji: "😊", label: "Good" },
    { emoji: "🤩", label: "Amazing" },
  ];
  return <div className="export-feedback-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
    <div className="export-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="export-feedback-title" aria-describedby="export-feedback-description" tabIndex={-1} ref={dialogRef}>
      <button type="button" className="export-feedback-close" onClick={() => setOpen(false)} aria-label="Close feedback survey">×</button>
      <div className="export-feedback-hero">
        <div className="export-feedback-hero-icon" aria-hidden="true">{rating === null ? "↓" : "♥"}</div>
        <span className="export-feedback-kicker">{rating === null ? "EXPORT COMPLETE" : "RATING SAVED ✓"}</span>
      </div>
      <div className="export-feedback-content">
        {rating === null ? <>
          <h2 id="export-feedback-title">How was your experience?</h2>
          <p id="export-feedback-description">Your download is ready! One tap helps us make 3DBoxStudio even better.</p>
          <div className="export-feedback-ratings" role="group" aria-label="Rate your export experience">
            {moods.map((mood, index) => <button key={mood.label} type="button" aria-label={`Rate ${index + 1} out of 5: ${mood.label}`} onClick={() => chooseRating(index + 1)}>
              <span className="export-feedback-emoji" aria-hidden="true">{mood.emoji}</span><span className="export-feedback-mood">{mood.label}</span>
            </button>)}
          </div>
          <span className="export-feedback-hint">Tap an emoji to save your rating instantly</span>
          <button className="export-feedback-skip" type="button" onClick={() => setOpen(false)}>No thanks, skip</button>
        </> : <>
          <h2 id="export-feedback-title">Thanks for helping us grow!</h2>
          <p id="export-feedback-description">Your rating has been saved. Want to tell us more? <span>Totally optional.</span></p>
          <div className="export-feedback-saved-rating" aria-label={`Your saved rating: ${rating} out of 5`}>
            <span aria-hidden="true">{moods[rating-1].emoji}</span> {moods[rating-1].label} <span className="export-feedback-saved-check">✓ Saved</span>
          </div>
          <label htmlFor="export-feedback-comment" className="export-feedback-label">What could we improve?</label>
          <textarea id="export-feedback-comment" value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={1000} rows={3} placeholder="Share an idea, issue, or something you loved…" />
          <button type="button" className="export-feedback-submit" onClick={submit}>{feedback.trim() ? "Send feedback →" : "All done ✓"}</button>
          <button type="button" className="export-feedback-skip" onClick={() => setOpen(false)}>Skip comment & close</button>
        </>}
      </div>
      <div className="export-feedback-footer"><span aria-hidden="true">✦</span> Made better with your feedback</div>
    </div>
  </div>;
}
