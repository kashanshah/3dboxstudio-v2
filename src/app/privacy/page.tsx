import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_PAGE_DESCRIPTION, PRIVACY_PAGE_TITLE, PRIVACY_SECTIONS } from '@/content/privacy';

export const metadata: Metadata = { title: { absolute: `${PRIVACY_PAGE_TITLE} | 3D Box Studio` }, description: PRIVACY_PAGE_DESCRIPTION, alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return <><SiteHeader/><main id="main" className="section seo-static-page legal-page"><span className="eyebrow">LEGAL</span><h1>{PRIVACY_PAGE_TITLE}</h1><p className="legal-date">Effective {PRIVACY_EFFECTIVE_DATE}</p><div className="legal-content">{PRIVACY_SECTIONS.map((section,index)=>{
    if(section.type==='h2') return <h2 key={index}>{section.text}</h2>;
    if(section.type==='p') return <p key={index}>{section.text}</p>;
    return <ul key={index}>{section.items.map((item)=><li key={item}>{item}</li>)}</ul>;
  })}</div></main><SiteFooter/></>;
}
