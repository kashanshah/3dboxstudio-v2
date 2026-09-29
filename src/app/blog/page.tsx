import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { BLOG_CATEGORIES, BLOG_INDEX_DESCRIPTION, BLOG_INDEX_TITLE, BLOG_POSTS, getBlogCategory, getBlogCategoryLabel } from '@/content/blogPosts';

export const metadata: Metadata = {
  title: { absolute: BLOG_INDEX_TITLE },
  description: BLOG_INDEX_DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { title: BLOG_INDEX_TITLE, description: BLOG_INDEX_DESCRIPTION, type: 'website', url: '/blog' },
};

export default function Blog() {
  return <>
    <SiteHeader />
    <main id="main" className="journal-page section seo-journal">
      <span className="eyebrow">PACKAGING GUIDES</span>
      <h1>Learn 3D box design & simulation.</h1>
      <p className="page-intro">{BLOG_POSTS.length} practical articles on 3D box makers, packaging mockups, folding cartons, mailers, e-commerce visuals, and browser-based packaging workflows.</p>
      <div className="journal-categories" aria-label="Article categories">
        {BLOG_CATEGORIES.map((category) => <span key={category.id}>{category.label}</span>)}
      </div>
      <div className="journal-grid">
        {BLOG_POSTS.map((post) => (
          <article className="journal-card" key={post.slug}>
            <div className="journal-card-meta"><span>{getBlogCategoryLabel(getBlogCategory(post.slug))}</span><span>{post.readMinutes} min read</span></div>
            <h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <Link href={`/blog/${post.slug}`} className="text-link">Read guide <ArrowUpRight size={15} /></Link>
          </article>
        ))}
      </div>
    </main>
    <SiteFooter />
  </>;
}
