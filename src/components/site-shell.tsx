'use client';

import { useTranslations } from '@/components/i18n/locale-provider';
import { CookieSettingsButton } from '@/components/analytics/ConsentBanner';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { AccountButton } from '@/components/auth/account-button';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/features', label: "navigation.features" },
  { href: '/#showcase', label: "navigation.examples", homeHash: '#showcase' },
  { href: '/#workflow', label: "navigation.workflow", homeHash: '#workflow' },
  { href: '/blog', label: "navigation.guides" },
  { href: '/faq', label: "navigation.faq" },
  { href: '/contact', label: "navigation.contact" },
] as const;

export function Brand() {
  const t = useTranslations();

  return <Link href="/" className="brand brand-vector" aria-label={t("navigation.3d_box_studio_home")}><BrandLogo className="brand-vector-logo" priority /></Link>;
}

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations();
  const pathname = usePathname();
  return <>
    {navLinks.map((item) => {
      const active = !('homeHash' in item) && (pathname === item.href || pathname.startsWith(item.href + '/'));
      // Native anchors wait for the destination document's sections to exist.
      if ('homeHash' in item) return <a key={item.href} href={item.href} onClick={onNavigate}>{t(item.label)}</a>;
      return <Link key={item.href} className={active ? 'is-active' : ''} href={item.href} onClick={onNavigate}>{t(item.label)}</Link>;
    })}
  </>;
}

export function SiteHeader() {
  const t = useTranslations();

  const [menuOpen, setMenuOpen] = useState(false);

  const headerContents = <div className="marketing-header-inner">
    <Brand />
    <nav className="marketing-nav-links" aria-label={t("navigation.main_navigation")}><NavigationLinks /></nav>
    <div className="marketing-header-actions">
      <AccountButton compact />
      <Link className="button marketing-header-cta" href="/studio">{t("navigation.open_studio") + " "}<ArrowUpRight size={16}/></Link>
      <button className="marketing-menu-button" type="button" aria-expanded={menuOpen} aria-controls="marketing-mobile-menu" aria-label={menuOpen ? t("navigation.close_menu") : t("navigation.open_menu")} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button>
    </div>
  </div>;

  return <>
    <a className="skip-link" href="#main">{t("navigation.skip_to_content")}</a>
    <header className="marketing-header">{headerContents}
      {menuOpen ? <nav id="marketing-mobile-menu" className="marketing-mobile-menu" aria-label={t("navigation.mobile_navigation")}><NavigationLinks onNavigate={() => setMenuOpen(false)} /></nav> : null}
    </header>
  </>;
}

export function SiteFooter() {
  const t = useTranslations();

  return <footer className="marketing-footer">
    <div className="marketing-footer-main">
      <div><Brand /><p>{t("navigation.packaging_ideas_made_tangible")}</p></div>
      <div className="marketing-footer-links">
        <div><b>{t("navigation.product")}</b><Link href="/studio">{t("navigation.studio")}</Link><Link href="/changelog">{t("navigation.whats_new")}</Link><Link href="/blog">{t("navigation.guides")}</Link><Link href="/faq">{t("navigation.help_center")}</Link></div>
        <div><b>{t("navigation.tools")}</b><Link href="/3d-box-mockup-generator">{t("navigation.3d_box_mockup_generator")}</Link><Link href="/box-dieline-generator">{t("navigation.box_dieline_generator")}</Link><Link href="/box-templates">{t("navigation.box_templates")}</Link><Link href="/pacdora-alternative">{t("navigation.pacdora_alternative")}</Link></div>
        <div><b>{t("navigation.company")}</b><Link href="/contact">{t("navigation.contact")}</Link><Link href="/privacy">{t("navigation.privacy")}</Link><Link href="/terms">{t("navigation.terms")}</Link><CookieSettingsButton /></div>
      </div>
    </div>
    <div className="marketing-footer-base"><span>© {new Date().getFullYear()}{" " + t("navigation.3d_box_studio")}</span><span>{t("navigation.built_for_thoughtful_packaging_work")}</span></div>
  </footer>;
}
