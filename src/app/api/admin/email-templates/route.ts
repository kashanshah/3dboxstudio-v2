import { NextResponse } from 'next/server'; import { requireAdminApi } from '@/server/admin/auth'; import { getEmailTemplatePreviews } from '@/server/email/templates'; import { adminAlertEmail, sendEmail } from '@/server/email/mailer'; import { requestOrigin } from '@/server/request-origin';
export async function GET(){const denied=await requireAdminApi();if(denied)return denied;return NextResponse.json({items:getEmailTemplatePreviews()});}
/** Sends one template's preview to the admin notification address, so it can be checked in a real inbox. */
export async function POST(req:Request){
 const denied=await requireAdminApi();if(denied)return denied;
 if(req.headers.get('origin')!==requestOrigin(req)||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
 const body=await req.json().catch(()=>null) as {id?:unknown}|null;
 const item=getEmailTemplatePreviews().find(x=>x.id===body?.id);
 if(!item)return NextResponse.json({error:'Unknown template.'},{status:404});
 try{
  const to=await adminAlertEmail();
  await sendEmail({to,subject:`[Test] ${item.subject}`,html:item.html,text:item.text});
  return NextResponse.json({sentTo:to});
 }catch(error){
  console.error('test email failed',error);
  return NextResponse.json({error:'Could not send the test email. Check the Resend settings.'},{status:502});
 }
}
