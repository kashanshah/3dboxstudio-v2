import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { unsubscribe } from '@/server/onboarding-emails';
import { requestOrigin } from '@/server/request-origin';

export const runtime='nodejs';

// Unsubscribes from onboarding emails. Mail clients post here directly
// (List-Unsubscribe-Post, token in the URL); the /unsubscribe page posts its
// form here and is sent back to say it worked. Only POST changes anything, so
// link scanners that open emails cannot unsubscribe people.
export async function POST(req:Request){
  const url=new URL(req.url);
  const form=await req.formData().catch(()=>null);
  const token=String(form?.get('t')??url.searchParams.get('t')??'');
  await ensureV2Schema();
  await unsubscribe(token);
  if(form?.get('from')==='page') return NextResponse.redirect(new URL('/unsubscribe?done=1',requestOrigin(req)),303);
  return NextResponse.json({ok:true});
}
