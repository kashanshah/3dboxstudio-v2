import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminMediaBrowser } from '@/components/admin/admin-media-browser';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { decodeRouteParam } from '@/lib/route-params';
import { getDesign } from '@/server/admin/catalog';

export const metadata: Metadata = { title: 'Admin — Design' };

type Props = { params: Promise<{ id: string }> };

export default async function AdminDesignPage({ params }: Props) {
  const { id: rawId } = await params;
  const design = await getDesign(decodeRouteParam(rawId));
  if (!design) notFound();

  return (
    <>
      <p className="admin-email-back"><Link href="/admin/designs">Back to designs</Link></p>
      <AdminPageHeader title={design.name} description={design.legacy ? 'Legacy design' : 'V2 studio project'} />
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
