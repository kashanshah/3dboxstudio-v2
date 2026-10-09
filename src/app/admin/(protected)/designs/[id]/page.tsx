import { AdminDeleteButton } from '@/components/admin/admin-delete-button';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminMediaBrowser } from '@/components/admin/admin-media-browser';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { decodeRouteParam } from '@/lib/route-params';
import { getDesign } from '@/server/admin/catalog';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin — Design' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> };

export default async function AdminDesignPage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const { copy } = await searchParams;
  const design = await getDesign(decodeRouteParam(rawId));
  if (!design) notFound();
  // The copy goes to whichever Studio account is signed in on this browser.
  const studioUser = await getCurrentUser();

  return (
    <>
      <p className="admin-email-back"><Link href="/admin/designs">Back to designs</Link></p>
      <AdminPageHeader title={design.name} description={design.legacy ? 'Legacy design' : 'V2 studio project'} />
      <AdminDeleteButton kind="design" id={design.id} name={design.name} redirectTo="/admin/designs" />
      <p className="admin-email-back"><a className="admin-link" href={design.previewHref} target="_blank" rel="noopener noreferrer">Open 3D preview</a></p>
      <form className="admin-design-copy" method="post" action={`/api/admin/designs/${encodeURIComponent(design.id)}/duplicate`} target="_blank">
        <button type="submit" className="admin-email-open">Open a copy in the editor</button>
        <span className="admin-muted">
          {studioUser
            ? <>Copies the design and its images into <strong>{studioUser.email}</strong>&apos;s Studio account. The original is not changed.</>
            : <>Sign in to the Studio on this browser first: the copy goes into that account. The original is not changed.</>}
        </span>
        {copy === 'missing' ? <p className="admin-error">This design could not be copied: it has no usable saved state.</p> : null}
        {copy === 'failed' ? <p className="admin-error">Copying failed. Please try again.</p> : null}
      </form>
      <div className="admin-panel">
        <div className="admin-panel-header"><h2>Details</h2></div>
        <dl className="admin-detail">
          <div><dt>Owner</dt><dd>{design.user ? <Link href={design.user.href}>{design.user.name}</Link> : 'No account on file'}</dd></div>
          <div><dt>Source</dt><dd>{design.legacy ? 'Legacy' : 'V2'}</dd></div>
          <div><dt>Created</dt><dd>{design.createdAt ? formatAdminDateTime(design.createdAt) : '—'}</dd></div>
          <div><dt>Updated</dt><dd>{design.updatedAt ? formatAdminDateTime(design.updatedAt) : '—'}</dd></div>
          {design.legacy ? <div><dt>Views</dt><dd>{design.views.toLocaleString()}</dd></div> : null}
          <div><dt>Images</dt><dd>{design.imageCount.toLocaleString()}</dd></div>
        </dl>
      </div>
      <div className="admin-panel">
        <div className="admin-panel-header"><h2>Images on this design</h2></div>
        {design.images.length ? <AdminMediaBrowser items={design.images} /> : <div className="admin-panel-body"><p className="admin-muted">No separate image files are linked to this design.</p></div>}
      </div>
    </>
  );
}
