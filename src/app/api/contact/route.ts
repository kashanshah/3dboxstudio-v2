import { NextResponse } from 'next/server';
import { CONTACT_TOPICS } from '@/content/contact';
import { enforceRateLimit,getClientIp } from '@/server/rate-limit';
import { createContactSubmission } from '@/server/contact-submissions';
import { sendAdminContactSubmissionEmail } from '@/server/email/mailer';
import { verifyTurnstileToken } from '@/server/turnstile';
const VALID=new Set<string>(CONTACT_TOPICS.map(t=>t.value)); const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function text(v:unknown,max:number){if(typeof v!=='string')return null;const x=v.trim();return x&&x.length<=max?x:null;}
export async function POST(req:Request){
  const limited=enforceRateLimit(req,'contact:submit',{windowMs:15*60*1000,max:5});if(limited)return limited;
  const body=await req.json().catch(()=>null) as Record<string,unknown>|null;
  const name=text(body?.name,120), email=text(body?.email,254), topic=typeof body?.topic==='string'&&VALID.has(body.topic)?body.topic:null, subject=text(body?.subject,200), message=text(body?.message,5000);
  if(!name)return NextResponse.json({error:'Enter your name.'},{status:400});if(!email||!EMAIL.test(email))return NextResponse.json({error:'Enter a valid email address.'},{status:400});if(!topic)return NextResponse.json({error:'Choose a topic.'},{status:400});if(!subject)return NextResponse.json({error:'Enter a subject.'},{status:400});if(!message)return NextResponse.json({error:'Enter a message.'},{status:400});
  const captcha=await verifyTurnstileToken(body?.turnstileToken,req);if(!captcha.ok)return NextResponse.json({error:captcha.error},{status:403});
  const saved=await createContactSubmission({name,email,topic,subject,message,locale:text(body?.locale,16),pagePath:text(body?.pagePath,200),referrer:req.headers.get('referer'),ipAddress:getClientIp(req),userAgent:req.headers.get('user-agent')});
  try{await sendAdminContactSubmissionEmail({id:saved.id,name,email,topic,subject,message,submittedAt:saved.createdAt});}catch(error){console.error('Contact admin email failed:',error);}
  return NextResponse.json({ok:true,id:saved.id});
}
