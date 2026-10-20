'use client';

import { CookieSettingsButton } from '@/components/analytics/ConsentBanner';
import Link from 'next/link';
import { ArrowUpRight, Globe } from 'lucide-react';
import { chromeWords, footerColumns, homeHref, languageLinks, navLinks, type ChromeAlternates, type ChromeLanguage, type ChromeLink } from '@/lib/site-chrome';
import { MobileMenu } from '@/components/mobile-menu';
import { BrandLogo } from '@/components/brand-logo';
import { AccountButton } from '@/components/auth/account-button';
import { usePathname } from 'next/navigation';

export function Brand({ label = '3D Box Studio home', href = '/' }: { label?: string; href?: string }) {
  return <Link href={href} className="brand brand-vector" aria-label={label}><BrandLogo className="brand-vector-logo" priority /></Link>;
}

function NavigationLinks({ links }: { links: ChromeLink[] }) {
  const pathname = usePathname();
  return <>
    {links.map((item) => {
      const active = !item.native && (pathname === item.href || pathname.startsWith(item.href + '/'));
      // Native anchors wait for the destination document's sections to exist.
      if (item.native) return <a key={item.href} href={item.href}>{item.label}</a>;
      return <Link key={item.href} className={active ? 'is-active' : ''} href={item.href} hrefLang={item.hrefLang}>{item.label}</Link>;
    })}
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
  const links = navLinks(language);

  const headerContents = <div className="marketing-header-inner">
    <Brand label={words.homeLabel} href={homeHref(language)} />
    <nav className="marketing-nav-links" aria-label={words.mainNav}><NavigationLinks links={links} /></nav>
    <div className="marketing-header-actions">
      <LanguageSwitcher language={language} alternates={alternates} label={words.languages} />
      <AccountButton compact />
      <Link className="button marketing-header-cta" href="/studio">{words.openStudio + " "}<ArrowUpRight size={16}/></Link>
      <MobileMenu
        links={links}
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
