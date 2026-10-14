import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { AdminDrawer, AdminDrawerLoading } from '@/components/admin/admin-drawer';
import { AdminUserProfileView } from '@/components/admin/admin-user-profile';
import { adminCount, adminDate, adminDay, adminRelative } from '@/components/admin/admin-format';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { adminUserHref } from '@/lib/admin-media';
import { listUsers, parseAdminDir, parseAdminPage, parseAdminQuery, parseAdminSort, USER_SORTS } from '@/server/admin/catalog';
import { getUserProfile } from '@/server/admin/profiles';

export const metadata: Metadata = { title: 'Admin — Users' };

type Props = { searchParams: Promise<{ q?: string; page?: string; sort?: string; dir?: string; view?: string }> };

const DEFAULTS = { sort: 'joined', dir: 'desc' };

async function UserDrawerBody({ id, closeHref }: { id: string; closeHref: string }) {
  const profile = await getUserProfile(id);
  if (!profile) return <p className="admin-muted">This account no longer exists.</p>;
  return <AdminUserProfileView profile={profile} afterDelete={closeHref} />;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = parseAdminQuery(params.q);
  const page = parseAdminPage(params.page);
  const sort = parseAdminSort(params.sort, USER_SORTS, 'joined');
  const dir = parseAdminDir(params.dir, 'desc');
  const view = (params.view ?? '').trim().slice(0, 120);
  const result = await listUsers({ q, page, sort, dir });
  const filters = { q, sort, dir };
  const href = (next: number) => adminListHref('/admin/users', { ...filters, page: next > 1 ? next : undefined }, DEFAULTS);
  // Past the last page (a stale link, or rows deleted since): back to the first.
  if (!result.items.length && result.page > 1) redirect(href(1));
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref('/admin/users', { ...filters, sort: column, dir: nextDir, page: undefined }, DEFAULTS);
  const listHref = adminListHref('/admin/users', { ...filters, page: page > 1 ? page : undefined }, DEFAULTS);
  const viewHref = (id: string) => adminListHref('/admin/users', { ...filters, page: page > 1 ? page : undefined, view: id }, DEFAULTS);
  const ariaSort = (column: string) => sort === column ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <div className={view ? 'admin-split has-drawer' : 'admin-split'}>
      <div className="admin-split-main">
        <AdminPageHeader title="Users" description="Who signed up, where they came from, and what they have made. Select a person for everything about them." />
        <AdminListSearch action="/admin/users" query={q} placeholder="Search name or email" hidden={{ sort: sort === 'joined' ? '' : sort, dir: dir === 'desc' && sort === 'joined' ? '' : dir }} />
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h2>Accounts</h2>
            <p>{result.total.toLocaleString('en-US')} total</p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-rich">
              <thead>
                <tr>
                  <th aria-sort={ariaSort('name')}><AdminSortLink label="Person" column="name" sort={sort} dir={dir} href={sortHref} /></th>
                  <th>Came from</th>
                  <th aria-sort={ariaSort('designs')}><AdminSortLink label="Designs" column="designs" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th aria-sort={ariaSort('media')}><AdminSortLink label="Images" column="media" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th>Last active</th>
                  <th aria-sort={ariaSort('joined')}><AdminSortLink label="Joined" column="joined" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th aria-sort={ariaSort('verified')}><AdminSortLink label="Verified" column="verified" sort={sort} dir={dir} href={sortHref} /></th>
                </tr>
              </thead>
              <tbody>
                {result.items.length ? result.items.map((user) => (
                  <tr key={user.id} className={user.id === view ? 'is-selected' : undefined}>
                    <td>
                      <Link className="admin-row-link" href={viewHref(user.id)} scroll={false}><strong>{user.name}</strong></Link>
                      <small className="admin-cell-sub">{user.email !== user.name ? `${user.email} · ` : ''}{user.signupMethod}</small>
                    </td>
                    <td>{user.source ?? <span className="admin-muted">Direct</span>}<small className="admin-cell-sub">{user.landing ?? ''}</small></td>
                    <td>
                      <div className="admin-thumb-strip">
                        {user.recentDesigns.map((design) => <AdminDesignThumb key={design.id} src={design.thumbnailUrl} name={design.name} />)}
                        <span>{adminCount(user.designCount, 'design')}<small className="admin-cell-sub">{adminCount(user.projectCount, 'project')}</small></span>
                      </div>
                    </td>
                    <td><Link href={`/admin/media?user=${encodeURIComponent(user.id)}`}>{user.mediaCount.toLocaleString('en-US')}</Link></td>
                    <td className="admin-nowrap">{adminRelative(user.lastActiveAt)}</td>
                    <td className="admin-nowrap" title={adminDate(user.createdAt)}>{adminDay(user.createdAt)}</td>
                    <td>{user.verified ? <span className="admin-chip is-good">{adminDay(user.verifiedAt)}</span> : <span className="admin-chip is-warn">No</span>}</td>
                  </tr>
                )) : <tr><td colSpan={7}>No users match this search.</td></tr>}
              </tbody>
            </table>
          </div>
          <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
        </div>
      </div>
      {view ? <AdminDrawer title="Person" closeHref={listHref} fullHref={adminUserHref(view)}>
        <Suspense key={view} fallback={<AdminDrawerLoading />}><UserDrawerBody id={view} closeHref={listHref} /></Suspense>
      </AdminDrawer> : null}
    </div>
  );
}
