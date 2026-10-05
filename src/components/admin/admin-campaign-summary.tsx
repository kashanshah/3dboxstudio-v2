'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { campaignApi } from './campaign-api';

export function AdminCampaignSummary() {
  const [summary,setSummary]=useState<{total:number;totals:Record<string,number|string|null>}|null>(null);
  const [error,setError]=useState('');
  useEffect(()=>{
    let alive=true, refreshing=false;
    const refresh=async()=>{if(refreshing)return;refreshing=true;try{const value=await campaignApi<{total:number;totals:Record<string,number|string|null>}>('',{action:'refresh-overview'});if(alive){setSummary(value);setError('');}}catch(e){if(alive)setError((e as Error).message);}finally{refreshing=false;}};
    void refresh();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60_000);
    return()=>{alive=false;clearInterval(timer);};
  },[]);
  return <section className="admin-panel"><div className="admin-panel-header"><h2>Email campaigns</h2><Link href="/admin/campaigns" className="admin-link">Manage campaigns →</Link></div><div className="admin-panel-body">{error?<p className="admin-muted">Campaign summary unavailable. Open campaigns to check setup.</p>:summary?<><div className="admin-stat-grid">{[['Campaigns',summary.total],['Delivered',summary.totals.delivered],['Unique opens',summary.totals.unique_opened],['Unique clicks',summary.totals.unique_clicked],['Bounces',summary.totals.bounced],['Unsubscribed',summary.totals.unsubscribed]].map(([label,value])=><div className="admin-stat" key={String(label)}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></div>)}</div><p className="admin-muted">Results refresh every minute while this dashboard is visible (most recent 100 broadcasts). Open a campaign for recipient reports, clicked links and live activity.</p></>:<p className="admin-muted">Loading campaign summary…</p>}</div></section>;
}
