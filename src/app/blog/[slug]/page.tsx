import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { BLOG_POSTS, getBlogPostBySlug } from '@/content/blogPosts';
import { site } from '@/lib/site';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) return {};
  const path = `/blog/${post.slug}`;
  const image = `/images/blog/${post.slug}.webp`;
  return {
    title: { absolute: post.seoTitle ?? `${post.title} | 3D Box Studio` },
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: path },
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

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);
  if (!post) notFound();

  const canonical = new URL(`/blog/${post.slug}`, site.url).toString();
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
    image: new URL(`/images/blog/${post.slug}.webp`, site.url).toString(),
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

  return <>
    <SiteHeader />
    <main id="main" className="article-shell">
      <article className="article-page">
        <Link className="article-back" href="/blog"><ArrowLeft size={15}/> All guides</Link>
        <div className="article-heading">
          <span className="eyebrow">3D BOX STUDIO GUIDE</span>
          <h1>{post.title}</h1>
          <p>{post.description}</p>
          <div className="article-meta"><time dateTime={post.published}>{new Date(post.published + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</time>{post.updated ? <><span>·</span><span>Updated {new Date(post.updated + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></> : null}<span>·</span><span>{post.readMinutes} min read</span></div>
        </div>
        <img className="article-hero-image" src={`/images/blog/${post.slug}.webp`} alt={post.imageAlt ?? `${post.title} — packaging preview thumbnail`} width="1200" height="800" />
        <div className="article-content">
          {post.sections.map((section, index) => {
            if (section.type === 'p') return <p key={index}>{inlineText(section.text)}</p>;
            if (section.type === 'h2') return <h2 key={index}>{section.text}</h2>;
            if (section.type === 'h3') return <h3 key={index}>{section.text}</h3>;
            if (section.type === 'ul') return <ul key={index}>{section.items.map((item) => <li key={item}>{inlineText(item)}</li>)}</ul>;
            if (section.type === 'ol') return <ol key={index}>{section.items.map((item) => <li key={item}>{inlineText(item)}</li>)}</ol>;
            if (section.type === 'callout') return <aside className="article-callout" key={index}>{inlineText(section.text)}</aside>;
            if (section.type === 'cta') return <div className="article-cta" key={index}><Link className="button" href={section.href ?? '/studio'}>{section.label}<ArrowUpRight size={16}/></Link></div>;
            if (section.type === 'faq') return post.faqs?.length ? <section className="article-faq" key={index}>{post.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{inlineText(faq.answer)}</p></details>)}</section> : null;
            return null;
          })}
        </div>
        {post.faqs?.length && !post.sections.some((s) => s.type === 'faq') ? <section className="article-content article-faq"><h2>Frequently asked questions</h2>{post.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{inlineText(faq.answer)}</p></details>)}</section> : null}
        <nav className="article-next" aria-label="More packaging guides"><Link href="/blog">Explore all packaging guides <ArrowUpRight size={16}/></Link></nav>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} /> : null}
    </main>
    <SiteFooter />
  </>;
}
