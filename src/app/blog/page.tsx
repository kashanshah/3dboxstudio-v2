import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/site-shell';

export const metadata: Metadata = { title: 'Journal', description: 'Packaging ideas, practical guides, and notes from 3D Box Studio.' };
export default function Blog() {
  return <><SiteHeader /><main id="main" className="journal-page section"><span className="eyebrow">IDEAS WORTH UNBOXING</span><h1>The journal.</h1><p className="page-intro">Packaging perspectives, practical guides, and notes from the studio.</p><div className="journal-empty"><BookOpen size={32} strokeWidth={1.3} /><h2>A fresh page.</h2><p>We’re preparing the V2 journal. Existing articles will be reviewed and their URLs mapped before launch.</p><Link href="/studio" className="button">Explore the preview <ArrowUpRight size={17} /></Link></div></main><SiteFooter /></>;
}
