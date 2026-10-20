import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { inlineLinks } from '@/components/inline-links';
import { LandingPage } from '@/components/seo/landing-page';
import { GLOSSARY } from '@/content/packaging-glossary';
import { SEO_PAGES, seoPageMetadata, servedSeoPage } from '@/content/seo-pages';
import { site } from '@/lib/site';
import './glossary.css';

const page = SEO_PAGES.glossary;
export const metadata: Metadata = seoPageMetadata(page);

const plain = (text: string) => text.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '$1');

export default function PackagingGlossaryPage() {
  if (!servedSeoPage(page)) notFound();
  const url = new URL(page.path, site.url).toString();
  const letters = Array.from(new Set(GLOSSARY.map(item => item.term[0].toUpperCase())));
  return <LandingPage
    crumbs={[{ name: 'Guides', path: '/blog' }, { name: 'Packaging glossary', path: page.path }]}
    eyebrow="Glossary"
    title="Packaging and dieline terms"
    intro={`${GLOSSARY.length} terms you meet on a dieline and in a printer's quote, each explained in a sentence or two: the lines on a dieline, board thickness and weight, box styles and their codes.`}
    updated="2026-10-20"
    schema={[{
      '@type': 'DefinedTermSet', name: 'Packaging and dieline terms', url,
      hasDefinedTerm: GLOSSARY.map(item => ({ '@type': 'DefinedTerm', name: item.term, description: plain(item.definition), url: `${url}#${item.id}`, ...(item.aka ? { alternateName: item.aka } : {}) })),
    }]}>
    <nav className="glossary-letters" aria-label="Jump to a letter">
      {letters.map(letter => <a key={letter} href={`#letter-${letter}`}>{letter}</a>)}
    </nav>
    <div className="glossary">
      {letters.map(letter => <section key={letter} id={`letter-${letter}`} aria-labelledby={`letter-${letter}-title`}>
        <h2 id={`letter-${letter}-title`}>{letter}</h2>
        <dl>
          {GLOSSARY.filter(item => item.term[0].toUpperCase() === letter).map(item => <div key={item.id} id={item.id}>
            <dt>{item.term}{item.aka ? <small> also {item.aka.join(', ')}</small> : null}</dt>
            <dd>{inlineLinks(item.definition)}</dd>
          </div>)}
        </dl>
      </section>)}
    </div>
  </LandingPage>;
}
