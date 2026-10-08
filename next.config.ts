import type { NextConfig } from 'next';
import { localizedHome, localizedHomeLocales } from './src/content/localized-home';

// Translated home pages; Google ignores <html lang>, so declare the language here too.
const contentLanguage = localizedHomeLocales
  .map(locale => ({ source: `/${locale}`, headers: [{ key: 'Content-Language', value: localizedHome[locale].lang }] }));

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Source screenshots are 2048px wide. The default 3840 candidate was cached as a truncated PNG and painted as an empty frame.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  },
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      { source: '/:locale(fr|es|de|zh)/blog', destination: '/blog', permanent: true },
      { source: '/fr/faq', destination: '/faq', permanent: true },
      { source: '/es/faq', destination: '/faq', permanent: true },
      { source: '/de/faq', destination: '/faq', permanent: true },
      { source: '/zh/faq', destination: '/faq', permanent: true },
      { source: '/fr/contact', destination: '/contact', permanent: true },
      { source: '/es/contact', destination: '/contact', permanent: true },
      { source: '/de/contact', destination: '/contact', permanent: true },
      { source: '/zh/contact', destination: '/contact', permanent: true },
      { source: '/fr/privacy', destination: '/privacy', permanent: true },
      { source: '/es/privacy', destination: '/privacy', permanent: true },
      { source: '/de/privacy', destination: '/privacy', permanent: true },
      { source: '/zh/privacy', destination: '/privacy', permanent: true },
      { source: '/fr/terms', destination: '/terms', permanent: true },
      { source: '/es/terms', destination: '/terms', permanent: true },
      { source: '/de/terms', destination: '/terms', permanent: true },
      { source: '/zh/terms', destination: '/terms', permanent: true },
    ];
  },
  async headers() {
    return [...contentLanguage, { source: '/:path*', headers: [
      ...((process.env.SITE_INDEXABLE === 'false' || (process.env.SITE_INDEXABLE == null && process.env.VERCEL_ENV !== 'production')) ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }, {
      // Stop other sites framing the Studio and account pages (clickjacking).
      // PostHog's heatmap and toolbar views load the site in a frame, so they
      // stay allowed; modern browsers use frame-ancestors over X-Frame-Options.
      // API routes are left out so the SVG media routes keep their own sandbox CSP.
      source: '/((?!api/).*)',
      headers: [
        { key: 'Content-Security-Policy', value: "frame-ancestors 'self' https://*.posthog.com" },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      ],
    }];
  },
};
export default nextConfig;
