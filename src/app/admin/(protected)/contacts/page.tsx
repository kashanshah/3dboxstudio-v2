import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminListSearch } from '@/components/admin/admin-list-search';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminContactStatus } from '@/components/admin/admin-contact-status';
import { adminDate } from '@/components/admin/admin-format';
import { adminListHref } from '@/components/admin/admin-sort-link';
import { parseAdminPage } from '@/server/admin/catalog';
import { listAdminContacts } from '@/server/admin/contacts';

export const metadata: Metadata = { title: 'Admin — Contacts' };

type Props = { searchParams: Promise<{ q?: string; status?: string; page?: string }> };

export default async function ContactsPage({ searchParams }: Props) {
  const params = await searchParams;
  const result = await listAdminContacts({ q: params.q, status: params.status, page: parseAdminPage(params.page) });
  const filters = { q: result.q, status: result.status };
  const href = (next: number) => adminListHref('/admin/contacts', { ...filters, page: next > 1 ? next : undefined });
  if (!result.items.length && result.page > 1) redirect(href(1));
  const tab = (status: string, label: string) => <Link className={result.status === status ? 'is-active' : undefined} href={adminListHref('/admin/contacts', { q: result.q, status })}>{label}</Link>;
  return <>
    <AdminPageHeader title="Contacts" description="Contact form messages from this site and the previous one, with the account that uses the same address." />
    <div className="admin-tabs">{tab('', 'All')}{tab('new', 'New')}{tab('handled', 'Handled')}</div>
    <AdminListSearch action="/admin/contacts" query={result.q} placeholder="Search name, email or message" hidden={{ status: result.status }} />
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Messages</h2><p>{result.total.toLocaleString('en-US')} total</p></div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-rich">
          <thead><tr><th>From</th><th>Message</th><th>Received</th><th>Status</th></tr></thead>
          <tbody>
            {result.items.length ? result.items.map((item) => <tr key={item.id}>
              <td>
                <strong>{item.name ?? item.email}</strong>
                <small className="admin-cell-sub"><a href={`mailto:${item.email}`}>{item.email}</a></small>
                {item.user ? <small className="admin-cell-sub"><Link href={`/admin/users?view=${encodeURIComponent(item.user.id)}`}>Account: {item.user.name}</Link></small> : null}
              </td>
              <td className="admin-message-cell">
                <strong>{item.subject ?? item.topic ?? 'No subject'}</strong>
                {item.message ? <details><summary>{item.message.length > 140 ? `${item.message.slice(0, 140)}…` : item.message}</summary>{item.message.length > 140 ? <p className="admin-quote">{item.message}</p> : null}</details> : null}
                {item.pagePath ? <small className="admin-cell-sub">Sent from {item.pagePath}</small> : null}
              </td>
              <td>{adminDate(item.createdAt)}{item.legacy ? <small className="admin-cell-sub">Previous site</small> : null}</td>
              <td>{item.legacy ? <span className="admin-chip is-muted">Previous site</span> : <AdminContactStatus id={item.id} status={item.status} />}</td>
            </tr>) : <tr><td colSpan={4}>No messages match.</td></tr>}
          </tbody>
        </table>
      </div>
      <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
    </div>
  </>;
}
