import Link from 'next/link';
import type { AdminSortDir } from '@/server/admin/catalog';

export function adminListHref(path: string, values: Record<string, string | number | undefined>, defaults: Record<string, string> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === '' || String(value) === defaults[key]) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function AdminSortLink({ label, column, sort, dir, numeric, href }: {
  label: string;
  column: string;
  sort: string;
  dir: AdminSortDir;
  numeric?: boolean;
  href: (column: string, dir: AdminSortDir) => string;
}) {
  const active = sort === column;
  const nextDir: AdminSortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : (numeric ? 'desc' : 'asc');
  return (
    <Link href={href(column, nextDir)} aria-current={active ? 'true' : undefined}>
      {label}
      {active ? <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span> : null}
    </Link>
  );
}
