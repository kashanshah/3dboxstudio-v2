'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Menu, X } from 'lucide-react';

export type MobileMenuLink = { href: string; label: string; hrefLang?: string; native?: boolean };

/**
 * Phone navigation: a full-width sheet under the header with a backdrop.
 * Rendered in a portal because the header's backdrop-filter would otherwise
 * become the containing block for fixed elements and clip the backdrop.
 */
export function MobileMenu({ links, cta, labels }: {
  links: MobileMenuLink[];
  cta: { href: string; label: string };
  labels: { open: string; close: string; nav: string };
}) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    menuRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => { root.style.overflow = previous; document.removeEventListener('keydown', onKey); };
  }, [open]);

  const toggle = () => {
    const header = buttonRef.current?.closest('header');
    setTop(header ? Math.round(header.getBoundingClientRect().bottom) : 0);
    setOpen(value => !value);
  };

  return <>
    <button ref={buttonRef} className="marketing-menu-button" type="button" aria-expanded={open} aria-controls="marketing-mobile-menu" aria-label={open ? labels.close : labels.open} onClick={toggle}>{open ? <X size={21}/> : <Menu size={21}/>}</button>
    {open && createPortal(<>
      <div className="marketing-menu-scrim" style={{ top }} onClick={close} aria-hidden="true" />
      <nav ref={menuRef} id="marketing-mobile-menu" className="marketing-mobile-menu" style={{ top }} aria-label={labels.nav}>
        {links.map(link => link.native
          ? <a key={link.href} href={link.href} hrefLang={link.hrefLang} onClick={close}>{link.label}</a>
          : <Link key={link.href} href={link.href} hrefLang={link.hrefLang} onClick={close}>{link.label}</Link>)}
        <Link className="button marketing-mobile-menu-cta" href={cta.href} onClick={close}>{cta.label} <ArrowRight size={18}/></Link>
      </nav>
    </>, document.body)}
  </>;
}
