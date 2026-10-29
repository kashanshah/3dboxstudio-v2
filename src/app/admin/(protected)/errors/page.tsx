import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminDrawer, AdminDrawerLoading } from '@/components/admin/admin-drawer';
import { adminCount, adminDate } from '@/components/admin/admin-format';
import { adminListHref } from '@/components/admin/admin-sort-link';
import { ADMIN_DISPLAY_TIME_ZONE, formatAdminDateTime } from '@/lib/admin-time-zone';
import { RETAIN_DAYS, SAMPLES_PER_DAY } from '@/server/error-log';
import { getErrorProblem, listErrorDays, listErrorProblems, parseErrorDay } from '@/server/admin/errors';

export const metadata: Metadata = { title: 'Admin — Errors' };

type Props = { searchParams: Promise<{ day?: string; view?: string }> };

const KIND_LABELS: Record<string, string> = {
  render: 'Page failed to render',
  route: 'API request failed',
  action: 'Server action failed',
  proxy: 'Proxy failed',
  handled: 'Caught in an API request',
  email_delivery: 'Email not delivered',
  google_oauth: 'Google sign-in failed',
  uncaught_error: 'Uncaught error',
  unhandled_rejection: 'Unhandled promise rejection',
  studio_view_crashed: 'Studio view crashed',
};
const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind.replace(/_/g, ' ');

