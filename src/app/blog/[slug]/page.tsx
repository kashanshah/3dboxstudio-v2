import type { Metadata } from 'next';
import { notFoundMetadata } from '@/lib/not-found-metadata';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { ContentPageShell, StudioCta } from '@/components/content-page-shell';
import { AdaptiveArticleImage } from '@/components/adaptive-article-image';
import { BlogShareButtons } from '@/components/blog-share-buttons';
import { BLOG_POSTS, getBlogPostBySlug, getBlogCategory, getBlogCategoryLabel, getBlogPostImagePath } from '@/content/blogPosts';
import { site } from '@/lib/site';
import { FR_BLOG_POSTS } from '@/content/blogLocales/fr';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return notFoundMetadata;
  const path = `/blog/${post.slug}`;
  const image = getBlogPostImagePath(post.slug);
  return {
    title: { absolute: post.seoTitle ?? `${post.title} | 3D Box Studio` },
    description: post.description,
    keywords: post.keywords,
    // Hreflang must be declared on both language versions or Google ignores it.
    alternates: FR_BLOG_POSTS[post.slug]
      ? { canonical: path, languages: { en: path, fr: `/fr${path}`, 'x-default': path } }
      : { canonical: path },
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.description,
      type: 'article',
      url: path,
      publishedTime: post.published,
      modifiedTime: post.updated,
      images: [{ url: image, width: 1200, height: 800, alt: post.imageAlt ?? post.title }],
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description, images: [image] },
  };
}

function inlineText(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(\/[^)]+\))/g);
  return parts.map((part, index) => {
    const match = /^\[([^\]]+)\]\((\/[^)]+)\)$/.exec(part);
    return match ? <Link key={index} href={match[2]}>{match[1]}</Link> : part;
  });
}

function headingId(text: string, index: number) {
  return `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${index}`;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const canonical = new URL(`/blog/${post.slug}`, site.url).toString();
  const toc = post.sections.flatMap((section, index) => section.type === 'h2' ? [{ id: headingId(section.text, index), text: section.text }] : []);
  const related = (post.relatedSlugs?.map((relatedSlug) => getBlogPostBySlug(relatedSlug)).filter(Boolean) ?? BLOG_POSTS.filter((item) => item.slug !== post.slug).slice(0, 3)) as typeof BLOG_POSTS;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    mainEntityOfPage: canonical,
    author: { '@type': 'Organization', name: '3D Box Studio' },
    publisher: { '@type': 'Organization', name: '3D Box Studio' },
    image: new URL(getBlogPostImagePath(post.slug), site.url).toString(),
  };
  const faqSchema = post.faqs?.length ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '$1') },
    })),
  } : null;

  return <ContentPageShell>
    <article>
      <header className="content-article-header">
        <Link className="content-text-link" href="/blog"><ArrowLeft size={16}/> All guides</Link>
        <p className="content-eyebrow">{getBlogCategoryLabel(getBlogCategory(post.slug))}</p>
        <h1>{post.title}</h1>
        <p className="content-article-summary">{post.description}</p>
        <div className="content-article-meta"><time dateTime={post.published}>{new Date(post.published + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>{post.updated ? <><span>Updated {new Date(post.updated + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></> : null}<span>{post.readMinutes} min read</span></div>
      </header>

      <BlogShareButtons title={post.title} url={canonical} />

      <AdaptiveArticleImage src={getBlogPostImagePath(post.slug)} alt={post.imageAlt ?? `${post.title} — packaging preview thumbnail`} />

      <div className="content-article-layout">
        <nav className="content-article-toc" aria-label="On this page"><p>On this page</p>{toc.map((item) => <a href={`#${item.id}`} key={item.id}>{item.text}</a>)}</nav>
        {/* Stacked layouts get a collapsed list instead of a sideways-scrolling pill row. */}
        {toc.length ? <details className="content-article-toc-mobile"><summary>On this page <span>{toc.length} sections</span></summary><nav aria-label="On this page (mobile)">{toc.map((item) => <a href={`#${item.id}`} key={item.id}>{item.text}</a>)}</nav></details> : null}
        <div className="content-article-body">
          {post.sections.map((section, index) => {
            if (section.type === 'p') return <p key={index}>{inlineText(section.text)}</p>;
            if (section.type === 'h2') return <h2 id={headingId(section.text, index)} key={index}>{section.text}</h2>;
            if (section.type === 'h3') return <h3 key={index}>{section.text}</h3>;
            if (section.type === 'ul') return <ul key={index}>{section.items.map((item) => <li key={item}>{inlineText(item)}</li>)}</ul>;
            if (section.type === 'ol') return <ol key={index}>{section.items.map((item) => <li key={item}>{inlineText(item)}</li>)}</ol>;
            if (section.type === 'callout') return <aside className="content-article-callout" key={index}>{inlineText(section.text)}</aside>;
            if (section.type === 'cta') return <div className="content-article-cta" key={index}><Link className="button" href={section.href ?? '/studio'}>{section.label}<ArrowUpRight size={16}/></Link></div>;
            if (section.type === 'faq') return post.faqs?.length ? <section className="content-article-faq" key={index}>{post.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{inlineText(faq.answer)}</p></details>)}</section> : null;
            return null;
          })}
          {post.faqs?.length && !post.sections.some((section) => section.type === 'faq') ? <section className="content-article-faq"><h2>Frequently asked questions</h2>{post.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{inlineText(faq.answer)}</p></details>)}</section> : null}
        </div>
      </div>
    </article>

    <nav className="related-tools" aria-labelledby="related-tools-title">
      <p className="content-eyebrow">Try it in the Studio</p>
      <h2 id="related-tools-title">Free 3D box tools</h2>
      <ul>
        <li><Link href="/3d-box-mockup-generator"><strong>3D box mockup generator</strong><span>Turn your artwork into a 3D box mockup from real dimensions.</span></Link></li>
        <li><Link href="/box-dieline-generator"><strong>Box dieline generator</strong><span>Generate a flat dieline with cut, crease and bleed guides.</span></Link></li>
        <li><Link href="/box-templates"><strong>Box templates</strong><span>Reverse and straight tuck end cartons, split-top shipping boxes and pizza boxes.</span></Link></li>
        <li><Link href="/pacdora-alternative"><strong>Pacdora alternative</strong><span>A free browser workflow for dieline-to-3D packaging previews.</span></Link></li>
      </ul>
    </nav>

    {related.length ? <section className="related-section"><p className="content-eyebrow">Keep reading</p><h2>Related packaging guides</h2><div className="content-article-grid">{related.slice(0,3).map((item) => <article className="content-article-card" key={item.slug}><Link href={`/blog/${item.slug}`}><div className="content-article-card-media"><img loading="lazy" src={getBlogPostImagePath(item.slug)} alt="" width="1200" height="800"/></div><div className="content-article-meta"><span>{getBlogCategoryLabel(getBlogCategory(item.slug))}</span><span>{item.readMinutes} min read</span></div><h3>{item.title}</h3><p>{item.description}</p></Link></article>)}</div></section> : null}

    <StudioCta title="Put the next packaging concept into motion." />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
    {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} /> : null}
  </ContentPageShell>;
}
