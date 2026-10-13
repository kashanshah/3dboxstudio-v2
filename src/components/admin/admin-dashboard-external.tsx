import { cache } from 'react';
import { AwsCostPanel, StorageStats } from '@/components/admin-dashboard';
import { getAwsCost } from '@/server/admin/aws-cost';
import { getStorageStats } from '@/server/admin/storage-stats';

// The dashboard's figures from AWS: slow to fetch, so they stream in after
// the rest of the dashboard instead of holding it up.
const storageStats = cache(getStorageStats);

export async function DashboardCosts() {
  const [cost, storage] = await Promise.all([getAwsCost(), storageStats()]);
  return <AwsCostPanel cost={cost} storage={storage} />;
}

export async function DashboardStorage() {
  return <StorageStats storage={await storageStats()} />;
}

export function DashboardPanelLoading({ title }: { title: string }) {
  return <section className="admin-panel" aria-busy="true"><div className="admin-panel-header"><h2>{title}</h2></div><div className="admin-panel-body"><p className="admin-muted">Loading…</p></div></section>;
}
