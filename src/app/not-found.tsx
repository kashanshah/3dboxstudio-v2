import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
export default function NotFound() {
  return <><SiteHeader /><main id="main" className="journal-page section"><span className="eyebrow">404</span><h1>A box left unopened.</h1><p className="page-intro">This page isn’t here. Let’s get you back to the studio.</p><Link className="button" href="/">Back to home</Link></main><SiteFooter /></>;
}
