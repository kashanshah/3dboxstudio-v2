'use client';
import { useCallback, useEffect, useState } from 'react';
import { launchCampaignDefaults, type Campaign, type ImportJob, type Segment } from '@/lib/email-campaigns';
import { AdminCampaignEditor } from './admin-campaign-editor';
import { AdminCampaignSegments } from './admin-campaign-segments';
import { campaignApi, campaignDate } from './campaign-api';
import { CampaignMetricCards } from './campaign-metric-cards';

export type CampaignDashboard = { campaigns: Campaign[]; total: number; jobs: ImportJob[]; totals: Record<string,number|string|null>; webhook: { ready:boolean;endpoint:string;lastReceivedAt:string|null }; defaultFrom:string };
export function AdminCampaigns() {
  const [data,setData] = useState<CampaignDashboard|null>(null);
  const [segments,setSegments] = useState<Segment[]>([]);
  const [segmentError,setSegmentError] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [page,setPage] = useState(1);
  const [tab,setTab] = useState<'campaigns'|'segments'|'setup'>('campaigns');
  const [selected,setSelected] = useState<Campaign|null>(null);
  const [notice,setNotice] = useState('');
  const load = useCallback(async()=>{ const result = await campaignApi<CampaignDashboard>(`?page=${page}`); setData(result); },[page]);
  const loadSegments = useCallback(async()=>{ try { const result = await campaignApi<{segments:Segment[]}>('?view=segments'); setSegments(result.segments); setSegmentError(''); } catch(e) { setSegmentError((e as Error).message); } },[]);
  useEffect(()=>{ let alive=true; campaignApi<CampaignDashboard>(`?page=${page}`).then(result=>{if(alive){setData(result);setError('');}}).catch(e=>alive&&setError(e.message)); return()=>{alive=false;}; },[page]);
  useEffect(()=>{
    let alive=true, refreshing=false;
    const refresh=async()=>{if(refreshing)return;refreshing=true;try{const result=await campaignApi<CampaignDashboard>('',{action:'refresh-overview',page});if(alive){setData(result);setError('');}}catch(e){if(alive)setError((e as Error).message);}finally{refreshing=false;}};
    void refresh();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60_000);
    return()=>{alive=false;clearInterval(timer);};
  },[page]);
  useEffect(()=>{ let alive=true;campaignApi<{segments:Segment[]}>('?view=segments').then(result=>{if(alive){setSegments(result.segments);setSegmentError('');}}).catch(e=>alive&&setSegmentError(e.message));return()=>{alive=false;}; },[]);
  async function create() {
    setBusy(true); setError('');
    try { const result = await campaignApi<{campaign:Campaign}>('',{ action:'create',content:launchCampaignDefaults(data?.defaultFrom || '') }); setSelected(result.campaign); await load(); }
    catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  async function setup() {
    setBusy(true);setError('');
    try { await campaignApi('',{action:'configure-webhook'}); await load();setNotice('Campaign webhooks connected. Resend will send signed events to this site.'); }
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function select(campaign:Campaign) {setBusy(true);setError('');try {const detail=await campaignApi<{campaign:Campaign}>(`?view=detail&id=${campaign.id}`);setSelected(detail.campaign);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if (selected) return <AdminCampaignEditor key={selected.id} initial={selected} segments={segments} webhookReady={data?.webhook.ready || false} onBack={()=>{setSelected(null);void load();}} onChanged={campaign=>{setSelected(campaign);void load();}} />;
  return <>
    <div className="campaign-heading"><div><h1>Email campaigns</h1><p className="admin-muted">Create, test and schedule product updates. Track results in one place.</p></div><button className="admin-btn" disabled={busy || !data?.defaultFrom} onClick={()=>void create()}>Create campaign</button></div>
    {error ? <p role="alert" className="admin-error">{error}</p> : null}
    {notice ? <p role="status" className="admin-success">{notice}</p> : null}
    <div className="campaign-tabs" aria-label="Campaign sections">{(['campaigns','segments','setup'] as const).map(item=><button key={item} aria-pressed={tab===item} onClick={()=>setTab(item)}>{item==='campaigns'?'Campaigns':item==='segments'?'Segments':'Sending setup'}</button>)}</div>
    {!data ? <p className="admin-muted">Loading campaign dashboard…</p> : tab==='campaigns' ? <>
      <CampaignMetricCards metrics={data.totals}/>
      <p className="campaign-caption">Results refresh every minute while visible (most recent 100 broadcasts). {data.totals.oldest_refresh ? `Oldest refresh: ${campaignDate(String(data.totals.oldest_refresh))} (Toronto).` : 'Open a campaign to refresh its results.'}</p>
      <div className="admin-panel"><div className="admin-panel-header"><h2>Your campaigns</h2><button className="campaign-secondary" onClick={()=>void campaignApi<CampaignDashboard>('',{action:'refresh-overview',page}).then(setData).catch(e=>setError(e.message))}>Refresh results</button></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Campaign</th><th>Status</th><th>Schedule (Toronto)</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th/></tr></thead><tbody>{data.campaigns.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small className="campaign-cell-sub">{c.subject}</small></td><td><span className={`campaign-status is-${c.status}`}>{c.status}</span>{c.lastError?<small className="campaign-cell-sub">Needs attention</small>:null}</td><td>{campaignDate(c.scheduledAt)}</td><td>{c.metrics.delivered ?? '—'}</td><td>{c.metrics.unique_opened ?? '—'}</td><td>{c.metrics.unique_clicked ?? '—'}</td><td><button className="campaign-secondary" disabled={busy} onClick={()=>void select(c)}>Open</button></td></tr>)}{!data.campaigns.length?<tr><td colSpan={7}>No campaigns yet. Create your first campaign to start.</td></tr>:null}</tbody></table></div><div className="campaign-actions"><button className="campaign-secondary" disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} · {data.total} campaigns</span><button className="campaign-secondary" disabled={page*20>=data.total} onClick={()=>setPage(page+1)}>Next</button></div></div>
    </> : tab==='segments' ? <AdminCampaignSegments segments={segments} error={segmentError} jobs={data.jobs} onRefresh={async()=>{await loadSegments();await load();}} /> : <div className="admin-panel campaign-setup"><h2>Sending setup</h2><dl><dt>Default sender</dt><dd>{data.defaultFrom || 'Configure EMAIL_FROM or EMAIL_CAMPAIGN_FROM in Vercel.'}</dd><dt>Webhooks</dt><dd>{data.webhook.ready?'Connected':'Setup required'}</dd><dt>Webhook endpoint</dt><dd><code>{data.webhook.endpoint}</code></dd><dt>Last webhook received</dt><dd>{campaignDate(data.webhook.lastReceivedAt)}</dd></dl><button className="admin-btn" disabled={busy} onClick={()=>void setup()}>{busy?'Connecting…':data.webhook.ready?'Reconnect webhooks':'Connect Resend webhooks'}</button><p className="admin-muted">Use a Resend API key with full access to contacts, segments, broadcasts, domains and webhooks. Open and click tracking can be enabled when reviewing a campaign.</p><p className="admin-muted">Broadcasts use Resend’s marketing contacts plan. Recipient counts and current usage are shown before scheduling. Scheduled sends run on Resend even when this page is closed.</p></div>}
  </>;
}
