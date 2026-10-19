import { site } from '@/lib/site';

// Structured data (JSON-LD) shared by the marketing pages, and the switch that
// keeps draft pages out of production until they are approved.

/**
 * Whether draft pages and guides are served. Explicit SHOW_DRAFTS wins;
 * otherwise drafts show on previews and in development, where they can be
 * reviewed, and are 404s in production. Drafts are noindex wherever they show
 * and never in the sitemap.
 */
export const SHOW_DRAFTS = process.env.SHOW_DRAFTS === 'true' || (process.env.SHOW_DRAFTS == null && process.env.VERCEL_ENV !== 'production');

export type PublishStatus = 'draft' | 'published';
export const isServed = (status: PublishStatus) => status === 'published' || SHOW_DRAFTS;

const absolute = (path: string) => new URL(path, site.url).toString();

export type Crumb = { name: string; path: string };

/** A BreadcrumbList from Home to the page itself (the last crumb). */
export function breadcrumbSchema(crumbs: Crumb[], home: Crumb = { name: 'Home', path: '/' }) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [home, ...crumbs].map((crumb, index) => ({
      '@type': 'ListItem', position: index + 1, name: crumb.name, item: absolute(crumb.path),
    })),
  };
}

/** The same facts everywhere the site describes itself. */
export const STUDIO_FACTS = {
  description: 'Free online 3D box designer and dieline generator: draw a box dieline to your size, download it as SVG, PDF, DXF, PNG or a Cricut file without an account, and fold it in 3D with your artwork.',
  styles: 15,
  formats: ['SVG', 'PDF', 'DXF', 'PNG', 'Cricut/Silhouette SVG'],
};

export function organizationSchema() {
  return {
    '@type': 'Organization',
    '@id': absolute('/#organization'),
    name: site.name,
    url: absolute('/'),
    logo: absolute('/brand/logo-horizontal-light.png'),
    description: STUDIO_FACTS.description,
  };
}

/** A free tool page: what it is, that it costs nothing, and what it does. */
export function softwareApplicationSchema({ name, path, description, features }: { name: string; path: string; description: string; features: string[] }) {
  return {
    '@type': 'SoftwareApplication',
    name,
    description,
    url: absolute(path),
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Any (runs in the browser)',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: features,
    publisher: { '@id': absolute('/#organization') },
  };
}

/** One script's worth of JSON-LD for a page. */
export function jsonLd(...nodes: object[]) {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });
}
