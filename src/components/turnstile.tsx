'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi; }
}

const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** Cloudflare Turnstile, when a site key is set; reports the token as it changes. */
export function Turnstile({onToken,action='contact'}:{onToken:(token:string|null)=>void;action?:string}) {
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
        action,
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
  },[siteKey,onToken,action]);

  if(!siteKey) return null;
  return <div className="contact-turnstile"><div ref={ref}/></div>;
}
