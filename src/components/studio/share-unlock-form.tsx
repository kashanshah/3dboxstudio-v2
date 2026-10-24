'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import type { ShareBrand } from '@/lib/share-brand';
import { SharedBrand } from '@/components/studio/shared-brand';
import { Brand } from '@/components/site-shell';

// A password-protected share before it is unlocked. The right password sets a
// cookie (/api/shares/[id]/unlock) and the page reloads with the design.
export function ShareUnlockForm({shareId,brand}:{shareId:string;brand:ShareBrand|null}){
  const router=useRouter();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const password=String(new FormData(event.currentTarget).get('password')??'');
    setBusy(true);setError('');
    try{
      const response=await fetch(`/api/shares/${encodeURIComponent(shareId)}/unlock`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
      const body=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok){setError(response.status===429?'Too many tries. Wait a few minutes and try again.':body.error??'Could not check the password.');return;}
      router.refresh();
    }catch{setError('Could not check the password. Check your connection and try again.');}
    finally{setBusy(false);}
  }
  return <main className="shared-design-viewer share-unlock-page">
    <header className="shared-design-header">{brand?<SharedBrand brand={brand}/>:<Brand/>}<span/><span/></header>
    <form className="share-unlock" onSubmit={submit}>
      <Lock aria-hidden="true"/>
      <h1>This design is password protected</h1>
      <p>Enter the password you were given to view it.</p>
      <label><span>Password</span><input name="password" type="password" autoComplete="off" required maxLength={128} autoFocus/></label>
      {error&&<p className="share-unlock-error" role="alert">{error}</p>}
      <button type="submit" className="button button-primary" disabled={busy}>{busy?'Checking…':'View design'}</button>
    </form>
  </main>;
}
