'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import type { AdminUserDesignItem } from '@/server/admin/catalog';

type Props = {
  userId: string;
  userEmail: string;
  userName: string;
  designCount: number;
};

export function AdminUserDesignsButton({ userId, userEmail, userName, designCount }: Props) {
  const [open, setOpen] = useState(false);
  const [designs, setDesigns] = useState<AdminUserDesignItem[]>([]);
  const [total, setTotal] = useState(designCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/designs?pageSize=100`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { items?: AdminUserDesignItem[]; total?: number; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Could not load designs.');
        return body;
      })
      .then((body) => {
        if (!active) return;
        setDesigns(body.items ?? []);
        setTotal(body.total ?? designCount);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load designs.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, userId, designCount]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="admin-email-open" title={`View designs for ${userEmail}`} onClick={() => setOpen(true)}>
        {designCount.toLocaleString()} design(s)
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="admin-modal admin-user-designs-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="admin-modal-header">
              <div>
                <p>User designs</p>
                <h2 id={titleId}>{userName}</h2>
              </div>
              <button type="button" className="admin-modal-close" aria-label="Close user designs" onClick={() => setOpen(false)} autoFocus>
                <X size={18} />
              </button>
            </header>
            <div className="admin-user-designs">
              <p className="admin-user-designs-meta">{userEmail}{' · '}{total.toLocaleString()} design{total === 1 ? '' : 's'}</p>
              {loading ? <p className="admin-muted">Loading designs…</p> : null}
              {error ? <p className="admin-error">{error}</p> : null}
              {!loading && !error && designs.length === 0 ? <p className="admin-muted">This user has no saved designs.</p> : null}
              {!loading && !error && designs.length > 0 ? (
                <ul className="admin-user-designs-list">
                  {designs.map((design) => (
                    <li key={design.id}>
                      <div className="admin-user-designs-preview">
                        {design.thumbnailUrl ? <img src={design.thumbnailUrl} alt="" loading="lazy" /> : <span aria-hidden>3D</span>}
                      </div>
                      <div className="admin-user-designs-copy">
                        <div className="admin-user-designs-name">{design.name}</div>
                        <div className="admin-user-designs-id">{design.id}</div>
                        <div className="admin-muted">
                          {formatAdminDateTime(design.updatedAt ?? design.createdAt ?? '')}
                          {' · '}
                          {design.imageCount.toLocaleString()} image{design.imageCount === 1 ? '' : 's'}
                          {' · '}
                          {design.legacy ? 'Legacy' : 'V2'}
                          {design.legacy ? ` · ${design.views.toLocaleString()} view${design.views === 1 ? '' : 's'}` : ''}
                        </div>
                      </div>
                      <span className="admin-link-stack">
                        {design.previewHref ? <a className="admin-link" href={design.previewHref} target="_blank" rel="noopener noreferrer">Preview</a> : null}
                        <Link className="admin-link" href={design.href}>Open</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!loading && !error && total > designs.length ? (
                <p className="admin-muted admin-user-designs-more">Showing {designs.length.toLocaleString()} of {total.toLocaleString()} designs.</p>
              ) : null}
            </div>
          </section>
        </div>,
        document.querySelector('.admin-root') ?? document.body,
      ) : null}
    </>
  );
}