function dayLabel(day: string, today: string, style: 'short' | 'long' = 'long') {
  const date = new Date(`${day}T12:00:00Z`);
  const yesterday = new Date(new Date(`${today}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const name = day === today ? 'Today' : day === yesterday ? 'Yesterday' : null;
  const formatted = date.toLocaleDateString('en-US', style === 'short' ? { weekday: 'short', day: 'numeric', timeZone: 'UTC' } : { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return style === 'short' ? formatted : name ? `${name}, ${formatted}` : formatted;
}
const timeOnly = (iso: string) => new Intl.DateTimeFormat('en-US', { timeZone: ADMIN_DISPLAY_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

function Source({ source }: { source: string }) {
  return <span className={`admin-chip${source === 'server' ? ' is-warn' : ''}`}>{source === 'server' ? 'Server' : 'Browser'}</span>;
}

async function ProblemDrawerBody({ day, fingerprint, dayHref }: { day: string; fingerprint: string; dayHref: (day: string) => string }) {
  const problem = await getErrorProblem(day, fingerprint);
  if (!problem) return <p className="admin-muted">Nothing recorded for this problem on this day.</p>;
  return <>
    <div className="admin-chips"><Source source={problem.source} /><span className="admin-chip">{kindLabel(problem.kind)}</span>{problem.isNew ? <span className="admin-chip is-warn">New</span> : null}</div>
    <p className="admin-error-message">{problem.message}</p>
    <dl className="admin-facts">
      <div><dt>This day</dt><dd>{adminCount(problem.count, 'time')}</dd></div>
      <div><dt>First this day</dt><dd>{timeOnly(problem.firstAt)}</dd></div>
      <div><dt>Last this day</dt><dd>{timeOnly(problem.lastAt)}</dd></div>
      <div><dt>First seen</dt><dd>{problem.firstDay === day ? 'This day' : <Link href={dayHref(problem.firstDay)}>{problem.firstDay}</Link>}</dd></div>
    </dl>
    {problem.history.length > 1 ? <>
      <h3 className="admin-drawer-subhead">Days it happened</h3>
      <ul className="admin-error-history">{problem.history.map(item => <li key={item.day}><Link href={dayHref(item.day)} aria-current={item.day === day ? 'date' : undefined}>{item.day}</Link><b>{item.count.toLocaleString('en-US')}</b></li>)}</ul>
    </> : null}
    <h3 className="admin-drawer-subhead">Occurrences{problem.count > problem.samplesKept ? ` (the first ${problem.samplesKept} of ${problem.count.toLocaleString('en-US')})` : ''}</h3>
    <ol className="admin-error-samples">{problem.samples.map(sample => {
      const { stack, user_agent: agent, ...rest } = sample.details;
      return <li key={sample.id}>
        <header><time dateTime={sample.occurredAt}>{formatAdminDateTime(sample.occurredAt)}</time>{sample.path ? <code>{sample.path}</code> : null}</header>
        <p>{sample.user ? <Link href={`/admin/users?view=${encodeURIComponent(sample.user.id)}`}>{sample.user.name}</Link> : <span className="admin-muted">Signed out, or no account involved</span>}</p>
        {Object.keys(rest).length ? <dl className="admin-error-details">{Object.entries(rest).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl> : null}
        {typeof agent === 'string' ? <p className="admin-cell-sub">{agent}</p> : null}
        {typeof stack === 'string' ? <details><summary>Stack</summary><pre className="admin-error-stack">{stack}</pre></details> : null}
      </li>;
    })}</ol>
  </>;
}

export default async function AdminErrorsPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const today = parseErrorDay(undefined, now);
  const day = parseErrorDay(params.day, now);
  const view = (params.view ?? '').trim().slice(0, 40);
  const [days, problems] = await Promise.all([listErrorDays(now), listErrorProblems(day)]);
  const dayHref = (next: string) => adminListHref('/admin/errors', { day: next === today ? undefined : next });
  const viewHref = (fingerprint: string) => adminListHref('/admin/errors', { day: day === today ? undefined : day, view: fingerprint });
  const listHref = dayHref(day);
  const selected = days.find(item => item.day === day) ?? { day, total: problems.reduce((sum, item) => sum + item.count, 0), problems: problems.length, server: 0, client: 0 };
  const newCount = problems.filter(item => item.isNew).length;
  const max = Math.max(1, ...days.map(item => item.total));
  const previous = new Date(new Date(`${day}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  const next = new Date(new Date(`${day}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);

  return <div className={view ? 'admin-split has-drawer' : 'admin-split'}>
    <div className="admin-split-main">
      <AdminPageHeader title="Errors" description={`What went wrong on the server and in visitors' browsers, day by day (${ADMIN_DISPLAY_TIME_ZONE} time). The same problem is counted together; kept for ${RETAIN_DAYS} days.`} />
      <nav className="admin-error-days" aria-label="Days">
        {days.map(item => <Link key={item.day} href={dayHref(item.day)} aria-current={item.day === day ? 'date' : undefined} title={`${dayLabel(item.day, today)}: ${adminCount(item.total, 'error')}`}>
          <i style={{ height: `${item.total ? Math.max(8, item.total / max * 100) : 0}%` }} />
          <b>{item.total.toLocaleString('en-US')}</b>
          <small>{item.day === today ? 'Today' : dayLabel(item.day, today, 'short')}</small>
        </Link>)}
      </nav>
      <div className="admin-error-daynav">
        <Link href={dayHref(previous)}>← Previous day</Link>
        <h2>{dayLabel(day, today)}</h2>
        {day < today ? <Link href={dayHref(next)}>Next day →</Link> : <span />}
      </div>
      <div className="admin-stat-grid admin-error-stats">
        <div className="admin-stat"><span>Errors</span><strong>{selected.total.toLocaleString('en-US')}</strong></div>
        <div className="admin-stat"><span>Different problems</span><strong>{problems.length.toLocaleString('en-US')}</strong><small>{newCount ? `${newCount} new` : 'None new'}</small></div>
        <div className="admin-stat"><span>Server</span><strong>{selected.server.toLocaleString('en-US')}</strong></div>
        <div className="admin-stat"><span>Browser</span><strong>{selected.client.toLocaleString('en-US')}</strong></div>
      </div>
      <div className="admin-panel">
        <div className="admin-panel-header"><h2>Problems</h2><p>Most frequent first. Select one for when and where it happened; up to {SAMPLES_PER_DAY} occurrences a day are kept in full.</p></div>
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-rich">
            <thead><tr><th>Problem</th><th>Times</th><th>Last</th></tr></thead>
            <tbody>{problems.length ? problems.map(problem => <tr key={problem.fingerprint} className={problem.fingerprint === view ? 'is-selected' : undefined}>
              <td className="admin-message-cell"><span className="admin-error-tags"><Source source={problem.source} />{problem.isNew ? <span className="admin-chip is-warn">New</span> : null}</span><Link href={viewHref(problem.fingerprint)} scroll={false}>{kindLabel(problem.kind)}</Link><small className="admin-cell-sub admin-error-line">{problem.message}</small>{problem.path ? <small className="admin-cell-sub"><code>{problem.path}</code></small> : null}</td>
              <td>{problem.count.toLocaleString('en-US')}</td>
              <td>{timeOnly(problem.lastAt)}</td>
            </tr>) : <tr><td colSpan={4}>No errors recorded {day === today ? 'yet today' : 'on this day'}.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <p className="admin-muted admin-error-note">Updated {adminDate(now.toISOString())}. Browser errors come from this site&apos;s own scripts only; extensions and other sites&apos; scripts are left out.</p>
    </div>
    {view ? <AdminDrawer title="Problem" closeHref={listHref}>
      <Suspense key={`${day}:${view}`} fallback={<AdminDrawerLoading />}><ProblemDrawerBody day={day} fingerprint={view} dayHref={dayHref} /></Suspense>
    </AdminDrawer> : null}
  </div>;
}
