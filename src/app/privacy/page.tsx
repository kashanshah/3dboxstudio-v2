import type { Metadata } from 'next';
import { ContentPageShell } from '@/components/content-page-shell';
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_PAGE_DESCRIPTION, PRIVACY_PAGE_TITLE, PRIVACY_SECTIONS, type PrivacySection } from '@/content/privacy';

export const metadata: Metadata = { title: { absolute: `${PRIVACY_PAGE_TITLE} | 3D Box Studio` }, description: PRIVACY_PAGE_DESCRIPTION, alternates: { canonical: '/privacy' } };

function slug(text: string) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
type PrivacyBodySection = Exclude<PrivacySection, { type: 'h2' }>;
function groups() {
  const result: { title: string; id: string; sections: PrivacyBodySection[] }[] = [];
  for (const section of PRIVACY_SECTIONS) {
    if (section.type === 'h2') result.push({ title: section.text, id: `privacy-${slug(section.text)}`, sections: [] });
    else {
      if (!result.length) result.push({ title: 'Overview', id: 'privacy-overview', sections: [] });
      result[result.length - 1].sections.push(section as PrivacyBodySection);
    }
  }
  return result;
}

export default function PrivacyPage() {
  const grouped = groups();
  return <ContentPageShell>
    <header className="legal-header"><p className="content-eyebrow">Legal</p><h1>{PRIVACY_PAGE_TITLE}</h1><p>{PRIVACY_PAGE_DESCRIPTION}</p><div className="legal-meta"><span>Effective {PRIVACY_EFFECTIVE_DATE}</span><span>Readable policy layout for V2</span></div></header>
    <div className="legal-layout">
      <nav className="legal-toc" aria-label="Privacy policy sections"><b>On this page</b>{grouped.map((group) => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}</nav>
      <article className="legal-body">{grouped.map((group) => <section id={group.id} key={group.id}><h2>{group.title}</h2>{group.sections.map((section,index) => {
        if(section.type==='p') return <p key={index}>{section.text}</p>;
        return <ul key={index}>{section.items.map((item)=><li key={item}>{item}</li>)}</ul>;
      })}</section>)}</article>
    </div>
  </ContentPageShell>;
}
