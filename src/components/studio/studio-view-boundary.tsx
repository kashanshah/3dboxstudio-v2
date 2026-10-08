'use client';

import { catchError, type ErrorInfo } from 'next/error';
import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { installDomMutationGuard } from '@/lib/dom-mutation-guard';

// Installed when the editor's code loads, before React commits any update.
let guardReported = false;
installDomMutationGuard(operation => {
  if (guardReported) return;
  guardReported = true;
  trackEvent('studio_dom_conflict_ignored', { operation, page_translated: typeof document !== 'undefined' && /translated/.test(document.documentElement.className) });
});

// Last automatic recovery per view, so an error that keeps recurring shows the
// fallback instead of remounting in a loop.
const lastAutoReset = new Map<string, number>();
const AUTO_RESET_WINDOW_MS = 10_000;

function StudioViewFallback({ view }: { view: string }, { error, reset }: ErrorInfo) {
  useEffect(() => {
    const now = Date.now();
    const automatic = now - (lastAutoReset.get(view) ?? 0) > AUTO_RESET_WINDOW_MS;
    trackEvent('studio_view_crashed', {
      view,
      error_name: error instanceof Error ? error.name : 'unknown',
      error_message: (error instanceof Error ? error.message : String(error)).slice(0, 200),
      auto_recovered: automatic,
    });
    if (!automatic) return;
    // DOM errors (e.g. a browser translator or extension rewrote the page)
    // usually clear once React rebuilds the view from scratch. Editor state
    // lives above this boundary, so the design is kept.
    lastAutoReset.set(view, now);
    reset();
  }, [view, error, reset]);

  return <div className="pro-view-error" role="alert">
    <p>This view hit a problem. Your design is still here.</p>
    <button type="button" className="pro-secondary-button" onClick={() => reset()}><RotateCcw size={14}/> Reload view</button>
  </div>;
}

/** Contains a crash to one part of the editor instead of taking down the page. */
export const StudioViewBoundary = catchError(StudioViewFallback);
