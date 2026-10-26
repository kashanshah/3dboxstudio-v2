'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Deletes a named template no design uses; one in use can only be made inactive. */
export function AdminDeleteTemplate({ id, name, disabled }: { id: string; name: string; disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!window.confirm(`Delete “${name}”? It is removed from the site.`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error || 'It could not be deleted.'); return; }
      router.push('/admin/templates');
      router.refresh();
    } catch {
      setError('It could not be deleted.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="admin-template-delete">
    {error ? <p className="admin-error" role="alert">{error}</p> : null}
    <button type="button" className="admin-btn admin-btn-quiet" disabled={disabled || busy} onClick={() => void remove()}>Delete template</button>
    <span className="admin-muted">{disabled ? 'Designs use it, so it can only be made inactive.' : 'No design uses it.'}</span>
  </div>;
}
