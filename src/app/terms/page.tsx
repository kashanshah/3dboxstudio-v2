import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { TERMS_EFFECTIVE_DATE, TERMS_PAGE_DESCRIPTION, TERMS_PAGE_TITLE, TERMS_SECTIONS } from '@/content/terms';

export const metadata: Metadata = { title: { absolute: `${TERMS_PAGE_TITLE} | 3D Box Studio` }, description: TERMS_PAGE_DESCRIPTION, alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return <><SiteHeader/><main id="main" className="section seo-static-page legal-page"><span className="eyebrow">LEGAL</span><h1>{TERMS_PAGE_TITLE}</h1><p className="legal-date">Effective {TERMS_EFFECTIVE_DATE}</p><div className="legal-content">{TERMS_SECTIONS.map((section,index)=>{
    if(section.type==='h2') return <h2 key={index}>{section.text}</h2>;
    if(section.type==='p') return <p key={index}>{section.text}</p>;
    return <ul key={index}>{section.items.map((item)=><li key={item}>{item}</li>)}</ul>;
  })}</div></main><SiteFooter/></>;
}
