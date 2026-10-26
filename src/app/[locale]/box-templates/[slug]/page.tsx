import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { FaqSection } from '@/components/faq-section';
import { DielineGenerator } from '@/components/dieline-generator/dieline-generator';
import { styleForTemplate } from '@/lib/dieline/styles';
import { generatorSetup } from '@/lib/dieline/thumbnails';
import { ES_BOX_TEMPLATE_PAGES, getEsBoxTemplatePage, templateLanguageAlternates } from '@/content/es/box-template-pages';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { activeStyleCount, inactiveTemplateIds } from '@/lib/packaging/template-catalog';
import { getTemplateCatalog, getTemplateSettings } from '@/server/templates';
import { notFoundMetadata } from '@/lib/not-found-metadata';
import { site } from '@/lib/site';
import '../../../box-template-page.css';
import { inlineLinks } from '@/components/inline-links';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { UseTheFile } from '@/components/seo/use-the-file';
import { breadcrumbSchema, jsonLd, softwareApplicationSchema } from '@/lib/seo';

// Spanish template pages: /es/box-templates/<slug>, for the slugs in content/es/box-template-pages.ts.

type Props = { params: Promise<{ locale: string; slug: string }> };

const HOME = { name: 'Inicio', path: '/es' };

// Unknown slugs 404 from the page itself. Not dynamicParams = false: a page
// regenerated after an admin change (a template made inactive redirects)
// would then 404 instead, since Next serves those routes only from the cache.
export const dynamicParams = true;
export function generateStaticParams() { return ES_BOX_TEMPLATE_PAGES.map(page => ({ locale: 'es', slug: page.slug })); }

async function load(params: Props['params']) {
  const { locale, slug } = await params;
  return locale === 'es' ? getEsBoxTemplatePage(slug) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await load(params);
  if (!page) return notFoundMetadata;
  const { es } = page;
  const path = `/es/box-templates/${es.slug}`;
  const image = { url: `/og/templates/${es.slug}.png`, width: 1200, height: 630, alt: `${es.h1}: el troquel y la caja plegada en 3D` };
  return {
    title: { absolute: es.title },
    description: es.description,
    alternates: { canonical: path, languages: templateLanguageAlternates(es.slug) },
    openGraph: { images: [image], title: es.title, description: es.description, type: 'website', url: path, locale: 'es_ES' },
    twitter: { card: 'summary_large_image', title: es.title, description: es.description, images: [image.url] },
  };
}

export default async function SpanishBoxTemplatePage({ params }: Props) {
  const page = await load(params);
  if (!page) notFound();
  const { es, en } = page;
  const template = getPackagingTemplate(en.templateId);
  const style = styleForTemplate(en.templateId);
  if (!template?.defaultDimensions || template.status !== 'ready' || !style) notFound();
  const [catalog, templateRecords] = await Promise.all([getTemplateCatalog(), getTemplateSettings()]);
  const hidden = inactiveTemplateIds(catalog);
  if (hidden.has(en.templateId)) redirect('/es/box-templates');
  // As on the English page: the Studio's width × height × depth, as the generator's length × width × depth.
  const presets = en.presets.map((preset, index) => ({
    label: es.presets[index]?.label ?? preset.label, note: es.presets[index]?.note ?? preset.note,
    length: preset.width, width: preset.depth, depth: preset.height, units: preset.unit,
  }));
  const others = ES_BOX_TEMPLATE_PAGES.filter(other => other.slug !== es.slug && !hidden.has(getEsBoxTemplatePage(other.slug)?.en.templateId ?? ''));
  const path = `/es/box-templates/${es.slug}`;
  const url = new URL(path, site.url).toString();
  const crumbs = [{ name: 'Plantillas de cajas', path: '/es/box-templates' }, { name: es.name, path }];
  const updated = new Date(`${es.updated}T00:00:00Z`).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const schema = jsonLd(
    { '@type': 'WebPage', name: es.h1, description: es.description, url, dateModified: es.updated, inLanguage: 'es' },
    breadcrumbSchema(crumbs, HOME),
    softwareApplicationSchema({
      name: `Generador de troqueles: ${es.name.toLowerCase()}`, path, description: es.description,
      features: ['Cualquier medida en mm o pulgadas', 'Medidas interiores, exteriores o de fabricación', 'Descargas en SVG, PDF, DXF, PNG y Cricut', 'Sin registro', 'Plegado en 3D'],
    }),
    { '@type': 'FAQPage', inLanguage: 'es', mainEntity: es.faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '$1') } })) },
  );

  return <>
    <SiteHeader language="es" alternates={templateLanguageAlternates(es.slug)} />
    <main id="main" className="box-template-page" lang="es">
      <header className="btp-hero">
        <Breadcrumbs crumbs={crumbs} home={HOME} label="Ruta de navegación" className="btp-breadcrumb" />
        <span className="btp-eyebrow">Plantilla de caja</span>
        <h1>{es.h1}</h1>
        <p>{es.intro}</p>
        <p className="btp-updated">Actualizado el <time dateTime={es.updated}>{updated}</time></p>
      </header>

      <DielineGenerator setup={generatorSetup(style.id, presets[0], templateRecords)} presets={presets} locale="es"
        title={`Haz el troquel de tu ${es.name.toLowerCase()}`} page={{ type: 'template_page', slug: `es/${es.slug}`, templateId: en.templateId }} />
      <p className="btp-geometry-note">{es.geometryNote}</p>

      <div className="btp-sections">
        {es.sections.map(section => <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{inlineLinks(section.body)}</p>
          {section.bullets ? <ul>{section.bullets.map(item => <li key={item}>{inlineLinks(item)}</li>)}</ul> : null}
        </section>)}
      </div>

      <UseTheFile name={es.name.toLowerCase()} locale="es" />

      <FaqSection items={es.faqs} eyebrow="Preguntas frecuentes" title={`Preguntas sobre la ${es.name.toLowerCase()}`}
        links={[{ href: '/es/box-dieline-generator', label: 'Generador de troqueles' }, { href: '/es#faq', label: 'Más preguntas' }]} />

      <section className="btp-related" aria-labelledby="btp-related-title">
        <h2 id="btp-related-title">Otras plantillas en español</h2>
        <div className="btp-cards">
          {others.map(other => <Link key={other.slug} href={`/es/box-templates/${other.slug}`}><b>{other.name}</b><span>{other.description}</span></Link>)}
          <Link href="/es/box-dieline-generator"><b>Generador de troqueles</b><span>Los {activeStyleCount(catalog)} estilos de caja, a tu medida, con descarga gratis.</span></Link>
        </div>
      </section>
    </main>
    <SiteFooter language="es" alternates={templateLanguageAlternates(es.slug)} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
  </>;
}
