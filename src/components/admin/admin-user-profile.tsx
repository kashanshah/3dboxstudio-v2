import Link from 'next/link';
import { AdminDeleteButton } from './admin-delete-button';
import { AdminDesignThumb } from './admin-design-thumb';
import { adminCount, adminDate, adminRelative, adminStars } from './admin-format';
import { adminTemplateName } from '@/lib/admin-template-name';
import type { AdminUserProfile } from '@/server/admin/profiles';

const designHref = (id: string) => `/admin/designs?view=${encodeURIComponent(id)}`;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt>{label}</dt><dd>{children ?? '—'}</dd></div>;
}

/** One user at a glance: account, where they came from, their work and what they told us. */
export function AdminUserProfileView({ profile, afterDelete }: { profile: AdminUserProfile; afterDelete: string }) {
  const p = profile;
  const signIn = [p.signupMethod, ...p.providers.filter((provider) => provider.toLowerCase() !== p.signupMethod.toLowerCase())].join(' · ');
  return <div className="admin-profile">
    <div className="admin-profile-head">
      <div>
        <h3>{p.name}</h3>
        <p><a href={`mailto:${p.email}`}>{p.email}</a></p>
      </div>
      <AdminDeleteButton kind="user" id={p.id} name={p.email} redirectTo={afterDelete} />
    </div>
    <div className="admin-chips">
      <span className={p.verified ? 'admin-chip is-good' : 'admin-chip is-warn'}>{p.verified ? `Verified ${adminDate(p.verifiedAt)}` : 'Email not verified'}</span>
      {p.migrated ? <span className="admin-chip">Moved from the previous studio</span> : null}
      {p.activeShares ? <span className="admin-chip">{adminCount(p.activeShares, 'active share link')}</span> : null}
    </div>
    <dl className="admin-facts">
      <Fact label="Joined">{adminDate(p.createdAt)}</Fact>
      <Fact label="Last active">{adminRelative(p.lastActiveAt)}</Fact>
      <Fact label="Signs in with">{signIn}</Fact>
      <Fact label="Source">{p.source ?? 'Direct / unknown'}{p.campaign ? ` · ${p.campaign}` : ''}{p.campaignDetail.medium ? ` · ${p.campaignDetail.medium}` : ''}</Fact>
      <Fact label="First page">{p.landing ?? '—'}</Fact>
      <Fact label="Signed up on">{p.campaignDetail.conversionPage ?? '—'}</Fact>
      {p.campaignDetail.referrer ? <Fact label="Referrer"><span className="admin-break">{p.campaignDetail.referrer}</span></Fact> : null}
    </dl>
    <div className="admin-profile-counts">
      <Link href={`/admin/designs?user=${encodeURIComponent(p.id)}`}><strong>{p.designCount.toLocaleString('en-US')}</strong><span>designs</span></Link>
      <Link href={`/admin/media?user=${encodeURIComponent(p.id)}`}><strong>{p.mediaCount.toLocaleString('en-US')}</strong><span>images</span></Link>
      <div><strong>{p.projectCount.toLocaleString('en-US')}</strong><span>projects</span></div>
      <div><strong>{p.feedback.length.toLocaleString('en-US')}</strong><span>ratings</span></div>
    </div>

    <section className="admin-profile-section">
      <h4>Designs</h4>
      {p.designs.length ? <ul className="admin-design-cards">
        {p.designs.slice(0, 12).map((design) => <li key={design.id}>
          <Link href={designHref(design.id)} scroll={false}>
            <AdminDesignThumb src={design.thumbnailUrl} name={design.name} />
            <span><strong>{design.name}</strong><small>{[adminTemplateName(design.templateId), adminRelative(design.updatedAt)].filter(Boolean).join(' · ')}</small></span>
          </Link>
        </li>)}
      </ul> : <p className="admin-muted">No designs yet.</p>}
      {p.designCount > 12 ? <p><Link className="admin-link" href={`/admin/designs?user=${encodeURIComponent(p.id)}`}>All {p.designCount.toLocaleString('en-US')} designs</Link></p> : null}
    </section>

    {p.projects.length ? <section className="admin-profile-section">
      <h4>Projects</h4>
      <ul className="admin-plain-list">{p.projects.map((project) => <li key={project.id}>
        <span>{project.name}{project.isDefault ? <em className="admin-muted"> · default</em> : null}</span>
        <small>{adminCount(project.designCount, 'design')} · {adminCount(project.sceneCount, 'scene')} · {adminRelative(project.updatedAt)}</small>
      </li>)}</ul>
    </section> : null}

    <section className="admin-profile-section">
      <h4>Export ratings</h4>
      {p.feedback.length ? <ul className="admin-plain-list">{p.feedback.map((item, index) => <li key={index}>
        <span><span className="admin-stars" aria-label={`${item.rating} of 5`}>{adminStars(item.rating)}</span> {item.format.toUpperCase()} · {adminTemplateName(item.templateId)}</span>
        <small>{adminDate(item.createdAt)}{item.design ? <> · <Link href={designHref(item.design.id)} scroll={false}>{item.design.name}</Link></> : null}</small>
        {item.comment ? <p className="admin-quote">{item.comment}</p> : null}
      </li>)}</ul> : <p className="admin-muted">No ratings.</p>}
    </section>

    <section className="admin-profile-section">
      <h4>Messages</h4>
      {p.contacts.length ? <ul className="admin-plain-list">{p.contacts.map((item) => <li key={item.id}>
        <span>{item.subject ?? 'No subject'} <span className={`admin-chip is-${item.status === 'new' ? 'warn' : 'muted'}`}>{item.status}</span></span>
        <small>{adminDate(item.createdAt)}</small>
        {item.message ? <p className="admin-quote">{item.message}</p> : null}
      </li>)}</ul> : <p className="admin-muted">No contact form messages from this address.</p>}
    </section>
  </div>;
}
