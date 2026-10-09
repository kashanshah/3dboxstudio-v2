import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ContentHero, ContentPageShell } from '@/components/content-page-shell';
import { CONTACT_PAGE_DESCRIPTION, CONTACT_PAGE_TITLE } from '@/content/contact';
import { ContactForm, ContactTopicButtons } from '@/components/contact-form';

export const metadata: Metadata = { title: { absolute: CONTACT_PAGE_TITLE }, description: CONTACT_PAGE_DESCRIPTION, alternates: { canonical: '/contact' } };

export default function ContactPage() {
  return <ContentPageShell>
    <ContentHero eyebrow="Contact" title="Tell us what you’re working on." intro="Choose the closest topic and share enough context for a useful reply. For quick product questions, the help center may already have the answer." compact />
    <div className="contact-layout">
      <div>
        <ContactTopicButtons />
        <div className="contact-side-note"><BookOpen size={20}/><h3>Looking for a quick answer?</h3><p>Browse concise guidance on dimensions, artwork, materials, sharing, and export preparation.</p><Link className="content-text-link" href="/faq">Visit the help center <ArrowUpRight size={16}/></Link></div>
      </div>
      <div className="contact-panel" id="contact-form"><p className="content-eyebrow">Send a message</p><h2>Questions, feedback, or a workflow problem?</h2><p>{CONTACT_PAGE_DESCRIPTION}</p><ContactForm /></div>
    </div>
  </ContentPageShell>;
}
