'use client';

import { CookieSettingsButton } from '@/components/analytics/ConsentBanner';
import Link from 'next/link';
import { ArrowUpRight, ChevronDown, Globe } from 'lucide-react';
import { chromeWords, flatNavLinks, footerColumns, homeHref, languageLinks, navItems, type ChromeAlternates, type ChromeLanguage, type ChromeLink, type ChromeNavItem } from '@/lib/site-chrome';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MobileMenu } from '@/components/mobile-menu';
import { BrandLogo } from '@/components/brand-logo';
import { AccountButton } from '@/components/auth/account-button';
import { usePathname } from 'next/navigation';

export function Brand({ label = '3D Box Studio home', href = '/' }: { label?: string; href?: string }) {
  return <Link href={href} className="brand brand-vector" aria-label={label}><BrandLogo className="brand-vector-logo" priority /></Link>;
}

const isActive = (pathname: string, item: ChromeLink) => !item.native && (pathname === item.href || pathname.startsWith(item.href + '/'));

function NavLink({ item, pathname, onClick }: { item: ChromeLink; pathname: string; onClick?: () => void }) {
  // Native anchors wait for the destination document's sections to exist.
  if (item.native) return <a href={item.href} hrefLang={item.hrefLang} onClick={onClick}>{item.label}</a>;
  return <Link className={isActive(pathname, item) ? 'is-active' : ''} href={item.href} hrefLang={item.hrefLang} onClick={onClick}>{item.label}</Link>;
}

/** A header menu: opens on click, tap or hover, and closes on Escape, a click outside or a choice. */
function NavMenu({ label, items, pathname }: { label: string; items: ChromeLink[]; pathname: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const active = items.some(item => isActive(pathname, item));
  // A mouse opens it by hovering, so its click keeps it open; touch and keyboard toggle.
  const pointer = useRef('');
  const hover = (next: boolean) => (event: ReactPointerEvent) => { if (event.pointerType === 'mouse') setOpen(next); };
  return <div ref={root} className="marketing-nav-menu" onPointerEnter={hover(true)} onPointerLeave={hover(false)}
    onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <button type="button" className={active ? 'is-active' : ''} aria-expanded={open} aria-controls={id}
      onPointerDown={event => { pointer.current = event.pointerType; }}
      onClick={() => { const mouse = pointer.current === 'mouse'; pointer.current = ''; setOpen(value => mouse || !value); }}>
      {label}<ChevronDown aria-hidden="true" size={14} />
    </button>
    <div id={id} className="marketing-nav-popover" hidden={!open}>
      {items.map(item => <NavLink key={item.href} item={item} pathname={pathname} onClick={() => setOpen(false)} />)}
    </div>
  </div>;
}

function NavigationLinks({ items }: { items: ChromeNavItem[] }) {
  const pathname = usePathname();
  return <>
    {items.map(item => 'children' in item
      ? <NavMenu key={item.label} label={item.label} items={item.children} pathname={pathname} />
      : <NavLink key={item.href} item={item} pathname={pathname} />)}
  </>;
}

/** Links to every language: the same page where it is translated, else that language's home page. Works without JavaScript. */
export function LanguageSwitcher({ language, alternates, label }: { language: ChromeLanguage; alternates?: ChromeAlternates; label: string }) {
  const languages = languageLinks(alternates);
  const active = languages.find(item => item.code === language) ?? languages[0];
  return <details className="language-switcher">
    <summary aria-label={`${label}: ${active.name}`}><Globe aria-hidden="true" /><span>{active.short}</span></summary>
    <ul>{languages.map(item => <li key={item.code}>
      <a href={item.href} hrefLang={item.lang} lang={item.lang} aria-current={item.code === language ? 'page' : undefined}>{item.name}</a>
    </li>)}</ul>
  </details>;
}

/**
 * The header of every marketing page. `language` is the page's language;
 * `alternates` are the same page in other languages, for the switcher.
 */
export function SiteHeader({ language = 'en', alternates }: { language?: ChromeLanguage; alternates?: ChromeAlternates }) {
  const words = chromeWords(language);
  const items = navItems(language);

  const headerContents = <div className="marketing-header-inner">
    <Brand label={words.homeLabel} href={homeHref(language)} />
    <nav className="marketing-nav-links" aria-label={words.mainNav}><NavigationLinks items={items} /></nav>
    <div className="marketing-header-actions">
      <LanguageSwitcher language={language} alternates={alternates} label={words.languages} />
      <AccountButton compact />
      <Link className="button marketing-header-cta" href="/studio">{words.openStudio + " "}<ArrowUpRight size={16}/></Link>
      <MobileMenu
        links={flatNavLinks(language)}
        languages={{ label: words.languages, links: languageLinks(alternates).filter(item => item.code !== language).map(item => ({ href: item.href, label: item.name, hrefLang: item.lang })) }}
        cta={{ href: '/studio', label: words.openStudio }}
        labels={{ open: words.openMenu, close: words.closeMenu, nav: words.mainNav }}
      />
    </div>
  </div>;

  return <>
    <a className="skip-link" href="#main">{words.skip}</a>
    <header className="marketing-header" lang={language === 'en' ? undefined : words.lang}>{headerContents}</header>
  </>;
}

/** The footer of every marketing page, with a link to every language. */
export function SiteFooter({ language = 'en', alternates }: { language?: ChromeLanguage; alternates?: ChromeAlternates }) {
  const words = chromeWords(language);
  const languages = languageLinks(alternates);

  return <footer className="marketing-footer" lang={language === 'en' ? undefined : words.lang}>
    <div className="marketing-footer-main">
      <div><Brand label={words.homeLabel} href={homeHref(language)} /><p>{words.tagline}</p></div>
      <div className="marketing-footer-links">
        {footerColumns(language).map((column, index, all) => <div key={column.title}><b>{column.title}</b>
          {column.links.map(link => <Link key={link.href} href={link.href} hrefLang={link.hrefLang}>{link.label}</Link>)}
          {index === all.length - 1 ? <CookieSettingsButton label={words.cookies} /> : null}
        </div>)}
      </div>
    </div>
    <nav className="marketing-footer-languages" aria-label={words.languages}>
      {languages.map(item => <a key={item.code} href={item.href} hrefLang={item.lang} lang={item.lang} aria-current={item.code === language ? 'page' : undefined}>{item.name}</a>)}
    </nav>
    <div className="marketing-footer-base"><span>© {new Date().getFullYear()} 3D Box Studio</span><span>{words.base}</span></div>
  </footer>;
}
