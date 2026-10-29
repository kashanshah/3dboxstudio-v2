import Link from 'next/link';
import { listErrorDays } from '@/server/admin/errors';

/** On the dashboard: errors today and yesterday, each linking to its day in Admin → Errors. */
export async function AdminErrorSummary() {
  const days = await listErrorDays().catch(() => null);
  if (!days) return null;
  const today = days.at(-1)!, yesterday = days.at(-2)!;
  const count = (value: number) => `${value.toLocaleString('en-US')} error${value === 1 ? '' : 's'}`;
  return <div className={`admin-error-summary${today.total || yesterday.total ? ' has-errors' : ''}`}>
    <strong>Errors</strong>
    <Link href="/admin/errors">{count(today.total)} today</Link>
    <Link href={`/admin/errors?day=${yesterday.day}`}>{count(yesterday.total)} yesterday</Link>
  </div>;
}
