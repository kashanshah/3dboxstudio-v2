'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CONTACT_TOPICS } from '@/content/contact';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

function Turnstile({onToken}:{onToken:(token:string|null)=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  const widget=useRef<string|null>(null);
  const siteKey=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  useEffect(()=>{
    if(!siteKey || !ref.current) return;
    let cancelled=false;
    const render=()=>{
      if(cancelled || !ref.current || !window.turnstile || widget.current) return;
      widget.current=window.turnstile.render(ref.current,{
        sitekey:siteKey,
        theme:'light',
        size:'flexible',
        action:'contact',
        callback:(token:string)=>onToken(token),
        'expired-callback':()=>onToken(null),
        'error-callback':()=>onToken(null),
      });
    };
    if(window.turnstile){render();return()=>{cancelled=true;if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);};}
    const existing=document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const script=existing||document.createElement('script');
    if(!existing){script.src=SCRIPT;script.async=true;document.head.appendChild(script);}
    script.addEventListener('load',render,{once:true});
    return()=>{cancelled=true;script.removeEventListener('load',render);if(widget.current&&window.turnstile)window.turnstile.remove(widget.current);};
  },[siteKey,onToken]);

  if(!siteKey) return null;
  return <div className="contact-turnstile"><div ref={ref}/></div>;
}

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
      <label><span>Topic</span><select name="topic" defaultValue={CONTACT_TOPICS[0]?.value}>{CONTACT_TOPICS.map(topic=><option key={topic.value} value={topic.value}>{topic.label}</option>)}</select></label>
      <label><span>Subject</span><input name="subject" maxLength={200} required placeholder="Brief summary"/></label>
    </div>
    <label><span>Message</span><textarea name="message" rows={7} maxLength={5000} required placeholder="Tell us how we can help…"/></label>
    <Turnstile onToken={setToken}/>
    <div className="v2-contact-actions"><button className="button" type="submit" disabled={loading}>{loading?'Sending…':'Send message'}</button><p>For quick answers, check the <Link href="/faq">FAQ</Link>.</p></div>
  </form>;
}
