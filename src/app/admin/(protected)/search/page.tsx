import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { adminCount, adminRelative } from '@/components/admin/admin-format';
import { adminTemplateName } from '@/lib/admin-template-name';
import { formatMediaSize } from '@/lib/admin-media';
import { listDesigns, listMedia, listUsers, parseAdminQuery } from '@/server/admin/catalog';
import { listAdminContacts } from '@/server/admin/contacts';

export const metadata: Metadata = { title: 'Admin — Search' };

type Props = { searchParams: Promise<{ q?: string }> };

function Section({ title, total, more, children }: { title: string; total: number; more: string; children: React.ReactNode }) {
  return <section className="admin-panel">
    <div className="admin-panel-header"><h2>{title}</h2><p>{total > 0 ? <Link href={more}>See all {total.toLocaleString('en-US')}</Link> : 'None'}</p></div>
    {total > 0 ? <ul className="admin-search-results">{children}</ul> : null}
  </section>;
}

/** One search across people, designs, images and contact messages. */
export default async function AdminSearchPage({ searchParams }: Props) {
  const q = parseAdminQuery((await searchParams).q);
  const encoded = encodeURIComponent(q);
  const results = q ? await Promise.all([
    listUsers({ q }), listDesigns({ q, pageSize: 6 }), listMedia({ q, pageSize: 6 }), listAdminContacts({ q }),
  ]) : null;
  return <>
    <AdminPageHeader title="Search" description="People, designs, images and contact messages matching a name, email or title." />
    <AdminListSearch action="/admin/search" query={q} placeholder="Name, email, design or message" />
    {!results ? <p className="admin-muted">Type a name, an email address, a design name or words from a message.</p> : <div className="admin-search-grid">
      <Section title="People" total={results[0].total} more={`/admin/users?q=${encoded}`}>
        {results[0].items.slice(0, 6).map((user) => <li key={user.id}><Link href={`/admin/users?q=${encoded}&view=${encodeURIComponent(user.id)}`}>
          <strong>{user.name}</strong><small>{user.email} · {adminCount(user.designCount, 'design')} · joined {adminRelative(user.createdAt)}</small>
        </Link></li>)}
      </Section>
      <Section title="Designs" total={results[1].total} more={`/admin/designs?q=${encoded}`}>
        {results[1].items.map((design) => <li key={design.id}><Link className="admin-search-design" href={`/admin/designs?q=${encoded}&view=${encodeURIComponent(design.id)}`}>
          <AdminDesignThumb src={design.thumbnailUrl} name={design.name} />
          <span><strong>{design.name}</strong><small>{[design.user?.name, adminTemplateName(design.templateId), adminRelative(design.updatedAt)].filter(Boolean).join(' · ')}</small></span>
        </Link></li>)}
      </Section>
      <Section title="Images" total={results[2].total} more={`/admin/media?q=${encoded}`}>
        {results[2].items.map((item) => <li key={item.id}><Link href={`/admin/media?q=${encoded}`}>
          <strong>{item.name}</strong><small>{[item.user?.name, formatMediaSize(item.byteSize), item.designs.length ? adminCount(item.designs.length, 'design') : 'not in a design'].filter(Boolean).join(' · ')}</small>
        </Link></li>)}
      </Section>
      <Section title="Contact messages" total={results[3].total} more={`/admin/contacts?q=${encoded}`}>
        {results[3].items.slice(0, 6).map((item) => <li key={item.id}><Link href={`/admin/contacts?q=${encoded}`}>
          <strong>{item.subject ?? item.topic ?? 'No subject'}</strong><small>{item.name ?? item.email} · {adminRelative(item.createdAt)} · {item.status}</small>
        </Link></li>)}
      </Section>
    </div>}
  </>;
}
