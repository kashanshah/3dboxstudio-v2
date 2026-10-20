'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ChevronRight, Bug, BriefcaseBusiness, Lightbulb, MessageSquareText } from 'lucide-react';
import { CONTACT_TOPICS, type ContactTopic } from '@/content/contact';
import { Turnstile } from '@/components/turnstile';

export function ContactForm() {
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState(false);
  const [token,setToken]=useState<string|null>(null);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    const form=e.currentTarget;
    const data=new FormData(form);
    const payload={
      name:String(data.get('name')||'').trim(),
      email:String(data.get('email')||'').trim(),
      topic:String(data.get('topic')||''),
      subject:String(data.get('subject')||'').trim(),
      message:String(data.get('message')||'').trim(),
      locale:'en',
      pagePath:window.location.pathname,
      turnstileToken:token,
    };
    try{
      const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const body=await r.json().catch(()=>({})) as {error?:string};
      if(!r.ok){setError(body.error||'Could not send your message. Please try again.');return;}
      form.reset(); setSuccess(true); setToken(null);
    }catch{setError('Could not send your message. Please check your connection and try again.');}
    finally{setLoading(false);}
  }

  if(success) return <div className="contact-form-success" role="status"><h2>Message sent</h2><p>Thanks for reaching out. We’ll reply to the email you provided.</p><button className="button" type="button" onClick={()=>setSuccess(false)}>Send another message</button></div>;

  return <form className="v2-contact-form" onSubmit={submit}>
    {error?<p className="contact-form-error" role="alert">{error}</p>:null}
    <div className="v2-contact-grid">
      <label><span>Name</span><input name="name" autoComplete="name" maxLength={120} required placeholder="Your name"/></label>
      <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label>
    </div>
    <div className="v2-contact-grid">
      <label><span>Topic</span><select id="contact-topic" name="topic" defaultValue={CONTACT_TOPICS[0]?.value}>{CONTACT_TOPICS.map(topic=><option key={topic.value} value={topic.value}>{topic.label}</option>)}</select></label>
      <label><span>Subject</span><input id="contact-subject" name="subject" maxLength={200} required placeholder="Brief summary"/></label>
    </div>
    <label><span>Message</span><textarea name="message" rows={7} maxLength={5000} required placeholder="Tell us how we can help…"/></label>
    <Turnstile onToken={setToken}/>
    <div className="v2-contact-actions"><button className="button" type="submit" disabled={loading}>{loading?'Sending…':'Send message'}</button><p>For quick answers, check the <Link href="/faq">FAQ</Link>.</p></div>
  </form>;
}

const TOPIC_ICONS = { general: MessageSquareText, bug: Bug, feature: Lightbulb, business: BriefcaseBusiness, other: MessageSquareText } as const;

/** Topic shortcuts: preselect the form's topic and move to the form. */
export function ContactTopicButtons() {
  const [selected,setSelected]=useState<ContactTopic|null>(null);
  const choose=(topic:ContactTopic)=>{
    setSelected(topic);
    const select=document.getElementById('contact-topic');
    if(select instanceof HTMLSelectElement) select.value=topic;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('contact-form')?.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
    document.getElementById('contact-subject')?.focus({preventScroll:true});
  };
  return <div className="contact-topic-list" role="group" aria-label="Contact topics">
    {CONTACT_TOPICS.map(topic=>{const Icon=TOPIC_ICONS[topic.value];return <button type="button" className="contact-topic-card" key={topic.value} aria-pressed={selected===topic.value} aria-controls="contact-topic" onClick={()=>choose(topic.value)}>
      <Icon size={21} aria-hidden="true"/><span><b>{topic.label}</b><small>{topic.hint}</small></span><ChevronRight size={17} aria-hidden="true"/>
    </button>;})}
  </div>;
}
