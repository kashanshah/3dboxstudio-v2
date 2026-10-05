import type { NextConfig } from 'next';

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
    return [{ source: '/:path*', headers: [
      ...((process.env.SITE_INDEXABLE === 'false' || (process.env.SITE_INDEXABLE == null && process.env.VERCEL_ENV !== 'production')) ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },
};
export default nextConfig;
