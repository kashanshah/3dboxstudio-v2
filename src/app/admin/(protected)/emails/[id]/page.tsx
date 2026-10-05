import { emailUserHrefs } from '@/server/admin/email-users';
import { AdminEmailAddresses } from '@/components/admin/admin-email-addresses';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin-page-header';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import { getSentEmail, sentEmailCursor } from '@/server/email/resend-log';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: sentEmailCursor(id) ? 'Admin — Email' : 'Admin — Emails' };
}

export default async function AdminEmailDetailPage({ params }: Props) {
  const { id } = await params;
  if (!sentEmailCursor(id)) notFound();
  const result = await getSentEmail(id);
  const userHrefs = await emailUserHrefs(result.ok ? [result.data.from, ...result.data.to, ...result.data.cc, ...result.data.bcc, ...result.data.replyTo] : []);

  return (
    <>
      <AdminPageHeader title="Email" description="A message retrieved from Resend." />
      <p className="admin-email-back"><Link href="/admin/emails">Back to sent mail</Link></p>
      {!result.ok ? (
        <p className="admin-error">{result.error}</p>
      ) : (
        <>
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h2>{result.data.subject}</h2>
              <p>{result.data.lastEvent}</p>
            </div>
            <dl className="admin-email-meta">
              <div><dt>Sent</dt><dd>{result.data.createdAt ? formatAdminDateTime(result.data.createdAt) : '—'}</dd></div>
              <div><dt>From</dt><dd><AdminEmailAddresses addresses={[result.data.from]} userHrefs={userHrefs} /></dd></div>
              <div><dt>To</dt><dd><AdminEmailAddresses addresses={result.data.to} userHrefs={userHrefs} /></dd></div>
              {result.data.cc.length > 0 && <div><dt>Cc</dt><dd><AdminEmailAddresses addresses={result.data.cc} userHrefs={userHrefs} /></dd></div>}
              {result.data.bcc.length > 0 && <div><dt>Bcc</dt><dd><AdminEmailAddresses addresses={result.data.bcc} userHrefs={userHrefs} /></dd></div>}
              {result.data.replyTo.length > 0 && <div><dt>Reply-to</dt><dd><AdminEmailAddresses addresses={result.data.replyTo} userHrefs={userHrefs} /></dd></div>}
            </dl>
          </div>
          {result.data.html ? (
            <iframe className="admin-email-preview" title="Email preview" sandbox="" srcDoc={result.data.html} />
          ) : (
            <div className="admin-panel"><div className="admin-panel-body"><pre className="admin-email-text">{result.data.text || 'Resend did not return a body for this message.'}</pre></div></div>
          )}
        </>
      )}
    </>
  );
}
