import { optionalEnv, requireEnv } from '@/server/env';
import { getAdminSettings } from '@/server/admin/settings';
import { renderAdminContactTemplate, renderAdminPrintQuoteTemplate, renderAdminSiteFeedbackTemplate } from './templates';
import { resendApiUrl } from './resend-api';

const SEND_TIMEOUT_MS=10_000;

export async function sendEmail(input:{to:string;subject:string;html:string;text?:string;replyTo?:string}) {
  const key=requireEnv('RESEND_API_KEY');
  // Resend's sandbox sender only delivers to the Resend account owner, so a
  // missing EMAIL_FROM must fail loudly in production rather than silently.
  const from=process.env.VERCEL_ENV==='production'?requireEnv('EMAIL_FROM'):optionalEnv('EMAIL_FROM','3D Box Studio <onboarding@resend.dev>');
  const response=await fetch(resendApiUrl('/emails'),{method:'POST',signal:AbortSignal.timeout(SEND_TIMEOUT_MS),headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:input.to,subject:input.subject,html:input.html,text:input.text,...(input.replyTo?{reply_to:input.replyTo}:{})})});
  if(!response.ok) throw new Error(`Resend request failed (${response.status}): ${await response.text().catch(()=> '')}`);
}
export async function adminAlertEmail() {
  const settings=await getAdminSettings().catch(()=>null);
  return settings?.notificationEmail || requireEnv('ADMIN_EMAIL');
}
export async function sendAdminContactSubmissionEmail(input:{id:string;name:string;email:string;topic:string;subject:string;message:string;submittedAt:string}) {
  const settings=await getAdminSettings().catch(()=>null);
  if(settings && !settings.notificationPreferences.contactMessage) return;
  const rendered=renderAdminContactTemplate(input);
  await sendEmail({to:await adminAlertEmail(),replyTo:input.email,...rendered});
}

/** Always sent: a print quote is a request someone is waiting on. */
export async function sendAdminPrintQuoteEmail(input:Parameters<typeof renderAdminPrintQuoteTemplate>[0]) {
  await sendEmail({to:await adminAlertEmail(),replyTo:input.email,...renderAdminPrintQuoteTemplate(input)});
}

/** Follows the contact-message notification setting: feedback is the same kind of message. */
export async function sendAdminSiteFeedbackEmail(input:Parameters<typeof renderAdminSiteFeedbackTemplate>[0]) {
  const settings=await getAdminSettings().catch(()=>null);
  if(settings && !settings.notificationPreferences.contactMessage) return;
  await sendEmail({to:await adminAlertEmail(),...(input.replyTo?{replyTo:input.replyTo}:{}),...renderAdminSiteFeedbackTemplate(input)});
}
