import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { adminUserHref } from '@/lib/admin-media';
import { AdminUserDesignsButton } from '@/components/admin/admin-user-designs-button';
import { AdminUserProjectsButton } from '@/components/admin/admin-user-projects-button';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { listUsers, parseAdminDir, parseAdminPage, parseAdminQuery, parseAdminSort, USER_SORTS } from '@/server/admin/catalog';

export const metadata: Metadata = { title: 'Admin — Users' };

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string }> };

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = parseAdminQuery(params.q);
  const page = parseAdminPage(params.page);
  const sort = parseAdminSort(params.sort, USER_SORTS, 'joined');
  const dir = parseAdminDir(params.dir, 'desc');
  const result = await listUsers({ q, page, sort, dir });
  const filters = { q, sort, dir };
  const href = (next: number) => adminListHref('/admin/users', { ...filters, page: next > 1 ? next : undefined }, { sort: 'joined', dir: 'desc' });
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref('/admin/users', { ...filters, sort: column, dir: nextDir, page: undefined }, { sort: 'joined', dir: 'desc' });

  return (
    <>
      <AdminPageHeader title="Users" description="Accounts in V2, including people migrated from the previous studio." />
      <AdminListSearch action="/admin/users" query={q} placeholder="Search name or email" hidden={{ sort: sort === 'joined' ? '' : sort, dir: dir === 'desc' && sort === 'joined' ? '' : dir }} />
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>Accounts</h2>
          <p>{result.total.toLocaleString()} total</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th aria-sort={sort === 'name' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Name" column="name" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'email' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Email" column="email" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'verified' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Verified" column="verified" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'projects' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Projects" column="projects" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th aria-sort={sort === 'designs' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Designs" column="designs" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th aria-sort={sort === 'media' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Media" column="media" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th aria-sort={sort === 'joined' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Joined" column="joined" sort={sort} dir={dir} numeric href={sortHref} /></th>
              </tr>
            </thead>
            <tbody>
              {result.items.length ? result.items.map((user) => (
                <tr key={user.id}>
                  <td><Link href={adminUserHref(user.id)}>{user.name}</Link></td>
                  <td>{user.email}</td>
                  <td>{user.verified ? 'Yes' : 'No'}</td>
                  <td>
                    <AdminUserProjectsButton userId={user.id} userEmail={user.email} userName={user.name} projectCount={user.projectCount} />
                  </td>
                  <td>
                    <AdminUserDesignsButton userId={user.id} userEmail={user.email} userName={user.name} designCount={user.designCount} />
                  </td>
                  <td>
                    <Link href={`/admin/media?user=${encodeURIComponent(user.id)}`}>{user.mediaCount.toLocaleString()} media</Link>
                  </td>
                  <td>{user.createdAt ? formatAdminDateTime(user.createdAt) : '—'}</td>
                </tr>
              )) : <tr><td colSpan={7}>No users match this search.</td></tr>}
            </tbody>
          </table>
        </div>
        <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
      </div>
    </>
  );
}
