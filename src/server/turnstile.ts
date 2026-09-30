import { getClientIp } from '@/server/rate-limit';

const VERIFY_URL='https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(token: unknown, req: Request): Promise<{ok:true}|{ok:false;error:string}> {
  const secret=process.env.TURNSTILE_SECRET_KEY?.trim();
  if(!secret) return {ok:true};
  if(typeof token!=='string' || !token.trim()) return {ok:false,error:'Please complete the verification and try again.'};
  try{
    const body:Record<string,string>={secret,response:token.trim()};
    const ip=getClientIp(req); if(ip!=='unknown') body.remoteip=ip;
    const res=await fetch(VERIFY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>null) as {success?:boolean}|null;
    return res.ok && data?.success===true ? {ok:true}:{ok:false,error:'Please complete the verification and try again.'};
  }catch{return {ok:false,error:'Verification could not be completed. Please try again.'};}
}
