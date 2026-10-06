'use client';
import { useEffect, useRef, useState } from 'react';
import type { ImportJob, Segment } from '@/lib/email-campaigns';
import { campaignApi } from './campaign-api';

type ContactPage = {data:{id:string;email:string;first_name?:string;unsubscribed:boolean}[];has_more:boolean};
export function AdminCampaignSegments({segments,error:initialError,jobs,onRefresh}:{segments:Segment[];error:string;jobs:ImportJob[];onRefresh:()=>Promise<void>}) {
  const [name,setName]=useState('');
  const [segmentId,setSegmentId]=useState('');
  const [filter,setFilter]=useState('verified');
  const [eligible,setEligible]=useState(false);
  const [candidates,setCandidates]=useState<{count:number;sample:{email:string}[]}|null>(null);
  const [contacts,setContacts]=useState<ContactPage|null>(null);
  const [job,setJob]=useState<ImportJob|null>(null);
  const [running,setRunning]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const stop=useRef(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;stop.current=true;};},[]);
  useEffect(()=>{let alive=true;campaignApi<{count:number;sample:{email:string}[]}>(`?view=candidates&filter=${filter}`).then(v=>alive&&setCandidates(v)).catch(e=>alive&&setError(e.message));return()=>{alive=false;};},[filter]);
  async function create() {setBusy(true);setError('');try {const result=await campaignApi<{segment:Segment}>('',{action:'create-segment',name});setName('');setSegmentId(result.segment.id);await onRefresh();setNotice('Segment created in Resend.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function viewContacts(id:string,after='') {setBusy(true);setError('');try{setContacts(await campaignApi<ContactPage>(`?view=contacts&segmentId=${id}&after=${encodeURIComponent(after)}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function process(current:ImportJob) {
    stop.current=false;setRunning(true);setError('');setJob(current);
    try { while(!stop.current && current.status!=='complete') {const result=await campaignApi<{job:ImportJob}>('',{action:'import-chunk',jobId:current.id});current=result.job;if(!mounted.current)break;setJob(current);if(current.status==='failed'){setError(current.error || 'Import paused.');break;}} if(mounted.current)await onRefresh(); }
    catch(e){if(mounted.current)setError((e as Error).message);}finally{if(mounted.current)setRunning(false);}
  }
  async function exportCsv() {
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/admin/campaigns?view=export-contacts&filter=${filter}`,{cache:'no-store'});
      if(!response.ok){const result=await response.json().catch(()=>null);throw new Error(result?.error || 'Could not export contacts.');}
      const url=URL.createObjectURL(await response.blob());
      const link=document.createElement('a');link.href=url;link.download=`resend-contacts-${filter}-${new Date().toISOString().slice(0,10)}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('CSV downloaded. Upload it in Resend Contacts, check the column mapping and choose your segment.');
    } catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function stopImport(current:ImportJob) {setBusy(true);setError('');try{const result=await campaignApi<{job:ImportJob}>('',{action:'stop-import',jobId:current.id});setJob(result.job);await onRefresh();setNotice('Import stopped. Contacts already added remain in Resend. You can now finish with a CSV import.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function start() {setBusy(true);setError('');try {const result=await campaignApi<{job:ImportJob}>('',{action:'start-import',segmentId,filter,confirmed:eligible});setJob(result.job);await process(result.job);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="campaign-segment-layout">
    <section className="admin-panel campaign-setup"><h2>Resend segments</h2>{initialError?<p role="alert" className="admin-error">{initialError}</p>:null}<div className="campaign-actions"><input aria-label="New segment name" placeholder="e.g. V2 launch users" value={name} onChange={e=>setName(e.target.value)} maxLength={100}/><button className="admin-btn" disabled={busy || running || !name.trim()} onClick={()=>void create()}>Create segment</button></div><label className="campaign-field">Recipient segment<select value={segmentId} onChange={e=>{setSegmentId(e.target.value);setContacts(null);setEligible(false);}}><option value="">Choose a segment</option>{segments.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><button className="campaign-secondary" disabled={!segmentId || busy} onClick={()=>void viewContacts(segmentId)}>View contacts</button>
    {contacts?<><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Email</th><th>Subscription</th></tr></thead><tbody>{contacts.data.map(c=><tr key={c.id}><td>{c.email}</td><td>{c.unsubscribed?'Unsubscribed':'Subscribed'}</td></tr>)}{!contacts.data.length?<tr><td colSpan={2}>This segment is empty.</td></tr>:null}</tbody></table></div><button className="campaign-secondary" disabled={!contacts.has_more || busy} onClick={()=>void viewContacts(segmentId,contacts.data.at(-1)?.id)}>Next contacts</button></>:null}
    </section>
    <section className="admin-panel campaign-setup"><h2>Import registered users</h2><p className="admin-muted">Add users to a segment. Existing unsubscribes stay unsubscribed. Imports can be resumed after a pause or closed tab.</p><label className="campaign-field">Users to include<select disabled={running || busy} value={filter} onChange={e=>{setFilter(e.target.value);setEligible(false);}}><option value="verified">Verified users</option><option value="migrated">Migrated users</option><option value="all">All registered users</option></select></label>{candidates?<><p><strong>{candidates.count.toLocaleString()}</strong> matching email addresses</p><details><summary>Preview recipients</summary><ul>{candidates.sample.map(r=><li key={r.email}>{r.email}</li>)}</ul></details></>:null}<label className="campaign-check"><input type="checkbox" checked={eligible} onChange={e=>setEligible(e.target.checked)}/>I have checked that these contacts are eligible to receive product updates.</label><button className="admin-btn" disabled={!segmentId || !eligible || busy || running} onClick={()=>void start()}>Import to selected segment</button> <button className="campaign-secondary" disabled={!eligible || busy || running} onClick={()=>void exportCsv()}>Export Resend CSV</button><p className="admin-muted">Export all matching users in one download, then import the CSV in Resend Contacts and choose your segment. Includes email, first_name and last_name. Subscription status is omitted; preserve existing unsubscribes in Resend. If switching from an unfinished admin import, pause it, then stop it below before scheduling.</p>
    {job?<div className="campaign-import-progress" role="status"><progress value={job.processed} max={job.total}/><p>{job.processed} / {job.total} processed · {job.skipped} unsubscribed contacts skipped · {job.status}</p>{running?<button className="campaign-secondary" onClick={()=>{stop.current=true;setNotice('Pausing after the current batch finishes.');}}>Pause after this batch</button>:!['complete','canceled'].includes(job.status)?<button className="campaign-secondary" disabled={busy} onClick={()=>void process(job)}>Resume import</button>:null}{!running && !['complete','canceled'].includes(job.status)?<button className="campaign-secondary" disabled={busy} onClick={()=>void stopImport(job)}>Stop import</button>:null}</div>:null}
    <h3>Recent imports</h3>{jobs.map(j=><div className="campaign-import-row" key={j.id}><span>{segments.find(s=>s.id===j.segmentId)?.name || j.segmentId}<small>{j.processed}/{j.total} · {j.status}{j.error?` · ${j.error}`:''}</small></span>{!['complete','canceled'].includes(j.status)?<span><button className="campaign-secondary" disabled={running || busy} onClick={()=>void process(j)}>Resume</button> <button className="campaign-secondary" disabled={running || busy} onClick={()=>void stopImport(j)}>Stop import</button></span>:null}</div>)}
    </section>
    {error?<p role="alert" className="admin-error">{error}</p>:null}{notice?<p role="status" className="admin-success">{notice}</p>:null}
  </div>;
}
