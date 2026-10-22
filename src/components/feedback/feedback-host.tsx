"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import { MessageSquareWarning, X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { FEEDBACK_OFFER_EVENT, FEEDBACK_OPEN_EVENT, type FeedbackOpen } from "@/lib/feedback-events";
import "./feedback.css";

const FeedbackDialog = lazy(() => import("./feedback-dialog").then(module => ({ default: module.FeedbackDialog })));

// One per page, in the root layout: opens the feedback form when a component
// asks (openFeedback), and shows a dismissible card after a failure
// (offerFeedback). An offer the visitor closed is not repeated for a day.
const OFFER_DISMISSED_KEY = "3dbs_feedback_offer_dismissed_v1";
const DAY = 24 * 60 * 60 * 1000;
const offerDismissed = () => { try { return Date.now() - Number(window.localStorage.getItem(OFFER_DISMISSED_KEY) || 0) < DAY; } catch { return false; } };

export function FeedbackHost() {
  const [open, setOpen] = useState<FeedbackOpen | null>(null);
  const [offer, setOffer] = useState<(FeedbackOpen & { title: string }) | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<FeedbackOpen>).detail;
      setOffer(null);
      setOpen(detail);
      trackEvent("feedback_opened", { source: detail.source, kind: detail.kind ?? "none" });
    };
    const onOffer = (event: Event) => {
      if (offerDismissed()) return;
      const detail = (event as CustomEvent<FeedbackOpen & { title: string }>).detail;
      setOffer(detail);
      trackEvent("feedback_offered", { source: detail.source });
    };
    window.addEventListener(FEEDBACK_OPEN_EVENT, onOpen);
    window.addEventListener(FEEDBACK_OFFER_EVENT, onOffer);
    return () => { window.removeEventListener(FEEDBACK_OPEN_EVENT, onOpen); window.removeEventListener(FEEDBACK_OFFER_EVENT, onOffer); };
  }, []);

  // The offer card leaves on its own after a while.
  useEffect(() => {
    if (!offer) return;
    const timer = window.setTimeout(() => setOffer(null), 20000);
    return () => window.clearTimeout(timer);
  }, [offer]);

  const dismissOffer = () => {
    try { window.localStorage.setItem(OFFER_DISMISSED_KEY, String(Date.now())); } catch { /* Storage may be unavailable. */ }
    setOffer(null);
  };

  return <>
    {offer ? <aside className="fb-offer" role="status" aria-label="Feedback">
      <MessageSquareWarning aria-hidden="true" />
      <p><b>{offer.title}</b><span>Tell us what happened and we will look into it.</span></p>
      <button type="button" className="fb-offer-action" onClick={() => { const detail = { source: offer.source, kind: offer.kind, prompt: offer.prompt, context: offer.context }; setOffer(null); setOpen(detail); trackEvent("feedback_opened", { source: detail.source, kind: detail.kind ?? "none" }); }}>Tell us</button>
      <button type="button" className="fb-offer-close" aria-label="Dismiss" onClick={dismissOffer}><X aria-hidden="true" /></button>
    </aside> : null}
    {open ? <Suspense fallback={null}><FeedbackDialog request={open} onClose={() => setOpen(null)} /></Suspense> : null}
  </>;
}
