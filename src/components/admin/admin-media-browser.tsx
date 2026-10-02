'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { AdminDeleteButton } from './admin-delete-button';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import type { AdminMediaItem } from '@/lib/admin-media';

function designLabel(item: AdminMediaItem): string {
  if (item.designs.length === 0) return 'Not used in a design';
  if (item.designs.length === 1) return item.designs[0].name;
  return `${item.designs.length} designs`;
}

export function AdminMediaBrowser({ items }: { items: AdminMediaItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const titleId = useId();
  const item = items.find((entry) => entry.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  return (
    <>
      <div className="admin-media-grid">
        {items.map((entry) => (
          <button key={entry.id} type="button" className="admin-media-card" onClick={() => { setFailed(false); setOpenId(entry.id); }}>
            {entry.mimeType.startsWith('image/') ? (
              <img src={entry.previewUrl} alt="" loading="lazy" />
            ) : <span className="admin-media-fallback">File</span>}
            <strong>{entry.name}</strong>
            <span>{entry.user?.name ?? 'No account'}</span>
            <span>{designLabel(entry)}</span>
          </button>
        ))}
      </div>
      {item && typeof document !== 'undefined' ? createPortal(
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenId(null); }}>
          <section className="admin-modal admin-media-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="admin-modal-header">
              <div>
                <h2 id={titleId}>{item.name}</h2>
                <p>{item.createdAt ? formatAdminDateTime(item.createdAt) : 'Upload date unavailable'}</p>
              </div>
              <button type="button" className="admin-modal-close" aria-label="Close image" onClick={() => setOpenId(null)} autoFocus>
                <X size={18} />
              </button>
            </header>
            <div className="admin-modal-body">
              <div className="admin-media-preview">
                {failed || !item.mimeType.startsWith('image/') ? (
                  <p className="admin-muted">This file could not be previewed.</p>
                ) : (
                  <img src={item.previewUrl} alt={item.name} onError={() => setFailed(true)} />
                )}
              </div>
              <AdminDeleteButton kind="media" id={item.id} name={item.name} onDeleted={() => setOpenId(null)} />
              <dl className="admin-detail">
                <div>
                  <dt>Uploaded by</dt>
                  <dd>{item.user ? <Link href={item.user.href}>{item.user.name}</Link> : 'No account on file'}</dd>
                </div>
                <div>
                  <dt>{item.designs.length === 1 ? 'Design' : 'Designs'}</dt>
                  <dd>
                    {item.designs.length ? (
                      <span className="admin-media-links">
                        {item.designs.map((design) => <Link key={design.id} href={design.href}>{design.name}</Link>)}
                      </span>
                    ) : 'Not used in a design'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>,
        document.querySelector('.admin-root') ?? document.body,
      ) : null}
    </>
  );
}
