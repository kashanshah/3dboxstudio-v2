import Link from 'next/link';
import { AdminDeleteButton } from './admin-delete-button';
import { AdminDesignThumb } from './admin-design-thumb';
import { AdminMediaBrowser } from './admin-media-browser';
import { adminDate, adminRelative, adminStars } from './admin-format';
import { adminTemplateName } from '@/lib/admin-template-name';
import type { AdminDesignProfile } from '@/server/admin/profiles';

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children ?? '—'}</dd></div>;
}

/** One design at a glance: what it is, whose it is, its images and its ratings. */
export function AdminDesignProfileView({ profile, afterDelete, studioUserEmail, copy }: { profile: AdminDesignProfile; afterDelete: string; studioUserEmail: string | null; copy?: string }) {
  const d = profile;
  return <div className="admin-profile">
    <div className="admin-profile-hero"><AdminDesignThumb src={d.thumbnailUrl} name={d.name} /></div>
    <div className="admin-profile-head">
      <div>
        <h3>{d.name}</h3>
        <p>{[adminTemplateName(d.templateId), d.size].filter(Boolean).join(' · ') || (d.legacy ? 'Legacy design' : 'Studio design')}</p>
      </div>
      <AdminDeleteButton kind="design" id={d.id} name={d.name} redirectTo={afterDelete} />
    </div>
    <div className="admin-chips">
      <span className="admin-chip">{d.legacy ? 'Previous studio' : 'Studio'}</span>
      {d.sharedLink ? <span className="admin-chip is-good">Shared link · {d.views.toLocaleString('en-US')} views</span> : null}
      {d.rating ? <span className="admin-chip"><span className="admin-stars">{adminStars(d.rating.average)}</span> {d.rating.average.toFixed(1)} · {d.rating.count} rating{d.rating.count === 1 ? '' : 's'}</span> : null}
    </div>
    <div className="admin-profile-actions">
      <a className="admin-btn" href={d.previewHref} target="_blank" rel="noopener noreferrer">Open 3D preview</a>
      <form method="post" action={`/api/admin/designs/${encodeURIComponent(d.id)}/duplicate`} target="_blank">
        <button type="submit" className="admin-btn admin-btn-quiet">Open a copy in the editor</button>
      </form>
    </div>
    <p className="admin-muted admin-small">
      {studioUserEmail
        ? <>A copy goes into <strong>{studioUserEmail}</strong>&apos;s Studio account, with its images. The original is not changed.</>
        : <>To open a copy, sign in to the Studio on this browser first: the copy goes into that account. The original is not changed.</>}
    </p>
    {copy === 'missing' ? <p className="admin-error">This design could not be copied: it has no usable saved state.</p> : null}
    {copy === 'failed' ? <p className="admin-error">Copying failed. Please try again.</p> : null}
    <dl className="admin-facts">
      <Fact label="Owner">{d.user ? <Link href={`/admin/users?view=${encodeURIComponent(d.user.id)}`}>{d.user.name}{d.user.email && d.user.email !== d.user.name ? <small className="admin-muted"> · {d.user.email}</small> : null}</Link> : 'No account on file'}</Fact>
      {d.folder ? <Fact label="Project">{d.folder}</Fact> : null}
      <Fact label="Created">{adminDate(d.createdAt)}</Fact>
      <Fact label="Updated">{adminRelative(d.updatedAt)}</Fact>
      <Fact label="Images">{d.imageCount.toLocaleString('en-US')}</Fact>
    </dl>
    <section className="admin-profile-section">
      <h4>Images</h4>
      {d.images.length ? <AdminMediaBrowser items={d.images} /> : <p className="admin-muted">No separate image files are linked to this design.</p>}
    </section>
    <section className="admin-profile-section">
      <h4>Export ratings</h4>
      {d.feedback.length ? <ul className="admin-plain-list">{d.feedback.map((item, index) => <li key={index}>
        <span><span className="admin-stars" aria-label={`${item.rating} of 5`}>{adminStars(item.rating)}</span> {item.format.toUpperCase()}</span>
        <small>{adminDate(item.createdAt)}</small>
        {item.comment ? <p className="admin-quote">{item.comment}</p> : null}
      </li>)}</ul> : <p className="admin-muted">No ratings for this design.</p>}
    </section>
  </div>;
}
