import Link from 'next/link';
import { ArrowUpRight, Globe } from 'lucide-react';
import { Brand } from '@/components/site-shell';
import { MobileMenu } from '@/components/mobile-menu';
import { CookieSettingsButton } from '@/components/analytics/ConsentBanner';

// Header and footer for the Spanish tool pages (/es/box-templates…, /es/box-dieline-generator).
// The Studio, the guides and the company pages are English-only and say so with hrefLang.

const NAV = [
  { href: '/es/box-templates', label: 'Plantillas de cajas', hrefLang: 'es' },
  { href: '/es/box-dieline-generator', label: 'Generador de troqueles', hrefLang: 'es' },
  { href: '/blog', label: 'Guías (en inglés)', hrefLang: 'en' },
  { href: '/es#faq', label: 'Preguntas', hrefLang: 'es' },
] as const;

/** `english` is the same page in English, for the language link. */
export function SpanishHeader({ english }: { english: string }) {
  return <>
    <a className="skip-link" href="#main">Saltar al contenido</a>
    <header className="marketing-header" lang="es">
      <div className="marketing-header-inner">
        <Brand />
        <nav className="marketing-nav-links" aria-label="Navegación principal">
          {NAV.map(item => <Link key={item.href} href={item.href} hrefLang={item.hrefLang}>{item.label}</Link>)}
        </nav>
        <div className="marketing-header-actions">
          <Link className="spanish-language-link" href={english} hrefLang="en" lang="en"><Globe aria-hidden="true" size={16} /> English</Link>
          <Link className="button marketing-header-cta" href="/studio">Abrir Studio <ArrowUpRight size={16} /></Link>
          <MobileMenu
            links={[...NAV.map(item => ({ href: item.href, label: item.label, hrefLang: item.hrefLang })), { href: english, label: 'English', hrefLang: 'en' }]}
            cta={{ href: '/studio', label: 'Abrir Studio' }}
            labels={{ open: 'Abrir menú', close: 'Cerrar menú', nav: 'Navegación' }}
          />
        </div>
      </div>
    </header>
  </>;
}

export function SpanishFooter() {
  return <footer className="marketing-footer" lang="es">
    <div className="marketing-footer-main">
      <div><Brand /><p>Ideas de packaging, hechas tangibles.</p></div>
      <div className="marketing-footer-links">
        <div><b>Herramientas</b>
          <Link href="/es/box-dieline-generator">Generador de troqueles</Link>
          <Link href="/es/box-templates">Plantillas de cajas</Link>
          <Link href="/3d-box-mockup-generator" hrefLang="en">Generador de mockups 3D (en inglés)</Link>
        </div>
        <div><b>Producto</b>
          <Link href="/es">3D Box Studio en español</Link>
          <Link href="/studio">Studio (en inglés)</Link>
          <Link href="/blog" hrefLang="en">Guías (en inglés)</Link>
        </div>
        <div><b>Empresa</b>
          <Link href="/contact" hrefLang="en">Contacto</Link>
          <Link href="/privacy" hrefLang="en">Privacidad</Link>
          <Link href="/terms" hrefLang="en">Condiciones</Link>
          <CookieSettingsButton label="Configurar cookies" />
        </div>
      </div>
    </div>
    <div className="marketing-footer-base"><span>© {new Date().getFullYear()} 3D Box Studio</span><span>Hecho para trabajos de packaging cuidados.</span></div>
  </footer>;
}
