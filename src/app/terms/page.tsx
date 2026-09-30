import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content-page-shell';
import { TERMS_EFFECTIVE_DATE, TERMS_PAGE_DESCRIPTION, TERMS_PAGE_TITLE, TERMS_SECTIONS, type TermsSection } from '@/content/terms';

export const metadata: Metadata = { title: { absolute: `${TERMS_PAGE_TITLE} | 3D Box Studio` }, description: TERMS_PAGE_DESCRIPTION, alternates: { canonical: '/terms' } };

function slug(text: string) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
type TermsBodySection = Exclude<TermsSection, { type: 'h2' }>;
function groups() {
  const result: { title: string; id: string; sections: TermsBodySection[] }[] = [];
  for (const section of TERMS_SECTIONS) {
    if (section.type === 'h2') result.push({ title: section.text, id: `terms-${slug(section.text)}`, sections: [] });
    else {
      if (!result.length) result.push({ title: 'Overview', id: 'terms-overview', sections: [] });
      result[result.length - 1].sections.push(section as TermsBodySection);
    }
  }
  return result;
}

export default function TermsPage() {
  const grouped = groups();
  return <ContentPageShell>
    <header className="legal-header"><p className="content-eyebrow">Legal</p><h1>{TERMS_PAGE_TITLE}</h1><p>{TERMS_PAGE_DESCRIPTION}</p><div className="legal-meta"><span>Effective {TERMS_EFFECTIVE_DATE}</span><span>Terms for using 3D Box Studio</span></div></header>
    <div className="legal-layout">
      <nav className="legal-toc" aria-label="Terms sections"><b>On this page</b>{grouped.map((group) => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}</nav>
      <article className="legal-body">{grouped.map((group) => <section id={group.id} key={group.id}><h2>{group.title}</h2>{group.sections.map((section,index) => {
        if(section.type==='p') return <p key={index}>{section.text}</p>;
        if(section.type==='ul') return <ul key={index}>{section.items.map((item:string)=><li key={item}>{item}</li>)}</ul>;
        return null;
      })}</section>)}</article>
    </div>
  </ContentPageShell>;
}
