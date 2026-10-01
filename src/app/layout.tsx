import { Suspense } from 'react';
import { defaultLocale, localeDirection } from '@/lib/i18n/config';
import { LocaleProvider } from '@/components/i18n/locale-provider';
import { translate } from '@/lib/i18n';
import type { Metadata } from 'next';
import { site } from '@/lib/site';
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

export const metadata: Metadata = {
  metadataBase: site.url,
  title: { default: translate('metadata.site_title'), template: '%s | 3D Box Studio' },
  description: translate('metadata.site_description'),
  robots: { index: site.indexable, follow: site.indexable },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={defaultLocale} dir={localeDirection(defaultLocale)}>
      <body>
        <AnalyticsRouteGuard />
        <GoogleAnalytics />
        <Suspense fallback={null}>
          <AnalyticsPageView />
        </Suspense>
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
