import type { Metadata } from 'next';
import { defaultOgImage } from '@/lib/site';
import { isServed, type PublishStatus } from '@/lib/seo';

// The pages added for the dieline generator's search plan: one place for
// each page's address, title (60 characters at most) and description (155 at
// most), and whether it is approved. A draft is served only where drafts show
// (previews, development), is noindex, and stays out of the sitemap; once
// approved, set its status to 'published'. Guides live with the other guides
// in blogPosts.ts, with `draft: true` until approved.

export type SeoPage = {
  path: string;
  title: string;
  description: string;
  status: PublishStatus;
  /** Where it shows in the sitemap and how often it changes. */
  priority: number;
};

export const SEO_PAGES = {
  calculator: {
    path: '/box-size-calculator',
    title: 'Box Size Calculator: Inside & Outside Dimensions',
    description: 'Enter your product size and padding to get the inside and outside box dimensions, the board to use and the box styles that fit, then make the dieline free.',
    status: 'published',
    priority: 0.8,
  },
  sizes: {
    path: '/box-sizes',
    title: 'Standard Box Sizes Chart: Dimensions in Inches & cm',
    description: 'Standard box sizes in inches and cm: small, medium and large boxes, cubes, mailers, metric cartons and pizza boxes. Find the box that fits your product.',
    status: 'published',
    priority: 0.8,
  },
  printable: {
    path: '/printable-box-templates',
    title: 'Printable Box Templates with Measurements (Free)',
    description: 'Free printable box templates in any size: type your measurements, print the dieline at 100% on A4 or Letter, cut, score and fold. 16 styles, no sign-up.',
    status: 'draft',
    priority: 0.8,
  },
  cricut: {
    path: '/cricut-box-templates',
    title: 'Cricut Box Templates: Free SVG in Any Size',
    description: 'Make a Cricut box template in your exact size: cut and score SVG sized in inches, for Design Space and Silhouette. 16 box styles, free, no account.',
    status: 'draft',
    priority: 0.8,
  },
  glossary: {
    path: '/packaging-glossary',
    title: 'Packaging Glossary: Dieline and Box Terms Explained',
    description: 'Dieline and packaging terms in plain words: cut, crease and bleed lines, caliper, points and gsm, flutes, FEFCO and ECMA codes, tuck and glue flaps.',
    status: 'draft',
    priority: 0.6,
  },
  templatemaker: {
    path: '/templatemaker-alternative',
    title: 'Templatemaker Alternative: Dielines with a 3D Preview',
    description: 'A free alternative to Templatemaker for box dielines: 16 styles, SVG, PDF and DXF without an account, and the box folded in 3D. Compared fairly.',
    status: 'draft',
    priority: 0.7,
  },
  dieCutTemplates: {
    path: '/die-cut-templates-alternative',
    title: 'Die Cut Templates Alternative: Free, Any Size',
    description: 'A free alternative to buying die cut box templates: draw the dieline in your exact size, download it with no account, and fold it in 3D. Compared fairly.',
    status: 'draft',
    priority: 0.7,
  },
} satisfies Record<string, SeoPage>;

/** Metadata for one of these pages: canonical without query strings, and noindex while a draft. */
export function seoPageMetadata(page: SeoPage, image: { url: string; width: number; height: number; alt: string } = defaultOgImage): Metadata {
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: { title: page.title, description: page.description, url: page.path, type: 'website', images: [image] },
    twitter: { card: 'summary_large_image', title: page.title, description: page.description, images: [image.url] },
    ...(page.status === 'draft' ? { robots: { index: false, follow: false } } : {}),
  };
}

export const servedSeoPage = (page: SeoPage) => isServed(page.status);
export const publishedSeoPages = () => (Object.values(SEO_PAGES) as SeoPage[]).filter(page => page.status === 'published');
