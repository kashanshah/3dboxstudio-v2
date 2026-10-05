import { defaultOgImage } from '@/lib/site';
import type { Metadata } from 'next';
import { BlogExplorer } from '@/components/blog-explorer';
import { ContentHero, ContentPageShell, StudioCta } from '@/components/content-page-shell';
import { BLOG_CATEGORIES, BLOG_INDEX_DESCRIPTION, BLOG_INDEX_TITLE, BLOG_POSTS, getBlogCategory, getBlogCategoryLabel, getBlogPostImagePath } from '@/content/blogPosts';

export const metadata: Metadata = {
  title: { absolute: BLOG_INDEX_TITLE },
  description: BLOG_INDEX_DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: { images:[defaultOgImage], title: BLOG_INDEX_TITLE, description: BLOG_INDEX_DESCRIPTION, type: 'website', url: '/blog' },
};

export default function Blog() {
  const articles = BLOG_POSTS.map((post) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    category: getBlogCategoryLabel(getBlogCategory(post.slug)),
    readMinutes: post.readMinutes,
    image: getBlogPostImagePath(post.slug),
  }));
  return <ContentPageShell>
    <ContentHero eyebrow="Packaging guides" title="Ideas worth unboxing." intro={`${BLOG_POSTS.length} practical guides on 3D box design, packaging mockups, folding cartons, mailers, e-commerce visuals, and browser-based packaging workflows.`} />
    <BlogExplorer articles={articles} categories={BLOG_CATEGORIES.map((category) => category.label)} />
    <StudioCta title="Turn the next packaging idea into something you can inspect." />
  </ContentPageShell>;
}
