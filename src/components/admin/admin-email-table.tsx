'use client';

import { AdminEmailAddresses } from './admin-email-addresses';
import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import type { SentEmailDetail, SentEmailSummary } from '@/server/email/resend-log';

const STATUS_LABELS: Record<string, string> = {
  bounced: 'Bounced',
  canceled: 'Canceled',
  clicked: 'Clicked',
  complained: 'Complained',
  delivered: 'Delivered',
  delivery_delayed: 'Delayed',
  failed: 'Failed',
  opened: 'Opened',
  queued: 'Queued',
  scheduled: 'Scheduled',
  sent: 'Sent',
  suppressed: 'Suppressed',
};

function statusTone(event: string): string {
  if (event === 'delivered' || event === 'opened' || event === 'clicked' || event === 'sent') return 'is-good';
  if (event === 'queued' || event === 'scheduled' || event === 'delivery_delayed') return 'is-warn';
  if (event === 'bounced' || event === 'failed' || event === 'complained' || event === 'suppressed' || event === 'canceled') return 'is-bad';
  return '';
}

function statusLabel(event: string): string {
  return STATUS_LABELS[event] ?? event;
}

export function AdminEmailTable({ emails, userHrefs }: { emails: SentEmailSummary[]; userHrefs: Record<string, string> }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SentEmailDetail | null>(null);
  const [detailUserHrefs, setDetailUserHrefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  function open(id: string) {
    setOpenId(id);
    setDetail(null);
    setError(null);
    setLoading(true);
  }

  function close() {
    setOpenId(null);
  }

  useEffect(() => {
    if (!openId) return;
    let cancelled = false;
    fetch(`/api/admin/emails/${openId}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as { email?: SentEmailDetail; userHrefs?: Record<string, string>; error?: string } | null;
        if (!res.ok) throw new Error(body?.error ?? 'Could not load that email.');
        if (!body?.email) throw new Error('Email response was empty.');
        return { email: body.email, userHrefs: body.userHrefs ?? {} };
      })
      .then(({ email, userHrefs }) => {
        if (cancelled) return;
        setDetail(email);
        setDetailUserHrefs(userHrefs);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load that email.');
        setDetail(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openId]);

  useEffect(() => {
    if (!openId) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenId(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  const summary = emails.find((email) => email.id === openId);
  const subject = detail?.subject ?? summary?.subject ?? 'Email';

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Sent</th>
              <th>To</th>
              <th>Subject</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.id}>
                <td>{email.createdAt ? formatAdminDateTime(email.createdAt) : '—'}</td>
                <td><AdminEmailAddresses addresses={email.to} userHrefs={userHrefs} /></td>
                <td>
                  <button type="button" className="admin-email-open" onClick={() => open(email.id)}>
                    {email.subject}
                  </button>
                </td>
                <td>
                  <span className={`admin-email-status ${statusTone(email.lastEvent)}`}>{statusLabel(email.lastEvent)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && typeof document !== 'undefined' ? createPortal(
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="admin-modal-header">
              <div>
                <h2 id={titleId}>{subject}</h2>
                <p>{statusLabel(detail?.lastEvent ?? summary?.lastEvent ?? 'sent')}</p>
              </div>
              <button type="button" className="admin-modal-close" aria-label="Close email preview" onClick={close} autoFocus>
                <X size={18} />
              </button>
            </header>
            <div className="admin-modal-body">
              {loading && <p className="admin-chart-status">Loading preview…</p>}
              {error && !loading && <p className="admin-error">{error}</p>}
              {detail && !loading && (
                <>
                  <dl className="admin-email-meta">
                    <div><dt>Sent</dt><dd>{detail.createdAt ? formatAdminDateTime(detail.createdAt) : '—'}</dd></div>
                    <div><dt>From</dt><dd><AdminEmailAddresses addresses={[detail.from]} userHrefs={detailUserHrefs} /></dd></div>
                    <div><dt>To</dt><dd><AdminEmailAddresses addresses={detail.to} userHrefs={detailUserHrefs} /></dd></div>
                    {detail.cc.length > 0 && <div><dt>Cc</dt><dd><AdminEmailAddresses addresses={detail.cc} userHrefs={detailUserHrefs} /></dd></div>}
                    {detail.bcc.length > 0 && <div><dt>Bcc</dt><dd><AdminEmailAddresses addresses={detail.bcc} userHrefs={detailUserHrefs} /></dd></div>}
                    {detail.replyTo.length > 0 && <div><dt>Reply-to</dt><dd><AdminEmailAddresses addresses={detail.replyTo} userHrefs={detailUserHrefs} /></dd></div>}
                  </dl>
                  {detail.html ? (
                    <iframe className="admin-email-preview" title="Email preview" sandbox="" srcDoc={detail.html} />
                  ) : (
                    <pre className="admin-email-text">{detail.text || 'Resend did not return a body for this message.'}</pre>
                  )}
                </>
              )}
            </div>
          </section>
        </div>,
        document.querySelector('.admin-root') ?? document.body,
      ) : null}
    </>
  );
}
