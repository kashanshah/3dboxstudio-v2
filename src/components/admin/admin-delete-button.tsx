'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Trash2, X } from 'lucide-react';
import type { DeletionKind, DeletionPreview, DeletionResult } from '@/lib/admin-deletion';

type Props = { kind: DeletionKind; id: string; name: string; redirectTo?: string; onDeleted?: () => void };
export function AdminDeleteButton({ kind, id, name, redirectTo, onDeleted }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<DeletionResult | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch(`/api/admin/deletions?kind=${kind}&id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Could not load deletion details.');
        setPreview(body);
      }).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [open, kind, id, version]);
  function finish() {
    setOpen(false);
    onDeleted?.();
    if (redirectTo) router.push(redirectTo);
    router.refresh();
  }
  function close() { if (!busy) { if (result) finish(); else setOpen(false); } }
  async function remove() {
    if (!preview || !confirmed || busy) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/deletions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result ? { jobId: result.jobId } : { kind, id, token: preview.token }) });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) { setPreview(null); setConfirmed(false); }
        throw new Error(body.error || 'Could not delete this item.');
      }
      setResult(body);
      window.dispatchEvent(new Event('admin-deletion-updated'));
      if (!body.pendingFiles) finish();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this item.'); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="admin-delete-button" aria-label={`Delete ${kind}: ${name}`} onClick={() => { setPreview(null); setError(''); setConfirmed(false); setResult(null); setOpen(true); }}><Trash2 size={14} />Delete</button>
    {open ? createPortal(
      <dialog ref={dialog} className="admin-delete-dialog" aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close(); }} onKeyDown={e => e.stopPropagation()}>
        <header className="admin-modal-header"><div><p>Permanent deletion</p><h2 id={titleId}>Delete {kind}: {name}</h2></div><button type="button" className="admin-modal-close" aria-label="Close deletion confirmation" disabled={busy} onClick={close} autoFocus><X size={18} /></button></header>
        <div className="admin-delete-body">
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
          {!preview && !error ? <p role="status">Loading everything linked to this {kind}…</p> : null}
          {result ? <p role="status">Records deleted. {result.pendingFiles} stored files still need cleanup. Retry now, or close and continue cleanup from the admin notice.</p> : preview ? <>
            <p>This cannot be undone. The following records and files will be permanently deleted:</p>
            {preview.groups.map(group => <details key={group.label} open><summary>{group.label} ({group.items.length.toLocaleString()})</summary><ul>{group.items.map(item => <li key={item.id}><strong>{item.name}</strong><small>{item.id}</small></li>)}</ul></details>)}
            {preview.updates.map((group, index) => <details key={`${group.label}-${index}`} open><summary>{group.label} ({group.items.length.toLocaleString()})</summary><ul>{group.items.map(item => <li key={item.id}><strong>{item.name}</strong><small>{item.id}</small></li>)}</ul></details>)}
            {preview.retainedMedia.length ? <details open><summary>Shared files kept ({preview.retainedMedia.length})</summary><p>These are still used by surviving designs, scenes, or share links.</p><ul>{preview.retainedMedia.map(item => <li key={item.id}>{item.name}</li>)}</ul></details> : null}
            <label className="admin-delete-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />I have reviewed the list and confirm permanent deletion.</label>
          </> : null}
        </div>
        <footer className="admin-delete-footer"><button type="button" className="admin-email-open" disabled={busy} onClick={close}>{result ? 'Close' : 'Cancel'}</button>{!preview && error ? <button type="button" className="admin-email-open" onClick={() => { setPreview(null); setError(''); setConfirmed(false); setVersion(v => v + 1); }}>Refresh deletion details</button> : <button type="button" className="admin-delete-button admin-delete-submit" disabled={busy || !preview || !confirmed} onClick={remove}>{busy ? 'Deleting…' : result ? 'Retry file cleanup' : 'Delete permanently'}</button>}</footer>
      </dialog>, document.querySelector('.admin-root') ?? document.body,
    ) : null}
  </>;
}
