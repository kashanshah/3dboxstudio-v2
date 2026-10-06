'use client';
import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { campaignScheduleIso, renderCampaign, type Campaign, type CampaignContent, type CampaignReview, type Segment } from '@/lib/email-campaigns';
import { campaignApi, campaignDate, METRIC_LABELS } from './campaign-api';
import { CampaignMetricCards } from './campaign-metric-cards';
import { AdminCampaignReports } from './admin-campaign-reports';
import { CampaignUsage } from './campaign-usage';

function contentOf(c:Campaign):CampaignContent { return { name:c.name,subject:c.subject,previewText:c.previewText,from:c.from,replyTo:c.replyTo,segmentId:c.segmentId,postalAddress:c.postalAddress,html:c.html,text:c.text }; }
function tomorrowMorning() {
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const next=new Date(`${today}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
  return `${next.toISOString().slice(0,10)}T09:00`;
}
type Activity = { events:{event_type:string;recipient:string;link:string|null;occurred_at:string;detail:{test?:boolean;reason?:string}}[];audit:{action:string;detail:Record<string,unknown>;created_at:string}[];recorded:{event_type:string;events:number;emails:number}[] };
export function AdminCampaignEditor({initial,segments,webhookReady,onBack,onChanged}:{initial:Campaign;segments:Segment[];webhookReady:boolean;onBack:()=>void;onChanged:(campaign:Campaign)=>void}) {
  const [campaign,setCampaign]=useState(initial);
  const [content,setContent]=useState(()=>contentOf(initial));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [recipient,setRecipient]=useState(initial.testRecipient || '');
  const [testRequestId,setTestRequestId]=useState('');
  const [wallTime,setWallTime]=useState(tomorrowMorning);
  const [timeZone,setTimeZone]=useState('America/Toronto');
  const [review,setReview]=useState<CampaignReview|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [modal,setModal]=useState<'schedule'|'cancel'|null>(null);
  const [activity,setActivity]=useState<Activity|null>(null);
  const [trend,setTrend]=useState<Record<string,unknown>[]>([]);
  const dialog=useRef<HTMLDialogElement>(null);
  const editable=campaign.status==='draft';
  const dirty=JSON.stringify(content)!==JSON.stringify(contentOf(campaign));
  const preview=renderCampaign(useDeferredValue(content),true);
  const update=(key:keyof CampaignContent,value:string)=>setContent(c=>({...c,[key]:value}));
  const loadActivity=useCallback(async()=>{const result=await campaignApi<Activity>(`?view=detail&id=${initial.id}`);setActivity(result);},[initial.id]);
  useEffect(()=>{let alive=true;campaignApi<Activity>(`?view=detail&id=${initial.id}`).then(v=>alive&&setActivity(v)).catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[initial.id]);
  useEffect(()=>{if(modal)dialog.current?.showModal();else dialog.current?.close();},[modal]);
  useEffect(()=>{
    if(!campaign.broadcastId)return;
    const interval=setInterval(()=>{if(document.visibilityState!=='visible'||busy)return;campaignApi<{campaign:Campaign & {trend?:Record<string,unknown>[]}}>('',{action:'refresh',id:campaign.id}).then(result=>{setCampaign(result.campaign);if(result.campaign.trend)setTrend(result.campaign.trend);void loadActivity();}).catch(e=>setError(e.message));},60_000);
    return()=>clearInterval(interval);
  },[campaign.id,campaign.broadcastId,busy,loadActivity]);
  async function perform(action:string,extra:Record<string,unknown>={}) {
    setBusy(true);setError('');setNotice('');
    try {const result=await campaignApi<{campaign:Campaign & {trend?:Record<string,unknown>[]}}>('',{action,id:campaign.id,revision:campaign.revision,...extra});setCampaign(result.campaign);if(result.campaign.trend)setTrend(result.campaign.trend);if(action==='save'){setContent(contentOf(result.campaign));setTestRequestId('');}onChanged(result.campaign);await loadActivity();return result.campaign;}
    catch(e){setError((e as Error).message);return null;}finally{setBusy(false);}
  }
  async function test() {
    const requestId=testRequestId || crypto.randomUUID();setTestRequestId(requestId);
    const result=await perform('test',{recipient,requestId});
    if(result){setTestRequestId('');setNotice(`Test accepted by Resend for ${recipient}. Check the inbox before scheduling.`);}
  }
  async function prepareReview() {setBusy(true);setError('');try{const result=await campaignApi<CampaignReview>(`?view=review&id=${campaign.id}`);setReview(result);setConfirmed(false);setModal('schedule');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function tracking() {setBusy(true);setError('');try{await campaignApi('',{action:'enable-tracking',from:campaign.from});setReview(await campaignApi<CampaignReview>(`?view=review&id=${campaign.id}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function schedule() {if(!review)return;const result=await perform('schedule',{fingerprint:review.fingerprint,wallTime,timeZone,confirmed});if(result){setModal(null);setNotice(`Campaign ${result.status} in Resend.`);}}
  let scheduleDescription='Choose a valid future date and time.';
  let validSchedule=false;
  try{const utc=campaignScheduleIso(wallTime,timeZone);scheduleDescription=`${campaignDate(utc,timeZone)} (${timeZone}) · ${utc} UTC`;validSchedule=true;}catch(e){scheduleDescription=(e as Error).message;}
  return <>
    <div className="campaign-heading"><div><button className="campaign-back" onClick={onBack}>← All campaigns</button><h1>{campaign.name}</h1><p className="admin-muted"><span className={`campaign-status is-${campaign.status}`}>{campaign.status}</span> · Revision {campaign.revision}{dirty?' · Unsaved changes':''}</p></div><div className="campaign-actions"><button className="campaign-secondary" disabled={busy} onClick={()=>void perform('refresh')}>Refresh results</button><button className="campaign-secondary" disabled={busy} onClick={()=>void perform('duplicate')}>Duplicate</button>{['scheduled','queued'].includes(campaign.status)?<button className="campaign-secondary campaign-danger" disabled={busy} onClick={()=>{setConfirmed(false);setModal('cancel');}}>Cancel campaign</button>:null}</div></div>
    {error?<p role="alert" className="admin-error">{error}</p>:null}{campaign.lastError&&!error?<p role="alert" className="admin-error">{campaign.lastError}</p>:null}{notice?<p role="status" className="admin-success">{notice}</p>:null}
    {campaign.scheduledAt?<p className="campaign-scheduled">Scheduled for {campaignDate(campaign.scheduledAt,campaign.timeZone)} · {campaign.timeZone}. Resend manages delivery.</p>:null}
    <div className="campaign-editor-layout">
      <section className="admin-panel campaign-setup"><h2>Campaign details</h2><fieldset disabled={!editable || busy} className="campaign-fieldset">
        <label className="campaign-field">Campaign name<input value={content.name} onChange={e=>update('name',e.target.value)} maxLength={150}/></label>
        <label className="campaign-field">Subject<input value={content.subject} onChange={e=>update('subject',e.target.value)} maxLength={200}/></label>
        <label className="campaign-field">Inbox preview text<input value={content.previewText} onChange={e=>update('previewText',e.target.value)} maxLength={300}/></label>
        <div className="campaign-field-pair"><label className="campaign-field">From<input value={content.from} onChange={e=>update('from',e.target.value)} placeholder="3D Box Studio <updates@3dboxstudio.com>"/></label><label className="campaign-field">Reply to<input type="email" value={content.replyTo} onChange={e=>update('replyTo',e.target.value)} placeholder="Optional"/></label></div>
        <label className="campaign-field">Recipient segment<select value={content.segmentId} onChange={e=>update('segmentId',e.target.value)}><option value="">Choose a segment</option>{segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}{content.segmentId&&!segments.some(s=>s.id===content.segmentId)?<option value={content.segmentId}>{content.segmentId}</option>:null}</select></label>
        <label className="campaign-field">Sender postal address<textarea rows={2} value={content.postalAddress} onChange={e=>update('postalAddress',e.target.value)} maxLength={500} placeholder="Shown in the email footer"/></label>
        <details className="campaign-source"><summary>Edit email HTML</summary><p className="admin-muted">Use {'{{{contact.first_name|there}}}'} for a name and {'{{{RESEND_UNSUBSCRIBE_URL}}}'} for the unsubscribe link.</p><textarea aria-label="Email HTML" rows={16} spellCheck={false} value={content.html} onChange={e=>update('html',e.target.value)}/></details>
        <details className="campaign-source"><summary>Edit plain-text email</summary><textarea aria-label="Plain-text email" rows={10} value={content.text} onChange={e=>update('text',e.target.value)}/></details>
      </fieldset>{editable?<button className="admin-btn" disabled={busy || !dirty} onClick={()=>void perform('save',{content})}>Save changes</button>:<p className="admin-muted">Duplicate this campaign to create a new editable draft.</p>}
      </section>
      <section className="admin-panel campaign-preview-panel"><div className="admin-panel-header"><h2>Email preview</h2><span className="admin-muted">Sample personalization</span></div><iframe title="Campaign email preview" className="campaign-preview" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html}/><details className="campaign-text-preview"><summary>Plain-text preview</summary><pre>{preview.text}</pre></details></section>
    </div>
    {editable?<div className="campaign-editor-layout campaign-send-layout"><section className="admin-panel campaign-setup"><h2>1. Send a test</h2><p className="admin-muted">Test the saved revision in your inbox. This sends only to the address below.</p><label className="campaign-field">Test email address<input type="email" value={recipient} onChange={e=>{setRecipient(e.target.value);setTestRequestId('');}} placeholder="you@example.com"/></label><button className="admin-btn" disabled={busy || dirty || !recipient} onClick={()=>void test()}>Send test email</button>{campaign.testedAt?<p className="campaign-caption">Revision {campaign.testedRevision} accepted for {campaign.testRecipient} at {campaignDate(campaign.testedAt)} (Toronto). {campaign.testedRevision!==campaign.revision?'Send a new test after your edits.':''}</p>:null}</section><section className="admin-panel campaign-setup"><h2>2. Schedule campaign</h2><div className="campaign-field-pair"><label className="campaign-field">Send date and time<input type="datetime-local" value={wallTime} onChange={e=>setWallTime(e.target.value)}/></label><label className="campaign-field">Time zone<input value={timeZone} onChange={e=>setTimeZone(e.target.value)} list="campaign-time-zones"/><datalist id="campaign-time-zones"><option value="America/Toronto"/><option value="UTC"/><option value="Asia/Dubai"/><option value="Europe/London"/></datalist></label></div><p className="campaign-caption">{scheduleDescription}</p><button className="admin-btn" disabled={busy || dirty || campaign.testedRevision!==campaign.revision || !validSchedule} onClick={()=>void prepareReview()}>Review and schedule</button>{!webhookReady?<p className="campaign-caption">Connect webhooks in Sending setup before scheduling.</p>:null}{dirty?<p className="campaign-caption">Save changes before testing or scheduling.</p>:null}</section></div>:null}
    <section className="campaign-results"><h2>Campaign results</h2><CampaignMetricCards metrics={campaign.metrics}/><div className="campaign-rate-row">{[['Delivery rate','delivered','sent'],['Open rate','unique_opened','delivered'],['Click rate','unique_clicked','delivered'],['Click-to-open rate','unique_clicked','unique_opened']].map(([label,num,den])=><span key={label}>{label}: <strong>{campaign.metrics[den] ? `${(100*(campaign.metrics[num]||0)/campaign.metrics[den]).toFixed(1)}%` : '—'}</strong></span>)}</div><p className="campaign-caption">{campaign.metricsAt?`Resend totals refreshed ${campaignDate(campaign.metricsAt)} (Toronto).`:'Metrics will be available after sending. Refresh results to retrieve Resend totals.'} Opens can include privacy-proxy activity; security scanners can trigger clicks.</p><div className="campaign-rate-row">{['opened','clicked','suppressed','failed','delivery_delayed'].map(key=><span key={key}>{METRIC_LABELS[key]}: {campaign.metrics[key] ?? '—'}</span>)}</div>
      {trend.length?<details><summary>Daily activity ({campaign.timeZone})</summary><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Delivered</th><th>Unique opens</th><th>Unique clicks</th></tr></thead><tbody>{trend.map((r,i)=><tr key={i}><td>{String(r.period || '')}</td><td>{Number(r.delivered || 0)}</td><td>{Number(r.unique_opened || 0)}</td><td>{Number(r.unique_clicked || 0)}</td></tr>)}</tbody></table></div></details>:null}
      <AdminCampaignReports id={campaign.id} broadcastId={campaign.broadcastId}/>
    </section>
    <div className="campaign-editor-layout"><section className="admin-panel campaign-setup"><div className="campaign-heading"><h2>Recent activity</h2><button className="campaign-secondary" onClick={()=>void loadActivity().catch(e=>setError(e.message))}>Refresh activity</button></div><p className="campaign-caption">Latest 50 signed webhook events, including the most recent test email.</p><ul className="campaign-activity">{activity?.events.map((e,i)=><li key={i}><strong>{e.event_type.replace('email.','')}{e.detail.test?' · test':''}</strong><span>{e.recipient}</span>{e.link?<small>{e.link}</small>:null}{e.detail.reason?<small>{e.detail.reason}</small>:null}<time>{campaignDate(e.occurred_at)}</time></li>)}{!activity?.events.length?<li>No webhook events recorded yet.</li>:null}</ul></section><section className="admin-panel campaign-setup"><h2>Campaign history</h2><ul className="campaign-activity">{activity?.audit.map((a,i)=><li key={i}><strong>{a.action.replaceAll('_',' ')}</strong><time>{campaignDate(a.created_at)}</time>{a.detail.recipient?<small>{String(a.detail.recipient)}</small>:null}{a.detail.scheduledAt?<small>{campaignDate(String(a.detail.scheduledAt),campaign.timeZone)} · {campaign.timeZone}</small>:null}</li>)}</ul></section></div>
    <dialog ref={dialog} className="campaign-dialog" onCancel={()=>setModal(null)} onClose={()=>setModal(null)} aria-labelledby="campaign-dialog-title"><div className="campaign-setup"><h2 id="campaign-dialog-title">{modal==='cancel'?'Cancel this campaign?':'Review your campaign'}</h2>{modal==='schedule'&&review?<><dl><dt>Subject</dt><dd>{campaign.subject}</dd><dt>From</dt><dd>{campaign.from}</dd><dt>Segment</dt><dd>{review.segmentName}</dd><dt>Recipients</dt><dd>{review.eligible.toLocaleString()} subscribed · {review.unsubscribed} unsubscribed (excluded)</dd><dt>When</dt><dd>{scheduleDescription}</dd><dt>Tracking</dt><dd>{review.domain.open_tracking?'Opens enabled':'Opens off'} · {review.domain.click_tracking?'Clicks enabled':'Clicks off'}{!review.domain.open_tracking||!review.domain.click_tracking?<button className="campaign-secondary" disabled={busy} onClick={()=>void tracking()}>Enable tracking</button>:null}</dd><dt>Tracking scope</dt><dd>Applies to mail sent from this domain.</dd><dt>Sender domain</dt><dd>{review.domain.name} · {review.domain.status}</dd><dt>Webhooks</dt><dd>{review.webhookReady?'Connected':'Setup required'}</dd></dl><details><summary>Current Resend plan usage</summary><CampaignUsage usage={review.usage}/></details><p className="campaign-caption">Resend determines eligible recipients when delivery starts. Keep this segment unchanged until sending completes. Unsubscribes are handled by Resend.</p><label className="campaign-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I checked the test email in my inbox and approve this content, recipient segment and send time.</label></>:<><p>Resend will stop the scheduled or queued broadcast. Emails already sent cannot be recalled.</p><label className="campaign-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Cancel this campaign.</label></>}{error?<p className="admin-error" role="alert">{error}</p>:null}<div className="campaign-actions"><button className="campaign-secondary" disabled={busy} onClick={()=>setModal(null)}>Back</button><button className="admin-btn" disabled={busy || !confirmed || (modal==='schedule'&&(!review?.webhookReady || !review?.domain.open_tracking || !review?.domain.click_tracking || review.domain.status!=='verified'))} onClick={()=>modal==='schedule'?void schedule():void perform('cancel').then(result=>{if(result)setModal(null);})}>{busy?'Working…':modal==='schedule'?'Schedule campaign':'Cancel campaign'}</button></div></div></dialog>
  </>;
}
