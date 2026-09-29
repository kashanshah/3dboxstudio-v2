import Link from 'next/link';
import { Box, ArrowUpRight } from 'lucide-react';

export function Brand() {
  return <Link href="/" className="brand" aria-label="3D Box Studio home"><span className="brand-icon"><Box size={21} strokeWidth={1.7} /></span><span>3D Box<span className="brand-light"> Studio</span></span></Link>;
}
export function SiteHeader() {
  return <><a className="skip-link" href="#main">Skip to content</a><header className="site-header"><Brand /><nav aria-label="Main navigation"><Link href="/#workflow">How it works</Link><Link href="/blog">Journal</Link></nav><Link className="button button-small" href="/studio">Explore V2 <ArrowUpRight size={16} /></Link></header></>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div><Brand /><p>A little imagination. A new dimension.</p></div><div className="footer-links"><Link href="/blog">Journal</Link><Link href="/studio">V2 preview</Link></div><span className="footer-note">V2 in development · {new Date().getFullYear()}</span></footer>;
}
