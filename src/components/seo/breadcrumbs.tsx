import Link from 'next/link';
import type { Crumb } from '@/lib/seo';
import './seo-blocks.css';

/** Visible breadcrumbs: Home › … › the page itself, not linked. Pair with breadcrumbSchema(crumbs). */
export function Breadcrumbs({ crumbs, className }: { crumbs: Crumb[]; className?: string }) {
  const all = [{ name: 'Home', path: '/' }, ...crumbs];
  return <nav className={`seo-breadcrumbs${className ? ` ${className}` : ''}`} aria-label="Breadcrumb">
    <ol>
      {all.map((crumb, index) => <li key={crumb.path}>
        {index < all.length - 1 ? <Link href={crumb.path}>{crumb.name}</Link> : <span aria-current="page">{crumb.name}</span>}
      </li>)}
    </ol>
  </nav>;
}
