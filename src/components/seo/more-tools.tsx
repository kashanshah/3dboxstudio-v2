import Link from 'next/link';
import { SEO_PAGES, servedSeoPage } from '@/content/seo-pages';
import './seo-blocks.css';

const TOOLS = [
  { page: SEO_PAGES.calculator, name: 'Box size calculator', blurb: 'From product size to inside and outside box dimensions.' },
  { page: SEO_PAGES.printable, name: 'Printable box templates', blurb: 'Print at 100% on A4 or Letter, cut and fold.' },
  { page: SEO_PAGES.cricut, name: 'Cricut box templates', blurb: 'Cut and score SVG, sized in inches.' },
  { page: SEO_PAGES.glossary, name: 'Packaging glossary', blurb: 'Dieline and box terms in plain words.' },
];

/** Links to the generator's companion pages that this deployment serves (drafts only on previews). */
export function MoreTools({ exclude }: { exclude?: string }) {
  const tools = TOOLS.filter(tool => servedSeoPage(tool.page) && tool.page.path !== exclude);
  if (!tools.length) return null;
  return <nav className="seo-more-tools" aria-labelledby="seo-more-tools-title">
    <h2 id="seo-more-tools-title">More free tools</h2>
    <ul>{tools.map(tool => <li key={tool.page.path}><Link href={tool.page.path}><b>{tool.name}</b><span>{tool.blurb}</span></Link></li>)}</ul>
  </nav>;
}
