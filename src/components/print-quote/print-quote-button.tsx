"use client";

import { lazy, Suspense, useState } from "react";
import { Printer } from "lucide-react";
import type { QuoteBox } from "@/content/print-quote";
import { isFeatureOn } from "@/lib/features";
import { trackEvent } from "@/lib/analytics";

const PrintQuoteDialog = lazy(() => import("./print-quote-dialog").then(module => ({ default: module.PrintQuoteDialog })));

/**
 * "Get this box printed" for the Studio: the box is read when the button is
 * pressed, so the request has the size on screen. Hidden while the feature
 * is off or the box has no generator style; disabled with `disabledReason`.
 */
export function PrintQuoteButton({ getBox, className, disabledReason }: { getBox: () => QuoteBox | null; className?: string; disabledReason?: string | null }) {
  const [box, setBox] = useState<QuoteBox | null>(null);
  if (!isFeatureOn("printQuote") || !getBox()) return null;
  const open = () => {
    const next = getBox();
    if (!next) return;
    setBox(next);
    trackEvent("print_quote_opened", { box_type: next.style, source: "studio" });
  };
  return <>
    <button type="button" className={className} onClick={open} disabled={Boolean(disabledReason)} title={disabledReason ?? undefined}><Printer size={16} aria-hidden="true" /> Get this box printed</button>
    {box ? <Suspense fallback={null}><PrintQuoteDialog box={box} onClose={() => setBox(null)} /></Suspense> : null}
  </>;
}
