import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { FaqSection } from '@/components/faq-section';
import { BoxTemplateTool } from '@/components/box-template-tool';
import { BOX_TEMPLATE_PAGES, getBoxTemplatePage } from '@/content/box-template-pages';
import { getBlogPostBySlug } from '@/content/blogPosts';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { notFoundMetadata } from '@/lib/not-found-metadata';
import { site, defaultOgImage } from '@/lib/site';
import '../../box-template-page.css';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() { return BOX_TEMPLATE_PAGES.map(page => ({ slug: page.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getBoxTemplatePage((await params).slug);
  if (!page) return notFoundMetadata;
  const path = `/box-templates/${page.slug}`;
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: path },
    openGraph: { images: [defaultOgImage], title: page.title, description: page.description, type: 'website', url: path },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [defaultOgImage.url] },
  };
}

export default async function BoxTemplateLandingPage({ params }: Props) {
  const page = getBoxTemplatePage((await params).slug);
  if (!page) notFound();
  const template = getPackagingTemplate(page.templateId);
  if (!template?.defaultDimensions || template.status !== 'ready') notFound();
  const others = BOX_TEMPLATE_PAGES.filter(other => other.slug !== page.slug);
  const guides = page.guides.map(slug => getBlogPostBySlug(slug)).filter(post => post !== undefined);
  const url = new URL(`/box-templates/${page.slug}`, site.url).toString();
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', name: page.h1, description: page.description, url, dateModified: page.updated,
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Box templates', item: new URL('/box-templates', site.url).toString() },
        { '@type': 'ListItem', position: 2, name: page.name, item: url },
      ] } },
    { '@type': 'FAQPage', mainEntity: page.faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
  ] };

  return <>
    <SiteHeader />
    <main id="main" className="box-template-page">
      <header className="btp-hero">
        <nav className="btp-breadcrumb" aria-label="Breadcrumb"><Link href="/box-templates">Box templates</Link><span aria-hidden="true">/</span><span aria-current="page">{page.name}</span></nav>
        <span className="btp-eyebrow">{page.eyebrow}</span>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
      </header>

      <BoxTemplateTool templateId={page.templateId} name={page.name} fields={page.fields} presets={page.presets} thickness={template.defaultDimensions.thickness} geometryNote={page.geometryNote} />

      <div className="btp-sections">
        {page.sections.map(section => <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          {section.bullets ? <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul> : null}
        </section>)}
      </div>

      <FaqSection items={page.faqs} title={`${page.name} questions`} links={[{ href: '/faq', label: 'Full FAQ' }, { href: '/box-dieline-generator', label: 'Box dieline generator' }]} />

      <section className="btp-related" aria-labelledby="btp-related-title">
        <h2 id="btp-related-title">More box templates</h2>
        <div className="btp-cards">
          {others.map(other => <Link key={other.slug} href={`/box-templates/${other.slug}`}><b>{other.name}</b><span>{other.description}</span></Link>)}
          <Link href="/box-templates"><b>All templates</b><span>Every supported structure, plus what is planned next.</span></Link>
        </div>
        {guides.length ? <>
          <h2>Related guides</h2>
          <ul className="btp-guides">{guides.map(post => <li key={post.slug}><Link href={`/blog/${post.slug}`}>{post.title} <ArrowRight /></Link></li>)}</ul>
        </> : null}
      </section>
    </main>
    <SiteFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  </>;
}
