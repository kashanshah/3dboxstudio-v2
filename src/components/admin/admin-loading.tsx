// Shown inside the admin shell the moment a page is opened, while its data loads.
export function AdminLoading() {
  return <div className="admin-loading" role="status" aria-live="polite">
    <span className="admin-sr-only">Loading…</span>
    <div className="admin-skeleton admin-skeleton-title"/>
    <div className="admin-skeleton admin-skeleton-line"/>
    <div className="admin-skeleton-panel">{Array.from({ length: 8 }, (_, i) => <div key={i} className="admin-skeleton admin-skeleton-row"/>)}</div>
  </div>;
}
