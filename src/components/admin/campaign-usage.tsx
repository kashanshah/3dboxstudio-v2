function quota(value:unknown) {
  if (!value || typeof value!=='object') return 'Unavailable';
  const row=value as {used?:unknown;limit?:unknown};
  return `${typeof row.used==='number'?row.used.toLocaleString():'—'} used / ${typeof row.limit==='number'?row.limit.toLocaleString():row.limit===null?'no fixed limit':'—'}`;
}
export function CampaignUsage({usage}:{usage:Record<string,unknown>}) {
  const emails=usage.emails&&typeof usage.emails==='object'?usage.emails as {daily?:unknown;monthly?:unknown}:{};
  return <dl><dt>Marketing contacts</dt><dd>{quota(usage.contacts)}</dd><dt>Emails today</dt><dd>{quota(emails.daily)}</dd><dt>Emails this month</dt><dd>{quota(emails.monthly)}</dd><dt>Segments</dt><dd>{quota(usage.segments)}</dd></dl>;
}
