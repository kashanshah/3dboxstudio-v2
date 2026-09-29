import Link from 'next/link';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
export default function NotFound() {
  return <><SiteHeader /><main id="main" className="journal-page section"><span className="eyebrow">404</span><h1>A box left unopened.</h1><p className="page-intro">We couldn’t find that page. You can return home or jump straight back into the Studio.</p><div className="not-found-actions"><Link className="button" href="/studio">Open Studio</Link><Link className="text-link" href="/">Back to home</Link></div></main><SiteFooter /></>;
}
