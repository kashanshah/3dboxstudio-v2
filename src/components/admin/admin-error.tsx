'use client';
import { useEffect } from 'react';

// A page that fails to load says so inside the shell and offers a retry,
// instead of replacing the whole admin with an error page.
export function AdminError({ error, retry, reset }: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
  useEffect(() => { console.error('Admin page failed', error); }, [error]);
  return <section className="admin-panel admin-error-panel" role="alert">
    <div className="admin-panel-header"><h2>This page could not load</h2></div>
    <div className="admin-panel-body">
      <p className="admin-muted">The data for this page did not load. Other admin pages still work.{error.digest ? ` Reference: ${error.digest}` : ''}</p>
      <button type="button" className="admin-btn" onClick={() => (retry ?? reset)?.()}>Try again</button>
    </div>
  </section>;
}
