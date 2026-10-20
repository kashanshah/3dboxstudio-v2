import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SiteFooter, SiteHeader } from '@/components/site-shell';
import { ES_BOX_TEMPLATE_PAGES } from '@/content/es/box-template-pages';
import { BOX_TEMPLATE_PAGES } from '@/content/box-template-pages';
import { defaultOgImage, site } from '@/lib/site';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { breadcrumbSchema, jsonLd } from '@/lib/seo';
import '../../box-template-page.css';

// Spanish hub: the template pages with a Spanish version, and the generator.

type Props = { params: Promise<{ locale: string }> };

const PATH = '/es/box-templates';
const HOME = { name: 'Inicio', path: '/es' };
const TITLE = 'Plantillas de cajas gratis con troquel y mockup 3D | 3D Box Studio';
const LANGUAGES = { en: '/box-templates', es: PATH };
const DESCRIPTION = 'Plantillas de cajas gratis: caja de cierre inverso, caja postal, caja de pizza, caja americana y caja almohada. Introduce tus medidas, descarga el troquel y pliega la caja en 3D.';

export const dynamicParams = false;
export function generateStaticParams() { return [{ locale: 'es' }]; }

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: PATH, languages: { ...LANGUAGES, 'x-default': '/box-templates' } },
  openGraph: { images: [defaultOgImage], title: TITLE, description: DESCRIPTION, type: 'website', url: PATH, locale: 'es_ES' },
};

export default async function SpanishBoxTemplatesPage({ params }: Props) {
  if ((await params).locale !== 'es') notFound();
  const crumbs = [{ name: 'Plantillas de cajas', path: PATH }];
  const schema = jsonLd(
    { '@type': 'CollectionPage', name: 'Plantillas de cajas', description: DESCRIPTION, url: new URL(PATH, site.url).toString(), inLanguage: 'es' },
    breadcrumbSchema(crumbs, HOME),
    { '@type': 'ItemList', itemListElement: ES_BOX_TEMPLATE_PAGES.map((page, index) => ({ '@type': 'ListItem', position: index + 1, name: page.name, url: new URL(`/es/box-templates/${page.slug}`, site.url).toString() })) },
  );

  return <>
    <SiteHeader language="es" alternates={LANGUAGES} />
    <main id="main" className="box-template-page" lang="es">
      <header className="btp-hero">
        <Breadcrumbs crumbs={crumbs} home={HOME} label="Ruta de navegación" className="btp-breadcrumb" />
        <span className="btp-eyebrow">Plantillas de cajas</span>
        <h1>Plantillas de cajas gratis</h1>
        <p>Elige una plantilla, introduce tus medidas y el troquel se redibuja al momento. Descárgalo gratis en SVG, PDF, DXF, PNG o para Cricut, o ábrelo en el Studio para añadir tu diseño y plegar la caja en 3D.</p>
      </header>

      <section className="btp-related" aria-labelledby="es-templates-title">
        <h2 id="es-templates-title">Plantillas en español</h2>
        <div className="btp-cards">
          {ES_BOX_TEMPLATE_PAGES.map(page => <Link key={page.slug} href={`/es/box-templates/${page.slug}`}><b>{page.name}</b><span>{page.description}</span></Link>)}
          <Link href="/es/box-dieline-generator"><b>Generador de troqueles</b><span>Los 15 estilos de caja, a tu medida, con descarga gratis.</span></Link>
        </div>
        <h2>Más plantillas (en inglés)</h2>
        <ul className="btp-guides">
          <li><Link href="/box-templates" hrefLang="en">Las {BOX_TEMPLATE_PAGES.length} plantillas de cajas, con su troquel y su plegado en 3D <ArrowRight /></Link></li>
        </ul>
      </section>
    </main>
    <SiteFooter language="es" alternates={LANGUAGES} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: schema }} />
  </>;
}
