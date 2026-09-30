import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminMediaBrowser } from '@/components/admin/admin-media-browser';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminPageHeader } from '@/components/admin-page-header';
import { adminDesignHref, adminUserHref } from '@/lib/admin-media';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { listMedia, MEDIA_SORTS, parseAdminDir, parseAdminPage, parseAdminQuery, parseAdminSort } from '@/server/admin/catalog';

export const metadata: Metadata = { title: 'Admin — Media' };

type Props = { searchParams: Promise<{ q?: string; page?: string; user?: string; design?: string; sort?: string; dir?: string }> };

export default async function AdminMediaPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = parseAdminQuery(params.q);
  const page = parseAdminPage(params.page);
  const userId = (params.user ?? '').trim().slice(0, 80);
  const designId = (params.design ?? '').trim().slice(0, 160);
  const sort = parseAdminSort(params.sort, MEDIA_SORTS, 'added');
  const dir = parseAdminDir(params.dir, 'desc');
  const result = await listMedia({ q, page, userId, designId, sort, dir });
  const filters = { q, user: userId, design: designId, sort, dir };
  const href = (next: number) => adminListHref('/admin/media', { ...filters, page: next > 1 ? next : undefined }, { sort: 'added', dir: 'desc' });
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref('/admin/media', { ...filters, sort: column, dir: nextDir, page: undefined }, { sort: 'added', dir: 'desc' });
  return (
    <>
      <AdminPageHeader title="Media" description="Library uploads and artwork referenced by designs. An image can exist without being placed on a design." />
      <AdminListSearch action="/admin/media" query={q} placeholder="Search file, owner, or design" hidden={{ ...(userId ? { user: userId } : {}), ...(designId ? { design: designId } : {}), sort: sort === 'added' ? '' : sort, dir: dir === 'desc' && sort === 'added' ? '' : dir }} />
      {userId || designId ? (
        <p className="admin-email-back">
          {userId ? <Link href={adminUserHref(userId)}>Filtered to one account</Link> : null}
          {userId && designId ? ' · ' : null}
          {designId ? <Link href={adminDesignHref(designId)}>Filtered to one design</Link> : null}
          {' · '}
          <Link href="/admin/media">Show all media</Link>
        </p>
      ) : null}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h2>Files</h2>
          <p>{result.total.toLocaleString()} total</p>
        </div>
        <nav className="admin-sort-bar" aria-label="Sort files">
          <AdminSortLink label="Name" column="name" sort={sort} dir={dir} href={sortHref} />
          <AdminSortLink label="Owner" column="owner" sort={sort} dir={dir} href={sortHref} />
          <AdminSortLink label="Designs" column="designs" sort={sort} dir={dir} numeric href={sortHref} />
          <AdminSortLink label="Added" column="added" sort={sort} dir={dir} numeric href={sortHref} />
        </nav>
        {result.items.length ? <AdminMediaBrowser items={result.items} /> : <div className="admin-panel-body"><p className="admin-muted">No media matches this search.</p></div>}
        <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
      </div>
    </>
  );
}
