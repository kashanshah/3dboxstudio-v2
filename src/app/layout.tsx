import type { Metadata } from 'next';
import { site } from '@/lib/site';
import { ScrollToTopOnRouteChange } from '@/components/scroll-to-top-on-route-change';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: site.url,
  title: { default: '3D Box Studio — Packaging, brought to life', template: '%s | 3D Box Studio' },
  description: 'Explore a new way to visualize your packaging. A fresh 3D Box Studio experience, currently in development.',
  robots: { index: site.indexable, follow: site.indexable },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><ScrollToTopOnRouteChange />{children}</body></html>;
}
