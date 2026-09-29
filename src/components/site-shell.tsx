import Link from 'next/link';
import { Box, ArrowUpRight, Menu } from 'lucide-react';

export function Brand() {
  return <Link href="/" className="brand" aria-label="3D Box Studio home"><span className="brand-icon"><Box size={21} strokeWidth={1.7} /></span><span>3D Box<span className="brand-light"> Studio</span></span></Link>;
}
export function SiteHeader() {
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><div className="header-inner"><Brand /><nav aria-label="Main navigation"><Link href="/#studio-demo">Product</Link><Link href="/#examples">Examples</Link><Link href="/#workflow">Workflow</Link><Link href="/blog">Guides</Link></nav><Link className="button button-small header-cta" href="/studio">Studio preview <ArrowUpRight size={15} /></Link><details className="mobile-navigation"><summary aria-label="Open navigation menu"><Menu size={21} /></summary><nav aria-label="Mobile navigation"><Link href="/#studio-demo">Product demo</Link><Link href="/#examples">Packaging examples</Link><Link href="/#workflow">Workflow</Link><Link href="/blog">Journal</Link><Link href="/studio">Studio preview</Link></nav></details></div></header></>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div><Brand /><p>Packaging in a new dimension.</p></div><div className="footer-links"><Link href="/#studio-demo">Product demo</Link><Link href="/#examples">Examples</Link><Link href="/blog">Guides</Link><Link href="/faq">FAQ</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/studio">Studio</Link></div><span className="footer-note">V2 in development · {new Date().getFullYear()}</span></footer>;
}
