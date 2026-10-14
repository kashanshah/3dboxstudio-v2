import Link from 'next/link';
import { X } from 'lucide-react';
import { AdminDrawerKeys } from './admin-drawer-keys';

// The detail panel beside a list. It is part of the page (the record's id is
// in the URL), so it can be linked to, survives a reload, and closes with
// the back button as well as its close link or Escape.
export function AdminDrawer({ title, closeHref, fullHref, children }: { title: string; closeHref: string; fullHref?: string; children: React.ReactNode }) {
  return <>
    <Link className="admin-drawer-backdrop" href={closeHref} aria-label="Close details" scroll={false} />
    <aside className="admin-drawer" aria-label={title}>
      <header className="admin-drawer-header">
        <h2>{title}</h2>
        <div>
          {fullHref ? <Link className="admin-link" href={fullHref}>Open full page</Link> : null}
          <Link className="admin-drawer-close" href={closeHref} aria-label="Close details" scroll={false}><X size={18} /></Link>
        </div>
      </header>
      <div className="admin-drawer-body">{children}</div>
      <AdminDrawerKeys closeHref={closeHref} />
    </aside>
  </>;
}

export function AdminDrawerLoading() {
  return <div className="admin-loading" role="status"><span className="admin-sr-only">Loading…</span>
    <div className="admin-skeleton admin-skeleton-title" /><div className="admin-skeleton admin-skeleton-line" />
    {Array.from({ length: 5 }, (_, i) => <div key={i} className="admin-skeleton admin-skeleton-row" />)}
  </div>;
}
