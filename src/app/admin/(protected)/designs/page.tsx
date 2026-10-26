import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { AdminDrawer, AdminDrawerLoading } from '@/components/admin/admin-drawer';
import { AdminDesignProfileView } from '@/components/admin/admin-design-profile';
import { adminRelative, adminStars } from '@/components/admin/admin-format';
import { AdminSortLink, adminListHref } from '@/components/admin/admin-sort-link';
import { adminDesignHref } from '@/lib/admin-media';
import { AdminTemplateSelect } from '@/components/admin/admin-template-select';
import { resolveTemplateCatalog } from '@/lib/packaging/template-catalog';
import { readTemplateSettings } from '@/server/templates';
import { DESIGN_SORTS, listDesigns, parseAdminDir, parseAdminPage, parseAdminQuery, parseAdminSort } from '@/server/admin/catalog';
import { getDesignProfile } from '@/server/admin/profiles';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin — Designs' };

type Props = { searchParams: Promise<{ q?: string; page?: string; user?: string; sort?: string; dir?: string; view?: string; template?: string }> };

const DEFAULTS = { sort: 'updated', dir: 'desc' };

async function DesignDrawerBody({ id, closeHref }: { id: string; closeHref: string }) {
  // The copy goes to whichever Studio account is signed in on this browser.
  const [profile, studioUser] = await Promise.all([getDesignProfile(id), getCurrentUser()]);
  if (!profile) return <p className="admin-muted">This design no longer exists.</p>;
  return <AdminDesignProfileView profile={profile} afterDelete={closeHref} studioUserEmail={studioUser?.email ?? null} />;
}

export default async function AdminDesignsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = parseAdminQuery(params.q);
  const page = parseAdminPage(params.page);
  const userId = (params.user ?? '').trim().slice(0, 80);
  const sort = parseAdminSort(params.sort, DESIGN_SORTS, 'updated');
  const dir = parseAdminDir(params.dir, 'desc');
  const view = (params.view ?? '').trim().slice(0, 200);
  const template = (params.template ?? '').trim().slice(0, 80);
  const [result, templates] = await Promise.all([
    listDesigns({ q, page, userId, sort, dir, template }),
    readTemplateSettings().then(resolveTemplateCatalog).catch(() => resolveTemplateCatalog([])),
  ]);
  const filters = { q, user: userId, sort, dir, template };
  const href = (next: number) => adminListHref('/admin/designs', { ...filters, page: next > 1 ? next : undefined }, DEFAULTS);
  // Past the last page (a stale link, or rows deleted since): back to the first.
  if (!result.items.length && result.page > 1) redirect(href(1));
  const sortHref = (column: string, nextDir: 'asc' | 'desc') => adminListHref('/admin/designs', { ...filters, sort: column, dir: nextDir, page: undefined }, DEFAULTS);
  const listHref = adminListHref('/admin/designs', { ...filters, page: page > 1 ? page : undefined }, DEFAULTS);
  const viewHref = (id: string) => adminListHref('/admin/designs', { ...filters, page: page > 1 ? page : undefined, view: id }, DEFAULTS);
  const ariaSort = (column: string) => sort === column ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const owner = userId ? result.items.find((design) => design.user?.id === userId)?.user : null;

  return (
    <div className={view ? 'admin-split has-drawer' : 'admin-split'}>
      <div className="admin-split-main">
        <AdminPageHeader title="Designs" description="Every design, with its owner, box, images and ratings. Select one for its images and actions." />
        <AdminListSearch action="/admin/designs" query={q} placeholder="Search design, owner name or email" hidden={{ user: userId, sort: sort === 'updated' ? '' : sort, dir: dir === 'desc' && sort === 'updated' ? '' : dir }}>
          <AdminTemplateSelect value={template} options={templates.map(entry => ({ id: entry.id, name: entry.name, active: entry.active }))} />
        </AdminListSearch>
        {template ? <p className="admin-filter-note">Designs using <strong>{templates.find(entry => entry.id === template)?.name ?? template}</strong> · <Link href={adminListHref('/admin/designs', { ...filters, template: undefined, page: undefined }, DEFAULTS)}>All templates</Link></p> : null}
        {userId ? <p className="admin-filter-note">Designs by <strong>{owner ? `${owner.name}${owner.email && owner.email !== owner.name ? ` (${owner.email})` : ''}` : 'this account'}</strong> · <Link href={adminListHref('/admin/designs', { q, sort, dir }, DEFAULTS)}>Show everyone&apos;s</Link></p> : null}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h2>All designs</h2>
            <p>{result.total.toLocaleString('en-US')} total</p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-rich">
              <thead>
                <tr>
                  <th><span className="sr-only">Thumbnail</span></th>
                  <th aria-sort={ariaSort('name')}><AdminSortLink label="Design" column="name" sort={sort} dir={dir} href={sortHref} /></th>
                  <th aria-sort={ariaSort('owner')}><AdminSortLink label="Owner" column="owner" sort={sort} dir={dir} href={sortHref} /></th>
                  <th>Box</th>
                  <th aria-sort={ariaSort('images')}><AdminSortLink label="Images" column="images" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th>Feedback</th>
                  <th aria-sort={ariaSort('created')}><AdminSortLink label="Created" column="created" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th aria-sort={ariaSort('updated')}><AdminSortLink label="Updated" column="updated" sort={sort} dir={dir} numeric href={sortHref} /></th>
                  <th><span className="sr-only">Preview</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.length ? result.items.map((design) => (
                  <tr key={design.id} className={design.id === view ? 'is-selected' : undefined}>
                    <td><AdminDesignThumb src={design.thumbnailUrl} name={design.name} /></td>
                    <td>
                      <Link className="admin-row-link" href={viewHref(design.id)} scroll={false}><strong>{design.name}</strong></Link>
                      <small className="admin-cell-sub">{[design.legacy ? 'Previous studio' : design.folder, design.sharedLink ? `shared · ${design.views.toLocaleString('en-US')} views` : null].filter(Boolean).join(' · ')}</small>
                    </td>
                    <td>{design.user ? <><Link href={`/admin/users?view=${encodeURIComponent(design.user.id)}`}>{design.user.name}</Link>{design.user.email && design.user.email !== design.user.name ? <small className="admin-cell-sub">{design.user.email}</small> : null}</> : <span className="admin-muted">No account</span>}</td>
                    <td>{design.templateName ?? '—'}<small className="admin-cell-sub">{design.size ?? ''}</small></td>
                    <td>{design.imageCount.toLocaleString('en-US')}</td>
                    <td>{design.rating ? <><span className="admin-stars" aria-label={`${design.rating.average} of 5`}>{adminStars(design.rating.average)}</span><small className="admin-cell-sub">{design.rating.count} rating{design.rating.count === 1 ? '' : 's'}</small></> : <span className="admin-muted">—</span>}</td>
                    <td className="admin-nowrap">{adminRelative(design.createdAt)}</td>
                    <td className="admin-nowrap">{adminRelative(design.updatedAt)}</td>
                    <td><a className="admin-link" href={design.previewHref} target="_blank" rel="noopener noreferrer">Preview</a></td>
                  </tr>
                )) : <tr><td colSpan={9}>No designs match this search.</td></tr>}
              </tbody>
            </table>
          </div>
          <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
        </div>
      </div>
      {view ? <AdminDrawer title="Design" closeHref={listHref} fullHref={adminDesignHref(view)}>
        <Suspense key={view} fallback={<AdminDrawerLoading />}><DesignDrawerBody id={view} closeHref={listHref} /></Suspense>
      </AdminDrawer> : null}
    </div>
  );
}
