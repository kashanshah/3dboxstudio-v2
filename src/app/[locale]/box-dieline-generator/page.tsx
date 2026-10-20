import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { FaqSection } from '@/components/faq-section';
import { DielineGenerator } from '@/components/dieline-generator/dieline-generator';
import { generatorSetup } from '@/lib/dieline/thumbnails';
import { ES_BOX_TEMPLATE_PAGES } from '@/content/es/box-template-pages';
import { ES_GENERATOR_PAGE as page } from '@/content/es/dieline-generator';
import { defaultOgImage, site } from '@/lib/site';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { UseTheFile } from '@/components/seo/use-the-file';
import { breadcrumbSchema, jsonLd, softwareApplicationSchema } from '@/lib/seo';
import '../../box-template-page.css';

// Spanish /es/box-dieline-generator.

type Props = { params: Promise<{ locale: string }> };

const PATH = '/es/box-dieline-generator';
const HOME = { name: 'Inicio', path: '/es' };
const LANGUAGES = { en: '/box-dieline-generator', es: PATH, 'x-default': '/box-dieline-generator' };

export const dynamicParams = false;
export function generateStaticParams() { return [{ locale: 'es' }]; }

export const metadata: Metadata = {
  title: { absolute: page.title },
  description: page.description,
  alternates: { canonical: PATH, languages: LANGUAGES },
  openGraph: { images: [defaultOgImage], title: page.title, description: page.description, type: 'website', url: PATH, locale: 'es_ES' },
};

export default async function SpanishDielineGeneratorPage({ params }: Props) {
  if ((await params).locale !== 'es') notFound();
  const url = new URL(PATH, site.url).toString();
  const crumbs = [{ name: 'Generador de troqueles', path: PATH }];
  const schema = jsonLd(
    { '@type': 'WebPage', name: page.h1, description: page.description, url, inLanguage: 'es' },
    breadcrumbSchema(crumbs, HOME),
    softwareApplicationSchema({
      name: 'Generador de troqueles de cajas', path: PATH, description: page.description,
      features: ['15 estilos de caja', 'Medidas interiores, exteriores y de fabricación', 'Descargas en SVG, PDF, DXF y PNG', 'Archivos para Cricut y Silhouette', 'PDF en mosaico para imprimir en casa', 'Sin registro'],
    }),
    { '@type': 'FAQPage', inLanguage: 'es', mainEntity: page.faqs.map(item => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) },
  );

  return <>
    <SiteHeader language="es" alternates={LANGUAGES} />
    <main id="main" className="box-template-page" lang="es">
      <header className="btp-hero">
        <Breadcrumbs crumbs={crumbs} home={HOME} label="Ruta de navegación" className="btp-breadcrumb" />
        <span className="btp-eyebrow">Generador de troqueles</span>
        <h1>{page.h1}</h1>
        <p>{page.intro}</p>
      </header>

      <DielineGenerator setup={generatorSetup('reverse-tuck-end')} locale="es" title="Elige un estilo y unas medidas" page={{ type: 'dieline_generator', slug: 'es/box-dieline-generator' }} />

      <div className="btp-sections">
        {page.sections.map(section => <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
          {section.bullets ? <ul>{section.bullets.map(item => <li key={item}>{item}</li>)}</ul> : null}
        </section>)}
      </div>

      <UseTheFile name="caja" locale="es" />

      <FaqSection items={page.faqs} eyebrow="Preguntas frecuentes" title="Preguntas sobre el generador de troqueles"
        links={[{ href: '/es/box-templates', label: 'Plantillas de cajas' }, { href: '/es#faq', label: 'Más preguntas' }]} />

      <section className="btp-related" aria-labelledby="btp-related-title">
        <h2 id="btp-related-title">Plantillas con guía en español</h2>
        <div className="btp-cards">
          {ES_BOX_TEMPLATE_PAGES.map(other => <Link key={other.slug} href={`/es/box-templates/${other.slug}`}><b>{other.name}</b><span>{other.description}</span></Link>)}
        </div>
      </section>
    </main>
    <SiteFooter language="es" alternates={LANGUAGES} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
  </>;
}
