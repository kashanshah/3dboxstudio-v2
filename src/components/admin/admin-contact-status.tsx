'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Toggles a message between new and handled. */
export function AdminContactStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function toggle() {
    const next = current === 'new' ? 'handled' : 'new';
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/contacts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: next }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not update.');
      setCurrent(next);
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update.'); }
    finally { setBusy(false); }
  }
  return <span className="admin-contact-status">
    <span className={`admin-chip ${current === 'new' ? 'is-warn' : 'is-muted'}`}>{current === 'new' ? 'New' : 'Handled'}</span>
    <button type="button" className="admin-text-button" disabled={busy} onClick={() => void toggle()}>{busy ? 'Saving…' : current === 'new' ? 'Mark handled' : 'Mark new'}</button>
    {error ? <small className="admin-error">{error}</small> : null}
  </span>;
}
