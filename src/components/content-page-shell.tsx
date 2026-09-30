import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from '@/components/site-shell';

export function ContentPageShell({ children }: { children: ReactNode }) {
  return <div className="content-site"><SiteHeader /><main id="main">{children}</main><SiteFooter /></div>;
}

export function ContentHero({ eyebrow, title, intro, children, compact = false }: { eyebrow: string; title: string; intro: string; children?: ReactNode; compact?: boolean }) {
  return <header className={`content-hero${compact ? ' is-compact' : ''}`}><p className="content-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="content-lede">{intro}</p>{children}</header>;
}

export function StudioCta({ title = 'See your packaging from every angle.' }: { title?: string }) {
  return <section className="content-cta"><div><p className="content-eyebrow">3D Box Studio</p><h2>{title}</h2><p>Move from flat artwork to a dimensional packaging review in one focused workspace.</p></div><Link className="button" href="/studio">Open Studio <ArrowUpRight size={17}/></Link></section>;
}
