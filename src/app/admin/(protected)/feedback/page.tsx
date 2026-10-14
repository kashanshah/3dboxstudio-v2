import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminPager } from '@/components/admin/admin-pager';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { adminDate, adminStars } from '@/components/admin/admin-format';
import { adminListHref } from '@/components/admin/admin-sort-link';
import { adminTemplateName } from '@/lib/admin-template-name';
import { parseAdminPage } from '@/server/admin/catalog';
import { listAdminFeedback } from '@/server/admin/feedback';
import { getExportFeedbackStats } from '@/server/export-feedback';

export const metadata: Metadata = { title: 'Admin — Feedback' };

type Props = { searchParams: Promise<{ rating?: string; comments?: string; page?: string }> };

export default async function FeedbackPage({ searchParams }: Props) {
  const params = await searchParams;
  const [stats, result] = await Promise.all([
    getExportFeedbackStats(),
    listAdminFeedback({ rating: params.rating, comments: params.comments, page: parseAdminPage(params.page) }),
  ]);
  const filters = { rating: result.rating || undefined, comments: result.comments ? '1' : undefined };
  const href = (next: number) => adminListHref('/admin/feedback', { ...filters, page: next > 1 ? next : undefined });
  if (!result.items.length && result.page > 1) redirect(href(1));
  const counts = [stats.one, stats.two, stats.three, stats.four, stats.five];
  const max = Math.max(1, ...counts);
  return <>
    <AdminPageHeader title="Export feedback" description="Ratings and comments people leave after a download, with the design and person each is about." />
    <div className="admin-stat-grid">
      <div className="admin-stat"><span>Average rating</span><strong>{Number(stats.average).toFixed(1)} / 5</strong><small><span className="admin-stars">{adminStars(Number(stats.average))}</span></small></div>
      <div className="admin-stat"><span>Ratings</span><strong>{stats.total.toLocaleString('en-US')}</strong><small>{stats.comments.toLocaleString('en-US')} with a comment</small></div>
      <div className="admin-stat admin-rating-bars">
        <span>By rating</span>
        {counts.map((count, index) => <Link key={index} href={adminListHref('/admin/feedback', { ...filters, rating: result.rating === index + 1 ? undefined : index + 1 })} className={result.rating === index + 1 ? 'is-active' : undefined}>
          <em>{index + 1}★</em><i style={{ width: `${count / max * 100}%` }} /><b>{count}</b>
        </Link>)}
      </div>
    </div>
    <div className="admin-tabs">
      <Link className={!result.comments ? 'is-active' : undefined} href={adminListHref('/admin/feedback', { rating: filters.rating })}>All ratings</Link>
      <Link className={result.comments ? 'is-active' : undefined} href={adminListHref('/admin/feedback', { rating: filters.rating, comments: '1' })}>With comments</Link>
      {result.rating ? <Link href={adminListHref('/admin/feedback', { comments: filters.comments })}>Clear {result.rating}★ filter</Link> : null}
    </div>
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Ratings</h2><p>{result.total.toLocaleString('en-US')} match</p></div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-rich">
          <thead><tr><th>Rating</th><th>Comment</th><th>Design</th><th>Person</th><th>Export</th><th>Date</th></tr></thead>
          <tbody>{result.items.length ? result.items.map((item) => <tr key={item.id}>
            <td><span className="admin-stars" aria-label={`${item.rating} of 5`}>{adminStars(item.rating)}</span></td>
            <td className="admin-message-cell">{item.comment ? <span className="admin-quote-inline">{item.comment}</span> : <span className="admin-muted">—</span>}</td>
            <td>{item.design ? <Link className="admin-thumb-strip" href={`/admin/designs?view=${encodeURIComponent(item.design.id)}`}><AdminDesignThumb src={item.design.thumbnailUrl} name={item.design.name} /><span>{item.design.name}</span></Link> : <span className="admin-muted">Not saved</span>}</td>
            <td>{item.user ? <><Link href={`/admin/users?view=${encodeURIComponent(item.user.id)}`}>{item.user.name}</Link>{item.user.email && item.user.email !== item.user.name ? <small className="admin-cell-sub">{item.user.email}</small> : null}</> : <span className="admin-muted">Guest</span>}</td>
            <td>{item.format.toUpperCase()}<small className="admin-cell-sub">{adminTemplateName(item.templateId)}</small></td>
            <td>{adminDate(item.createdAt)}</td>
          </tr>) : <tr><td colSpan={6}>No feedback matches.</td></tr>}</tbody>
        </table>
      </div>
      <AdminPager page={result.page} total={result.total} pageSize={result.pageSize} href={href} />
    </div>
  </>;
}
