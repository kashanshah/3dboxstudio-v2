'use client';

import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/site-shell';

const links = [
  { href: '/blog', label: 'Guides' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
];

export function ContentPageShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [compactVisible, setCompactVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const revealPoint = Math.min(window.innerHeight * 1.5, Math.max(0, maxScroll - 1));
      setCompactVisible(maxScroll > window.innerHeight * 0.5 && window.scrollY >= revealPoint);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return <div className="content-site">
    <header className="content-header">
      <div className="content-nav">
        <Brand />
        <nav className="content-nav-links" aria-label="Main navigation">
          {links.map((item) => <Link key={item.href} className={active(item.href) ? 'is-active' : ''} href={item.href}>{item.label}</Link>)}
        </nav>
        <div className="content-nav-actions">
          <Link className="button content-primary-action" href="/studio">Open Studio <ArrowUpRight size={16}/></Link>
          <button className="content-menu-button" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20}/> : <Menu size={20}/>}</button>
        </div>
      </div>
      {menuOpen && <nav className="content-mobile-menu" aria-label="Mobile navigation">
        {links.map((item) => <Link key={item.href} href={item.href}>{item.label}</Link>)}
        <Link href="/studio">Open Studio <ArrowUpRight size={16}/></Link>
      </nav>}
    </header>

    <header className={`content-compact-header${compactVisible ? ' is-visible' : ''}`} aria-hidden={!compactVisible}>
      <div className="content-compact-nav">
        <Brand />
        <nav aria-label="Compact navigation">
          {links.map((item) => <Link key={item.href} className={active(item.href) ? 'is-active' : ''} tabIndex={compactVisible ? 0 : -1} href={item.href}>{item.label}</Link>)}
        </nav>
        <Link className="button content-compact-action" tabIndex={compactVisible ? 0 : -1} href="/studio">Open Studio <ArrowUpRight size={15}/></Link>
      </div>
    </header>

    <main id="main">{children}</main>

    <footer className="content-footer">
      <div className="content-footer-main">
        <div><Brand /><p>Packaging ideas, made tangible.</p></div>
        <div className="content-footer-links">
          <div><b>Product</b><Link href="/studio">Studio</Link><Link href="/blog">Guides</Link><Link href="/faq">Help center</Link></div>
          <div><b>Company</b><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
        </div>
      </div>
      <div className="content-footer-base"><span>© {new Date().getFullYear()} 3D Box Studio</span><span>Built for thoughtful packaging work.</span></div>
    </footer>
  </div>;
}

export function ContentHero({ eyebrow, title, intro, children, compact = false }: { eyebrow: string; title: string; intro: string; children?: ReactNode; compact?: boolean }) {
  return <header className={`content-hero${compact ? ' is-compact' : ''}`}><p className="content-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="content-lede">{intro}</p>{children}</header>;
}

export function StudioCta({ title = 'See your packaging from every angle.' }: { title?: string }) {
  return <section className="content-cta"><div><p className="content-eyebrow">3D Box Studio</p><h2>{title}</h2><p>Move from flat artwork to a dimensional packaging review in one focused workspace.</p></div><Link className="button" href="/studio">Open Studio <ArrowUpRight size={17}/></Link></section>;
}
