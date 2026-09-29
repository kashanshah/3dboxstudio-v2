import type { Metadata } from 'next';
import { SiteHeader, SiteFooter } from '@/components/site-shell';
import { CONTACT_PAGE_DESCRIPTION, CONTACT_PAGE_TITLE, CONTACT_TOPICS } from '@/content/contact';

export const metadata: Metadata = { title: { absolute: CONTACT_PAGE_TITLE }, description: CONTACT_PAGE_DESCRIPTION, alternates: { canonical: '/contact' } };

export default function ContactPage() {
  return <><SiteHeader/><main id="main" className="section seo-static-page contact-page"><span className="eyebrow">CONTACT</span><h1>Talk to 3D Box Studio.</h1><p className="page-intro">{CONTACT_PAGE_DESCRIPTION}</p>
    <div className="contact-card"><h2>What can we help with?</h2><div className="contact-topics">{CONTACT_TOPICS.map((topic)=><span key={topic.value}>{topic.label}</span>)}</div><p>Questions about packaging workflows, templates, artwork, or the Studio are welcome.</p><a className="button" href="https://www.3dboxstudio.com/contact">Send us a message</a></div>
  </main><SiteFooter/></>;
}
