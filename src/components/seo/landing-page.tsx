import type { ReactNode } from 'react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { Breadcrumbs } from '@/components/seo/breadcrumbs';
import { breadcrumbSchema, jsonLd, type Crumb } from '@/lib/seo';
import '@/app/box-template-page.css';

/**
 * The frame of a generator search page (calculator, crafter pages, glossary):
 * breadcrumbs, the heading and its promise, a visible last-updated date, the
 * page's own content, and its JSON-LD with the breadcrumb trail added.
 */
export function LandingPage({ crumbs, eyebrow, title, intro, updated, schema = [], children }: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro: ReactNode;
  updated: string;
  schema?: object[];
  children: ReactNode;
}) {
  const date = new Date(`${updated}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return <>
    <SiteHeader />
    <main id="main" className="box-template-page">
      <header className="btp-hero">
        <Breadcrumbs crumbs={crumbs} className="btp-breadcrumb" />
        <span className="btp-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
        <p className="btp-updated">Last updated <time dateTime={updated}>{date}</time></p>
      </header>
      {children}
    </main>
    <SiteFooter />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbSchema(crumbs), ...schema) }} />
  </>;
}
