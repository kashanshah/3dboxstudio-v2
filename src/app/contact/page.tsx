import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, Bug, Lightbulb, MessageSquareText, BriefcaseBusiness } from 'lucide-react';
import { ContentHero, ContentPageShell } from '@/components/content-page-shell';
import { CONTACT_PAGE_DESCRIPTION, CONTACT_PAGE_TITLE, CONTACT_TOPICS } from '@/content/contact';
import { ContactForm } from '@/components/contact-form';

export const metadata: Metadata = { title: { absolute: CONTACT_PAGE_TITLE }, description: CONTACT_PAGE_DESCRIPTION, alternates: { canonical: '/contact' } };

const icons = { general: MessageSquareText, bug: Bug, feature: Lightbulb, business: BriefcaseBusiness, other: MessageSquareText } as const;

export default function ContactPage() {
  return <ContentPageShell>
    <ContentHero eyebrow="Contact" title="Tell us what you’re working on." intro="Choose the closest topic and share enough context for a useful reply. For quick product questions, the help center may already have the answer." compact />
    <div className="contact-layout">
      <div>
        <div className="contact-topic-list" aria-label="Contact topics">
          {CONTACT_TOPICS.map((topic) => { const Icon = icons[topic.value]; return <div className="contact-topic-card" key={topic.value}><Icon size={21}/><span><b>{topic.label}</b><small>We’ll route your message to the right context.</small></span><ArrowUpRight size={17}/></div>; })}
        </div>
        <div className="contact-side-note"><BookOpen size={20}/><h3>Looking for a quick answer?</h3><p>Browse concise guidance on dimensions, artwork, materials, sharing, and export preparation.</p><Link className="content-text-link" href="/faq">Visit the help center <ArrowUpRight size={16}/></Link></div>
      </div>
      <div className="contact-panel"><p className="content-eyebrow">Send a message</p><h2>Questions, feedback, or a workflow problem?</h2><p>{CONTACT_PAGE_DESCRIPTION}</p><ContactForm /></div>
    </div>
  </ContentPageShell>;
}
