import { BLOG_POSTS } from '@/content/blogPosts';
import { site } from '@/lib/site';

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

const homeAlternates = {
  en: '/',
  fr: '/fr',
  es: '/es',
  de: '/de',
  'x-default': '/',
};

function getEntries(): SitemapEntry[] {
  const staticEntries: SitemapEntry[] = [
    { path: '/', changeFrequency: 'weekly', priority: 1, alternates: homeAlternates },
    { path: '/fr', changeFrequency: 'weekly', priority: 0.8, alternates: homeAlternates },
    { path: '/es', changeFrequency: 'weekly', priority: 0.8, alternates: homeAlternates },
    { path: '/de', changeFrequency: 'weekly', priority: 0.8, alternates: homeAlternates },
    { path: '/studio', changeFrequency: 'weekly', priority: 0.95 },
    { path: '/features', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/whats-new/v2', changeFrequency: 'weekly', priority: 0.85 },
    { path: '/box-dieline-generator', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/3d-box-mockup-generator', changeFrequency: 'monthly', priority: 0.85 },
    { path: '/packaging-design-online', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/pacdora-alternative', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/box-templates', changeFrequency: 'monthly', priority: 0.8 },
    { path: '/faq', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contact', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
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

export function GET() {
  const entries = getEntries();
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
