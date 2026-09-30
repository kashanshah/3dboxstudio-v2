const ENDPOINT = 'https://api.resend.com/emails';
const PAGE_SIZE = 25;

export type SentEmailSummary = {
  id: string;
  to: string[];
  from: string;
  createdAt: string;
  subject: string;
  lastEvent: string;
  replyTo: string[];
};

export type SentEmailDetail = SentEmailSummary & {
  cc: string[];
  bcc: string[];
  html: string | null;
  text: string | null;
};

export type SentEmailPage = {
  emails: SentEmailSummary[];
  hasMore: boolean;
};

type ResendResult<T> = { ok: true; data: T } | { ok: false; error: string };

function addressList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function parseTimestamp(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  let next = value.trim();
  if (/^\d{4}-\d{2}-\d{2} /.test(next)) next = next.replace(' ', 'T');
  next = next.replace(/([+-]\d{2})$/, '$1:00');
  next = next.replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(next);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function mapSummary(row: Record<string, unknown>): SentEmailSummary | null {
  if (typeof row.id !== 'string' || !row.id) return null;
  return {
    id: row.id,
    to: addressList(row.to),
    from: typeof row.from === 'string' ? row.from : '',
    createdAt: parseTimestamp(row.created_at),
    subject: typeof row.subject === 'string' && row.subject.trim() ? row.subject : '(no subject)',
    lastEvent: typeof row.last_event === 'string' ? row.last_event : 'sent',
    replyTo: addressList(row.reply_to),
  };
}

async function resendGet(path: string): Promise<ResendResult<unknown>> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not configured.' };
  const response = await fetch(`${ENDPOINT}${path}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  const body = await response.json().catch(() => null) as { message?: unknown } | null;
  if (!response.ok) {
    const message = typeof body?.message === 'string' && body.message.trim() ? body.message : `Resend request failed (${response.status}).`;
    return { ok: false, error: message };
  }
  return { ok: true, data: body };
}

export function sentEmailCursor(value: string | undefined): string | undefined {
  if (!value || !/^[A-Za-z0-9_-]{8,80}$/.test(value)) return undefined;
  return value;
}

export async function listSentEmails(cursor?: { after?: string; before?: string }): Promise<ResendResult<SentEmailPage>> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor?.after) params.set('after', cursor.after);
  else if (cursor?.before) params.set('before', cursor.before);
  const result = await resendGet(`?${params.toString()}`);
  if (!result.ok) return result;
  const body = result.data as { data?: unknown; has_more?: unknown } | null;
  const rows = Array.isArray(body?.data) ? body.data : [];
  return {
    ok: true,
    data: {
      emails: rows.flatMap((row) => {
        const email = row && typeof row === 'object' ? mapSummary(row as Record<string, unknown>) : null;
        return email ? [email] : [];
      }),
      hasMore: body?.has_more === true,
    },
  };
}

export async function getSentEmail(id: string): Promise<ResendResult<SentEmailDetail>> {
  const emailId = sentEmailCursor(id);
  if (!emailId) return { ok: false, error: 'That email id is not valid.' };
  const result = await resendGet(`/${emailId}`);
  if (!result.ok) return result;
  const row = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : null;
  const summary = row ? mapSummary(row) : null;
  if (!summary) return { ok: false, error: 'Resend did not return that email.' };
  return {
    ok: true,
    data: {
      ...summary,
      cc: addressList(row?.cc),
      bcc: addressList(row?.bcc),
      html: typeof row?.html === 'string' ? row.html : null,
      text: typeof row?.text === 'string' ? row.text : null,
    },
  };
}
