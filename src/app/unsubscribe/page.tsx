import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentPageShell } from '@/components/content-page-shell';
import { StripUrlSecrets } from '@/components/auth/strip-url-secrets';

export const metadata:Metadata={title:'Unsubscribe',description:'Stop the welcome emails from 3D Box Studio.',robots:{index:false,follow:false},referrer:'no-referrer'};

// The link in onboarding emails. Opening it changes nothing (mail scanners
// open links); the button posts to /api/email/unsubscribe.
export default async function UnsubscribePage({searchParams}:{searchParams:Promise<{token?:string;done?:string}>}){
  const {token:t,done}=await searchParams;
  return <ContentPageShell>
    <header className="legal-header"><p className="content-eyebrow">Email</p><h1>{done?'You are unsubscribed':'Unsubscribe'}</h1>
      {done?<p>We will not send you any more welcome emails. Account emails, such as password resets, still arrive when you ask for them.</p>
        :t?<><StripUrlSecrets/><p>Stop the welcome emails from 3D Box Studio? Account emails, such as password resets, still arrive when you ask for them.</p>
          <form method="post" action="/api/email/unsubscribe"><input type="hidden" name="t" value={t}/><input type="hidden" name="from" value="page"/><button type="submit" className="button button-primary">Unsubscribe</button></form></>
        :<p>This link is missing its code. Use the unsubscribe link in the email, or <Link href="/contact">contact us</Link> and we will do it for you.</p>}
    </header>
  </ContentPageShell>;
}
