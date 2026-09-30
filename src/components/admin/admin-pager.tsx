import Link from 'next/link';

export function AdminPager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="admin-email-pager">
      {page > 1 ? <Link href={href(page - 1)}>Previous</Link> : <span />}
      <span className="admin-muted">Page {page} of {pages}</span>
      {page < pages ? <Link href={href(page + 1)}>Next</Link> : <span />}
    </div>
  );
}
