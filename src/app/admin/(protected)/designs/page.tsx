import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { adminDesignHref, adminUserHref } from '@/lib/admin-media';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { DESIGN_SORTS, listDesigns, parseAdminDir, parseAdminPage, parseAdminQuery, parseAdminSort } from '@/server/admin/catalog';

export const metadata: Metadata = { title: 'Admin — Designs' };

type Props = { searchParams: Promise<{ q?: string; page?: string; user?: string; sort?: string; dir?: string }> };

export default async function AdminDesignsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = parseAdminQuery(params.q);
  const page = parseAdminPage(params.page);
  const userId = (params.user ?? '').trim().slice(0, 80);
  const sort = parseAdminSort(params.sort, DESIGN_SORTS, 'updated');
  const dir = parseAdminDir(params.dir, 'desc');
  const result = await listDesigns({ q, page, userId, sort, dir });
  const filters = { q, user: userId, sort, dir };
  const href = (next: number) => adminListHref('/admin/designs', { ...filters, page: next > 1 ? next : undefined }, { sort: 'updated', dir: 'desc' });
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref('/admin/designs', { ...filters, sort: column, dir: nextDir, page: undefined }, { sort: 'updated', dir: 'desc' });

  return (
    <>
      <AdminPageHeader title="Designs" description="V2 studio projects and legacy designs kept from the previous site." />
      <AdminListSearch action="/admin/designs" query={q} placeholder="Search design or owner" hidden={{ ...(userId ? { user: userId } : {}), sort: sort === 'updated' ? '' : sort, dir: dir === 'desc' && sort === 'updated' ? '' : dir }} />
      {userId ? <p className="admin-email-back"><Link href={adminUserHref(userId)}>Filtered to one account</Link> · <Link href="/admin/designs">Show every design</Link></p> : null}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>All designs</h2>
          <p>{result.total.toLocaleString()} total</p>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th><span className="sr-only">Thumbnail</span></th>
                <th aria-sort={sort === 'name' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Name" column="name" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'owner' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Owner" column="owner" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'images' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Images" column="images" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th aria-sort={sort === 'source' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Source" column="source" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'updated' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Updated" column="updated" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {result.items.length ? result.items.map((design) => (
                <tr key={design.id}>
                  <td><AdminDesignThumb src={design.thumbnailUrl} name={design.name} /></td>
                  <td><Link href={adminDesignHref(design.id)}>{design.name}</Link></td>
                  <td>{design.user ? <Link href={design.user.href}>{design.user.name}</Link> : 'No account'}</td>
                  <td>{design.imageCount.toLocaleString()}</td>
                  <td>{design.legacy ? 'Legacy' : 'V2'}</td>
                  <td>{design.updatedAt ? formatAdminDateTime(design.updatedAt) : '—'}</td>
                  <td>{design.previewHref ? <a className="admin-link" href={design.previewHref} target="_blank" rel="noopener noreferrer">Preview</a> : '—'}</td>
                </tr>
              )) : <tr><td colSpan={7}>No designs match this search.</td></tr>}
            </tbody>
          </table>
        </div>
        <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
      </div>
    </>
  );
}
