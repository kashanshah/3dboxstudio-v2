'use client';

import Link from 'next/link';
import { ArrowUpRight, Box, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/#details', label: 'Product', homeHash: '#details' },
  { href: '/#showcase', label: 'Examples', homeHash: '#showcase' },
  { href: '/#workflow', label: 'Workflow', homeHash: '#workflow' },
  { href: '/blog', label: 'Guides' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
] as const;

export function Brand() {
  return <Link href="/" className="brand" aria-label="3D Box Studio home"><span className="brand-icon"><Box size={21} strokeWidth={1.7} /></span><span>3D Box<span className="brand-light"> Studio</span></span></Link>;
}

function NavigationLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname();
  return <>
    {navLinks.map((item) => {
      const active = !('homeHash' in item) && (pathname === item.href || pathname.startsWith(item.href + '/'));
      return <Link key={item.href} className={active ? 'is-active' : ''} href={item.href} onClick={onNavigate} tabIndex={compact ? 0 : undefined}>{item.label}</Link>;
    })}
  </>;
}

export function MarketingStickyHeader() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const update = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const revealPoint = Math.min(window.innerHeight * 0.75, Math.max(0, maxScroll - 1));
      setRevealed(maxScroll > window.innerHeight * 0.5 && window.scrollY >= revealPoint);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <header className={`marketing-sticky-header${revealed ? ' is-visible' : ''}`} aria-hidden={!revealed}>
    <div className="marketing-header-inner is-compact">
      <Brand />
      <nav className="marketing-nav-links" aria-label="Sticky navigation"><NavigationLinks compact /></nav>
      <div className="marketing-header-actions">
        <Link className="button marketing-header-cta" href="/studio">Open Studio <ArrowUpRight size={16}/></Link>
      </div>
    </div>
  </header>;
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const headerContents = (compact = false) => <div className={compact ? 'marketing-header-inner is-compact' : 'marketing-header-inner'}>
    <Brand />
    <nav className="marketing-nav-links" aria-label={compact ? 'Sticky navigation' : 'Main navigation'}><NavigationLinks compact={compact} /></nav>
    <div className="marketing-header-actions">
      <Link className="button marketing-header-cta" href="/studio">Open Studio <ArrowUpRight size={16}/></Link>
      {!compact ? <button className="marketing-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button> : null}
    </div>
  </div>;

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="marketing-header">{headerContents(false)}
      {menuOpen ? <nav className="marketing-mobile-menu" aria-label="Mobile navigation"><NavigationLinks onNavigate={() => setMenuOpen(false)} /><Link href="/studio" onClick={() => setMenuOpen(false)}>Open Studio <ArrowUpRight size={16}/></Link></nav> : null}
    </header>
    <MarketingStickyHeader />
  </>;
}

export function SiteFooter() {
  return <footer className="marketing-footer">
    <div className="marketing-footer-main">
      <div><Brand /><p>Packaging ideas, made tangible.</p></div>
      <div className="marketing-footer-links">
        <div><b>Product</b><Link href="/studio">Studio</Link><Link href="/blog">Guides</Link><Link href="/faq">Help center</Link></div>
        <div><b>Company</b><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
      </div>
    </div>
    <div className="marketing-footer-base"><span>© {new Date().getFullYear()} 3D Box Studio</span><span>Built for thoughtful packaging work.</span></div>
  </footer>;
}
