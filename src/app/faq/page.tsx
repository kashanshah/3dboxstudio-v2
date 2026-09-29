import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { ContentHero, ContentPageShell } from '@/components/content-page-shell';
import { FaqExplorer } from '@/components/faq-explorer';
import { FAQ_CATEGORIES, FAQ_ITEMS, FAQ_PAGE_DESCRIPTION, FAQ_PAGE_TITLE, faqAnswerPlainText } from '@/content/faq';

export const metadata: Metadata = {
  title: { absolute: FAQ_PAGE_TITLE },
  description: FAQ_PAGE_DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: { title: FAQ_PAGE_TITLE, description: FAQ_PAGE_DESCRIPTION, url: '/faq', type: 'website' },
};

export default function FaqPage() {
  const schema = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: faqAnswerPlainText(item.answer) } })),
  };
  return <ContentPageShell>
    <ContentHero eyebrow="Help center" title="How can we help?" intro="Straightforward answers about designing, previewing, sharing, and exporting packaging work in 3D Box Studio." />
    <FaqExplorer items={FAQ_ITEMS} categories={FAQ_CATEGORIES} />
    <section className="content-cta"><div><p className="content-eyebrow">Still need help?</p><h2>Tell us where you’re stuck.</h2><p>Share the structure, file type, or workflow step you’re working on and we’ll point you in the right direction.</p></div><Link className="button" href="/contact">Contact us <ArrowUpRight size={17}/></Link></section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}}/>
  </ContentPageShell>;
}
