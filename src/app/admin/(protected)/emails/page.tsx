import { emailUserHrefs } from '@/server/admin/email-users';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminEmailTable } from '@/components/admin/admin-email-table';
import { AdminPageHeader } from '@/components/admin-page-header';
import { listSentEmails, sentEmailCursor } from '@/server/email/resend-log';

export const metadata: Metadata = { title: 'Admin — Emails' };

function listHref(cursor?: { after?: string; before?: string }): string {
  const params = new URLSearchParams();
  if (cursor?.after) params.set('after', cursor.after);
  else if (cursor?.before) params.set('before', cursor.before);
  const query = params.toString();
  return query ? `/admin/emails?${query}` : '/admin/emails';
}

type Props = { searchParams: Promise<{ after?: string; before?: string }> };

export default async function AdminEmailsPage({ searchParams }: Props) {
  const params = await searchParams;
  const after = sentEmailCursor(params.after);
  const before = after ? undefined : sentEmailCursor(params.before);
  const result = await listSentEmails({ after, before });
  const emails = result.ok ? result.data.emails : [];
  const userHrefs = await emailUserHrefs(emails.flatMap((email) => email.to));
  const firstId = emails[0]?.id;
  const lastId = emails[emails.length - 1]?.id;
  const showOlder = Boolean(before) || (result.ok && result.data.hasMore);
  const showNewer = Boolean(after) || (Boolean(before) && result.ok && result.data.hasMore);

  return (
    <>
      <AdminPageHeader title="Emails" description="Messages sent through Resend, newest first." />
      {!result.ok ? (
        <p className="admin-error">{result.error}</p>
      ) : (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h2>Sent mail</h2>
            <p>{emails.length} on this page</p>
          </div>
          {emails.length ? <AdminEmailTable emails={emails} userHrefs={userHrefs} /> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Sent</th><th>To</th><th>Subject</th><th>Status</th></tr></thead>
                <tbody><tr><td colSpan={4}>No sent emails yet.</td></tr></tbody>
              </table>
            </div>
          )}
          {(showNewer || showOlder) && (
            <div className="admin-email-pager">
              {showNewer && firstId ? <Link href={listHref({ before: firstId })}>Newer</Link> : <span />}
              {showOlder && lastId ? <Link href={listHref({ after: lastId })}>Older</Link> : <span />}
            </div>
          )}
        </div>
      )}
    </>
  );
}
