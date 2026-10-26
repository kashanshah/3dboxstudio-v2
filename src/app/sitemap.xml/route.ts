import { changelogReleases } from '@/content/changelog';
import { BLOG_POSTS } from '@/content/blogPosts';
import { site } from '@/lib/site';
import { BOX_TEMPLATE_PAGES } from '@/content/box-template-pages';
import { publishedSeoPages } from '@/content/seo-pages';
import { homeLanguageAlternates, localizedHomeLocales } from '@/content/localized-home';
import { ES_BOX_TEMPLATE_PAGES, ES_TEMPLATE_SLUGS, getEsBoxTemplatePage, templateLanguageAlternates } from '@/content/es/box-template-pages';
import { inactiveTemplateIds } from '@/lib/packaging/template-catalog';
import { getTemplateCatalog } from '@/server/templates';

const GENERATOR_LANGUAGES = { en: '/box-dieline-generator', es: '/es/box-dieline-generator', 'x-default': '/box-dieline-generator' };
const TEMPLATES_LANGUAGES = { en: '/box-templates', es: '/es/box-templates', 'x-default': '/box-templates' };

type SitemapEntry = {
  path: string;
  lastModified?: Date;
  changeFrequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  alternates?: Record<string, string>;
};

const xmlEscape = (value: string) =>
  value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character];
  });

const absoluteUrl = (path: string) => new URL(path, site.url).toString();


/** `hidden`: template ids an admin made inactive; their pages redirect, so they are left out. */
function getEntries(hidden: ReadonlySet<string> = new Set()): SitemapEntry[] {
  const staticEntries: SitemapEntry[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1, alternates: homeLanguageAlternates },
    ...localizedHomeLocales.map((locale): SitemapEntry => ({ path: `/${locale}`, changeFrequency: 'weekly', priority: 0.8, alternates: homeLanguageAlternates })),
    { path: '/features', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/changelog', lastModified: new Date(changelogReleases[0].date), changeFrequency: 'weekly', priority: 0.7 },
    { path: '/whats-new/v2', lastModified: new Date('2026-10-01'), changeFrequency: 'weekly', priority: 0.85 },
    { path: '/box-dieline-generator', changeFrequency: 'monthly', priority: 0.85, alternates: GENERATOR_LANGUAGES },
    { path: '/es/box-dieline-generator', changeFrequency: 'monthly', priority: 0.75, alternates: GENERATOR_LANGUAGES },
    { path: '/3d-box-mockup-generator', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/packaging-design-online', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/pacdora-alternative', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/adobe-dimension-alternative', lastModified: new Date('2026-10-06'), changeFrequency: 'monthly', priority: 0.75 },
    { path: '/boxshot-alternative', lastModified: new Date('2026-10-06'), changeFrequency: 'monthly', priority: 0.75 },
    { path: '/placeit-box-mockup-alternative', lastModified: new Date('2026-10-06'), changeFrequency: 'monthly', priority: 0.75 },
    { path: '/box-templates', changeFrequency: 'monthly', priority: 0.8, alternates: TEMPLATES_LANGUAGES },
    { path: '/es/box-templates', changeFrequency: 'monthly', priority: 0.7, alternates: TEMPLATES_LANGUAGES },
    ...BOX_TEMPLATE_PAGES.filter(page => !hidden.has(page.templateId)).map((page): SitemapEntry => ({ path: `/box-templates/${page.slug}`, lastModified: new Date(page.updated), changeFrequency: 'monthly', priority: 0.85, ...(ES_TEMPLATE_SLUGS.includes(page.slug) ? { alternates: templateLanguageAlternates(page.slug) } : {}) })),
    ...ES_BOX_TEMPLATE_PAGES.filter(page => !hidden.has(getEsBoxTemplatePage(page.slug)?.en.templateId ?? '')).map((page): SitemapEntry => ({ path: `/es/box-templates/${page.slug}`, lastModified: new Date(page.updated), changeFrequency: 'monthly', priority: 0.75, alternates: templateLanguageAlternates(page.slug) })),
    { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/privacy', lastModified: new Date('2026-10-11'), changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terms', lastModified: new Date('2026-10-11'), changeFrequency: 'yearly', priority: 0.3 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    // Generator search-plan pages, once approved (drafts stay out).
    ...publishedSeoPages().map((page): SitemapEntry => ({ path: page.path, changeFrequency: 'monthly', priority: page.priority })),
  ];

  const blogEntries: SitemapEntry[] = BLOG_POSTS.map((post) => {
    const alternates: Record<string, string> = {
      en: `/blog/${post.slug}`,
      'x-default': `/blog/${post.slug}`,
    };

    if (post.slug === 'how-to-create-3d-product-box-mockup-online') {
      alternates.fr = `/fr/blog/${post.slug}`;
    }

    return {
      path: `/blog/${post.slug}`,
      lastModified: new Date(post.updated ?? post.published),
      changeFrequency: 'monthly',
      priority: 0.7,
      alternates,
    };
  });

  blogEntries.push({
    path: '/fr/blog/how-to-create-3d-product-box-mockup-online',
    lastModified: new Date('2026-09-07'),
    changeFrequency: 'monthly',
    priority: 0.65,
    alternates: {
      en: '/blog/how-to-create-3d-product-box-mockup-online',
      fr: '/fr/blog/how-to-create-3d-product-box-mockup-online',
      'x-default': '/blog/how-to-create-3d-product-box-mockup-online',
    },
  });

  return [...staticEntries, ...blogEntries];
}

function renderEntry(entry: SitemapEntry) {
  const alternates = entry.alternates
    ? Object.entries(entry.alternates)
        .map(
          ([language, path]) =>
            `    <xhtml:link rel="alternate" hreflang="${xmlEscape(language)}" href="${xmlEscape(absoluteUrl(path))}" />`,
        )
        .join('\n')
    : '';

  return [
    '  <url>',
    `    <loc>${xmlEscape(absoluteUrl(entry.path))}</loc>`,
    entry.lastModified ? `    <lastmod>${entry.lastModified.toISOString()}</lastmod>` : '',
    entry.changeFrequency ? `    <changefreq>${entry.changeFrequency}</changefreq>` : '',
    entry.priority !== undefined ? `    <priority>${entry.priority}</priority>` : '',
    alternates,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function GET() {
  const entries = getEntries(inactiveTemplateIds(await getTemplateCatalog()));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries.map(renderEntry).join('\n'),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
