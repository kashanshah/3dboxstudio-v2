import { Suspense } from 'react';
import { defaultLocale, localeDirection } from '@/lib/i18n/config';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { translate } from '@/lib/i18n';
import type { Metadata } from 'next';
import { defaultOgImage, site } from '@/lib/site';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';
import './content-pages.css';
import './contact-form.css';
import { AuthProvider } from '@/components/auth/auth-provider';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { AnalyticsPageView } from '@/components/analytics/AnalyticsPageView';
import { AnalyticsRouteGuard } from '@/components/analytics/AnalyticsRouteGuard';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  metadataBase: site.url,
  title: { default: translate('metadata.site_title'), template: '%s | 3D Box Studio' },
  description: translate('metadata.site_description'),
  // Index, follow is the default; only non-production deployments opt out.
  // Emitting it everywhere contradicted the noindex Next.js adds to 404s.
  ...(site.indexable ? {} : { robots: { index: false, follow: false } }),
  icons: { icon: '/favicon.svg' },
  openGraph: { siteName: site.name, type: 'website', images: [defaultOgImage] },
  twitter: { card: 'summary_large_image', images: [defaultOgImage.url] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The page scrolls smoothly to in-page anchors (#showcase); this lets
    // Next.js turn that off while it jumps a newly opened page to the top,
    // so leaving /#showcase for another page does not land partway down.
    <html lang={defaultLocale} dir={localeDirection(defaultLocale)} data-scroll-behavior="smooth">
      <body>
        <AnalyticsRouteGuard />
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <AnalyticsPageView />
        </Suspense>
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
        <ConsentBanner />
        <Analytics />
      </body>
    </html>
  );
}
