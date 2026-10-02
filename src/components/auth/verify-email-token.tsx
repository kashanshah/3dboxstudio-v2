'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {AuthShell,AuthNotice} from './auth-shell';
import {useAuth} from './auth-provider';
import {safeReturnTo} from '@/lib/auth-navigation';

type VerificationResult={ok:true;message:string}|{ok:false;error:string;retryable:boolean};

async function verifyToken(token:string):Promise<VerificationResult>{
  try{
    const response=await fetch('/api/auth/verify-email',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok || !result?.message)return {
      ok:false,error:result?.error || 'The account service is unavailable. Please try again shortly.',
      retryable:response.status>=500 || response.status===429 || response.ok,
    };
    return {ok:true,message:result.message};
  }catch{
    return {ok:false,error:'Could not connect. Please try again.',retryable:true};
  }
}

export function VerifyEmailToken({token,next}:{token:string;next?:string}){
  const {refresh}=useAuth();
  const [result,setResult]=useState<VerificationResult|null>(null);
  const [attempt,setAttempt]=useState(0);
  const pending=useRef<Promise<VerificationResult>|null>(null);

  useEffect(()=>{
    let active=true;
    // Reuse the same request across Strict Mode's effect setup/cleanup cycle:
    // verification tokens are single use.
    pending.current ??= verifyToken(token);
    void pending.current.then(async value=>{
      if(!active)return;
      setResult(value);
      if(value.ok)await refresh();
    });
    return ()=>{active=false;};
  },[token,refresh,attempt]);

  function retry(){pending.current=null;setResult(null);setAttempt(value=>value+1);}

  return <AuthShell eyebrow="Verify your email" title="Confirm your email"
    intro="We’ll verify your email automatically using the link you opened."
    footer={<Link href="/login">Back to sign in</Link>}>
    <div aria-live="polite" aria-busy={!result}>
      {!result?<AuthNotice kind="info">Verifying your email…</AuthNotice>
        :result.ok?<AuthNotice>{result.message}</AuthNotice>
        :<AuthNotice kind="error">{result.error}</AuthNotice>}
    </div>
    {result&&<div className="auth-status-actions">
      {!result.ok&&(result.retryable
        ?<button className="button button-primary" onClick={retry}>Try again</button>
        :<Link className="button button-primary" href="/verify-email">Request a new verification email</Link>)}
      <Link className={`button ${result.ok?'button-primary':'button-secondary'}`} href={safeReturnTo(next)}>Continue to Studio <ArrowRight size={16} aria-hidden="true"/></Link>
    </div>}
  </AuthShell>;
}
