import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Download, FoldVertical, Globe, ImagePlus, Palette, Ruler, Share2, Sparkles } from "lucide-react";
import { Brand } from "./site-shell";
import { BrandMark } from "./original-brand-mark";
import { Button } from "./original-button";
import { FaqSection } from "./faq-section";
import { CookieSettingsButton } from "./analytics/ConsentBanner";
import { englishHomeLanguage, localizedHome, localizedHomeLocales, type LocalizedHomeLocale } from "@/content/localized-home";

const STEP_IMAGES = [
  "/images/v2-launch/studio-box-size.png",
  "/images/v2-launch/studio-design-artwork.png",
  "/images/v2-launch/studio-preview-3d.png",
] as const;
const FEATURE_ICONS = [Ruler, ImagePlus, FoldVertical, Palette, Download, Share2];

export const homeLanguages = [
  { href: englishHomeLanguage.path, lang: englishHomeLanguage.lang, name: englishHomeLanguage.nativeName, locale: "en" },
  ...localizedHomeLocales.map(locale => ({ href: `/${locale}`, lang: localizedHome[locale].lang, name: localizedHome[locale].nativeName, locale })),
];

/** Links to every version of the home page; works without JavaScript. */
export function LanguageSwitcher({ current, label }: { current: string; label: string }) {
  const active = homeLanguages.find(language => language.locale === current) ?? homeLanguages[0];
  return <details className="language-switcher">
    <summary aria-label={label}><Globe aria-hidden="true"/><span>{active.name}</span></summary>
    <ul>{homeLanguages.map(language => <li key={language.locale}>
      <a href={language.href} hrefLang={language.lang} lang={language.lang} aria-current={language.locale === current ? "page" : undefined}>{language.name}</a>
    </li>)}</ul>
  </details>;
}

/** Translated landing page for /es, /es-mx, /fr, /pt-br, /de and /zh. The Studio itself is English-only. */
export function LocalizedHome({ locale }: { locale: LocalizedHomeLocale }) {
  const c = localizedHome[locale];
  return <div lang={c.lang} className="localized-home-root">
    <a className="skip-link" href="#main">{c.nav.skip}</a>
    <header className="marketing-header">
      <div className="marketing-header-inner">
        <Brand />
        <nav className="marketing-nav-links" aria-label="3D Box Studio">
          <a href="#features">{c.nav.features}</a>
          <Link href="/box-templates" hrefLang="en">{c.nav.templates}</Link>
          <a href="#faq">{c.nav.faq}</a>
          <Link href="/blog" hrefLang="en">{c.nav.guides}</Link>
        </nav>
        <div className="marketing-header-actions">
          <LanguageSwitcher current={locale} label={c.nav.languages} />
          <Link className="button marketing-header-cta" href="/studio">{c.nav.openStudio} <ArrowRight size={16}/></Link>
        </div>
      </div>
    </header>

    <main id="main" className="lovable-original marketing-page localized-home">
      <section className="home-hero localized-hero">
        <div className="hero-copy">
          <div className="hero-badge"><Sparkles /> {c.hero.badge}</div>
          <h1>{c.hero.line1}<br/><span>{c.hero.line2}</span></h1>
          <p>{c.hero.intro}</p>
          <div className="hero-actions">
            <Button asChild size="lg"><Link href="/studio">{c.hero.primaryCta} <ArrowRight /></Link></Button>
            <Button variant="outline" size="lg" asChild><a href="#how-it-works">{c.hero.secondaryCta}</a></Button>
          </div>
          <div className="hero-proof"><span>{c.hero.proof[0]}</span><i/><span>{c.hero.proof[1]}</span><i/><span>{c.hero.proof[2]}</span></div>
          <p className="localized-app-note">{c.hero.appNote}</p>
        </div>
        <figure className="localized-hero-shot">
          <Image src={STEP_IMAGES[2]} alt={c.steps.alts[2]} width={2048} height={1144} priority sizes="(max-width: 980px) 100vw, 640px" />
        </figure>
      </section>

      <section id="how-it-works" className="localized-steps">
        <div className="section-intro compact"><p className="eyebrow">{c.steps.eyebrow}</p><h2>{c.steps.title}</h2></div>
        <ol>{c.steps.items.map((step, index) => <li key={step.title}>
          <Image src={STEP_IMAGES[index]} alt={c.steps.alts[index]} width={2048} height={1144} sizes="(max-width: 980px) 100vw, 400px" />
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>)}</ol>
      </section>

      <section id="features" className="capability-band">
        <div className="section-intro compact"><p className="eyebrow">{c.features.eyebrow}</p><h2>{c.features.title}</h2></div>
        <div className="capability-grid">{c.features.items.map((item, index) => {
          const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length];
          return <article key={item.title}><span className="capability-icon"><Icon /></span><h3>{item.title}</h3><p>{item.body}</p></article>;
        })}</div>
      </section>

      <FaqSection id="faq" eyebrow={c.faq.eyebrow} title={c.faq.title} items={c.faq.items} />

      <section className="closing-section">
        <h2>{c.closing.title}</h2>
        <p>{c.closing.body}</p>
        <Button asChild size="lg"><Link href="/studio">{c.closing.cta} <ArrowRight/></Link></Button>
        <p className="localized-closing-note">{c.closing.note}</p>
      </section>

      <footer>
        <BrandMark/>
        <nav aria-label={c.footer.product}>
          <Link href="/studio">{c.footer.studio}</Link>
          <Link href="/blog" hrefLang="en">{c.footer.guides}</Link>
          <Link href="/faq" hrefLang="en">{c.footer.faq}</Link>
          <Link href="/contact" hrefLang="en">{c.footer.contact}</Link>
          <Link href="/privacy" hrefLang="en">{c.footer.privacy}</Link>
          <Link href="/terms" hrefLang="en">{c.footer.terms}</Link>
          <CookieSettingsButton label={c.footer.cookies} />
        </nav>
        <span>© 2026 3D Box Studio · {c.footer.tagline}</span>
      </footer>
    </main>
  </div>;
}
