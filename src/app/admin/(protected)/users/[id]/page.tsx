import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { adminDesignHref } from '@/lib/admin-media';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { DESIGN_SORTS, getUser, parseAdminDir, parseAdminSort } from '@/server/admin/catalog';

export const metadata: Metadata = { title: 'Admin — User' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ sort?: string; dir?: string }> };

export default async function AdminUserPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const sort = parseAdminSort(query.sort, DESIGN_SORTS, 'updated');
  const dir = parseAdminDir(query.dir, 'desc');
  const user = await getUser(id, { sort, dir });
  if (!user) notFound();
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref(`/admin/users/${encodeURIComponent(id)}`, { sort: column, dir: nextDir }, { sort: 'updated', dir: 'desc' });

  return (
    <>
      <p className="admin-email-back"><Link href="/admin/users">Back to users</Link></p>
      <AdminPageHeader title={user.name} description={user.email} />
      <div className="admin-panel">
        <div className="admin-panel-header"><h2>Account</h2></div>
        <dl className="admin-detail">
          <div><dt>Email</dt><dd><a href={`mailto:${user.email}`}>{user.email}</a></dd></div>
          <div><dt>Verified</dt><dd>{user.verified ? 'Yes' : 'No'}</dd></div>
          <div><dt>Signup</dt><dd>{user.signupMethod}</dd></div>
          <div><dt>Joined</dt><dd>{user.createdAt ? formatAdminDateTime(user.createdAt) : '—'}</dd></div>
          <div><dt>Designs</dt><dd><Link href={`/admin/designs?user=${encodeURIComponent(user.id)}`}>{user.designCount.toLocaleString()}</Link></dd></div>
          <div><dt>Media</dt><dd><Link href={`/admin/media?user=${encodeURIComponent(user.id)}`}>{user.mediaCount.toLocaleString()}</Link></dd></div>
        </dl>
      </div>
      <div className="admin-panel">
        <div className="admin-panel-header"><h2>Designs</h2><p>{user.designs.length.toLocaleString()} shown</p></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>
                <th><span className="sr-only">Thumbnail</span></th>
                <th aria-sort={sort === 'name' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Name" column="name" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'images' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Images" column="images" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th aria-sort={sort === 'source' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Source" column="source" sort={sort} dir={dir} href={sortHref} /></th>
                <th aria-sort={sort === 'updated' ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}><AdminSortLink label="Updated" column="updated" sort={sort} dir={dir} numeric href={sortHref} /></th>
                <th>Preview</th>
              </tr></thead>
            <tbody>
              {user.designs.length ? user.designs.map((design) => (
                <tr key={design.id}>
                  <td><AdminDesignThumb src={design.thumbnailUrl} name={design.name} /></td>
                  <td><Link href={adminDesignHref(design.id)}>{design.name}</Link></td>
                  <td>{design.imageCount.toLocaleString()}</td>
                  <td>{design.legacy ? 'Legacy' : 'V2'}</td>
                  <td>{design.updatedAt ? formatAdminDateTime(design.updatedAt) : '—'}</td>
                  <td>{design.previewHref ? <a className="admin-link" href={design.previewHref} target="_blank" rel="noopener noreferrer">Preview</a> : '—'}</td>
                </tr>
              )) : <tr><td colSpan={6}>This account has no designs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
