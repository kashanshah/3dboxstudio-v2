import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { FaqSection } from '@/components/faq-section';
import { DielineGenerator } from '@/components/dieline-generator/dieline-generator';
import { styleForTemplate } from '@/lib/dieline/styles';
import { generatorSetup } from '@/lib/dieline/thumbnails';
import { BOX_TEMPLATE_PAGES, getBoxTemplatePage, relatedTemplatePages } from '@/content/box-template-pages';
import { getBlogPostBySlug } from '@/content/blogPosts';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { notFoundMetadata } from '@/lib/not-found-metadata';
import { site } from '@/lib/site';
import '../../box-template-page.css';
import { inlineLinks } from '@/components/inline-links';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { UseTheFile } from '@/components/seo/use-the-file';
import { breadcrumbSchema, jsonLd, softwareApplicationSchema } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export function generateStaticParams() { return BOX_TEMPLATE_PAGES.map(page => ({ slug: page.slug })); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getBoxTemplatePage((await params).slug);
  if (!page) return notFoundMetadata;
  const path = `/box-templates/${page.slug}`;
  // Rendered per page by scripts/render-template-og.cjs.
  const image = { url: `/og/templates/${page.slug}.png`, width: 1200, height: 630, alt: `${page.h1}: the dieline and the box folded in 3D` };
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: path },
    openGraph: { images: [image], title: page.title, description: page.description, type: 'website', url: path },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [image.url] },
  };
}

export default async function BoxTemplateLandingPage({ params }: Props) {
  const page = getBoxTemplatePage((await params).slug);
  if (!page) notFound();
  const template = getPackagingTemplate(page.templateId);
  const style = styleForTemplate(page.templateId);
  if (!template?.defaultDimensions || template.status !== 'ready' || !style) notFound();
  // The pages list sizes as the Studio takes them; the generator as length × width × depth.
  const presets = page.presets.map(preset => ({ label: preset.label, note: preset.note, length: preset.width, width: preset.depth, depth: preset.height, units: preset.unit }));
  const related = relatedTemplatePages(page);
  const guides = page.guides.map(slug => getBlogPostBySlug(slug)).filter(post => post !== undefined);
  const path = `/box-templates/${page.slug}`;
  const url = new URL(path, site.url).toString();
  const crumbs = [{ name: 'Box templates', path: '/box-templates' }, { name: page.name, path }];
  const updated = new Date(`${page.updated}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const schema = jsonLd(
    { '@type': 'WebPage', name: page.h1, description: page.description, url, dateModified: page.updated },
    breadcrumbSchema(crumbs),
    softwareApplicationSchema({
      name: `${page.name} dieline generator`, path, description: page.description,
      features: ['Any size in mm or inches', 'Inside, outside or crease-to-crease sizes', 'SVG, PDF, DXF, PNG and Cricut downloads', 'No sign-up', 'Fold it in 3D'],
    }),
    { '@type': 'FAQPage', mainEntity: page.faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '$1') } })) },
  );

  return <>
    <SiteHeader />
    <main id="main" className="box-template-page">
      <header className="btp-hero">
        <Breadcrumbs crumbs={crumbs} className="btp-breadcrumb" />
        <span className="btp-eyebrow">{page.eyebrow}</span>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
        <p className="btp-updated">Last updated <time dateTime={page.updated}>{updated}</time></p>
      </header>

      <DielineGenerator setup={generatorSetup(style.id, presets[0])} presets={presets} title={`Make your ${page.name.toLowerCase()} dieline`} page={{ type: 'template_page', slug: page.slug, templateId: page.templateId }} />
      <p className="btp-geometry-note">{page.geometryNote}</p>

      <div className="btp-sections">
        {page.sections.map(section => <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{inlineLinks(section.body)}</p>
          {section.bullets ? <ul>{section.bullets.map(item => <li key={item}>{inlineLinks(item)}</li>)}</ul> : null}
        </section>)}
        {page.bestFor?.length ? <section>
          <h2>Best for</h2>
          <ul>{page.bestFor.map(item => <li key={item}>{inlineLinks(item)}</li>)}</ul>
          {page.notIdealFor?.length ? <><h3>Not ideal for</h3><ul>{page.notIdealFor.map(item => <li key={item}>{inlineLinks(item)}</li>)}</ul></> : null}
        </section> : null}
        {page.materials?.length ? <section>
          <h2>Recommended materials</h2>
          <table className="btp-table"><thead><tr><th scope="col">Board</th><th scope="col">Caliper</th><th scope="col">Suits</th></tr></thead>
            <tbody>{page.materials.map(row => <tr key={row.board}><th scope="row">{row.board}</th><td>{row.caliper}</td><td>{row.use}</td></tr>)}</tbody></table>
        </section> : null}
      </div>

      <UseTheFile name={page.name.toLowerCase()} />

      <FaqSection items={page.faqs} title={`${page.name} questions`} links={[{ href: '/faq', label: 'Full FAQ' }, { href: '/box-dieline-generator', label: 'Box dieline generator' }]} />

      <section className="btp-related" aria-labelledby="btp-related-title">
        <h2 id="btp-related-title">Related box styles</h2>
        <div className="btp-cards">
          {related.map(other => <Link key={other.slug} href={`/box-templates/${other.slug}`}><b>{other.name}</b><span>{other.description}</span></Link>)}
          <Link href="/box-templates"><b>All {BOX_TEMPLATE_PAGES.length} box templates</b><span>Every style, with its dieline and 3D fold.</span></Link>
        </div>
        {guides.length ? <>
          <h2>Related guides</h2>
          <ul className="btp-guides">{guides.map(post => <li key={post.slug}><Link href={`/blog/${post.slug}`}>{post.title} <ArrowRight /></Link></li>)}</ul>
        </> : null}
      </section>
    </main>
    <SiteFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
  </>;
}
