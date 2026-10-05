import { adminAlertEmail, sendEmail } from '@/server/email/mailer';
import { captureServerEvent } from '@/lib/posthog-server';

export type OpsAlertKind='email_delivery'|'google_oauth';

const ALERT_INTERVAL_MS=15*60_000;
const lastAlertAt=new Map<string,number>();

function describe(error:unknown){
  if(error instanceof Error)return error.message;
  return typeof error==='string'?error:JSON.stringify(error);
}

function escapeHtml(value:string){
  return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
}

/**
 * Tell the site admin about an operational failure that users only see as a
 * generic message. Never throws: alerting must not break the user's request.
 * Repeats of the same alert are throttled per server instance; every
 * occurrence is still logged.
 */
export async function alertAdmin(kind:OpsAlertKind,summary:string,details:Record<string,string|number|boolean|null|undefined>,error?:unknown):Promise<void>{
  const reason=error===undefined?undefined:describe(error);
  const fields={...details,...(reason?{error:reason}:{})};
  console.error(`[ops-alert] ${kind}: ${summary}`,fields);
  await captureServerEvent('system:ops-alerts','ops_alert',{kind,summary,...Object.fromEntries(Object.entries(fields).filter(([,value])=>value!=null).map(([key,value])=>[key,String(value).slice(0,500)]))}).catch(()=>{});

  const key=`${kind}:${summary}`;
  const now=Date.now();
  if(now-(lastAlertAt.get(key)??0)<ALERT_INTERVAL_MS)return;
  lastAlertAt.set(key,now);

  const rows=Object.entries(fields).filter(([,value])=>value!=null&&value!=='').map(([key,value])=>[key,String(value)]);
  const text=[summary,'',...rows.map(([key,value])=>`${key}: ${value}`),'',`Time: ${new Date(now).toISOString()}`,'Repeats of this alert are suppressed for 15 minutes; check the Vercel logs for every occurrence.'].join('\n');
  const html=`<p><strong>${escapeHtml(summary)}</strong></p><table cellpadding="4">${rows.map(([key,value])=>`<tr><td><b>${escapeHtml(key)}</b></td><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p style="color:#667085">Time: ${new Date(now).toISOString()}<br>Repeats of this alert are suppressed for 15 minutes; check the Vercel logs for every occurrence.</p>`;
  try{
    await sendEmail({to:await adminAlertEmail(),subject:`[3D Box Studio alert] ${summary}`,html,text});
  }catch(alertError){
    console.error('[ops-alert] could not email the admin alert',describe(alertError));
  }
}
