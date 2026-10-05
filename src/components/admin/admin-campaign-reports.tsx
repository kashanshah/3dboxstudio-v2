'use client';
import { useEffect, useState } from 'react';
import { CAMPAIGN_EVENTS } from '@/lib/email-campaigns';
import { campaignApi } from './campaign-api';

type ReportRow = {id:string;email?:string;count?:number;bounce_type?:string;url?:string;clicks?:number;unique_clicks?:number;clicked_links?:{url:string;clicks:number}[]};
type Report = {data:ReportRow[];has_more:boolean};
export function AdminCampaignReports({id,broadcastId}:{id:string;broadcastId:string|null}) {
  const [type,setType]=useState('delivered');
  const [filter,setFilter]=useState('');
  const [search,setSearch]=useState('');
  const [cursors,setCursors]=useState<string[]>(['']);
  const [report,setReport]=useState<Report|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [version,setVersion]=useState(0);
  const cursor=cursors.at(-1)||'';
  useEffect(()=>{
    if(!broadcastId)return;
    let alive=true;
    const query=new URLSearchParams({view:type==='links'?'links':'recipients',id,type,email:search,after:cursor});
    campaignApi<Report>(`?${query}`).then(result=>{if(alive){setReport(result);setLoading(false);setError('');}}).catch(e=>{if(alive){setError(e.message);setLoading(false);}});
    return()=>{alive=false;};
  },[id,broadcastId,type,search,cursor,version]);
  useEffect(()=>{if(!broadcastId)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')setVersion(v=>v+1);},60_000);return()=>clearInterval(timer);},[broadcastId]);
  if(!broadcastId)return <p className="admin-muted">Recipient and clicked-link reports become available after a broadcast is created.</p>;
  function changeType(value:string) {setType(value);setCursors(['']);setReport(null);setLoading(true);}
  function exportPage() {
    const cell=(value:unknown)=>{const text=String(value ?? '');return `"${(/^[=+@\-\t\r]/.test(text)?`'${text}`:text).replaceAll('"','""')}"`;};
    const lines=[type==='links'?'URL,Clicks,Unique clicks':'Email,Events,Bounce type',...(report?.data||[]).map(row=>(type==='links'?[row.url,row.clicks,row.unique_clicks]:[row.email,row.count,row.bounce_type]).map(cell).join(','))];
    const url=URL.createObjectURL(new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`campaign-${type}-page.csv`;link.click();URL.revokeObjectURL(url);
  }
  return <section className="admin-panel campaign-report"><div className="admin-panel-header"><h3>Recipient &amp; link reports</h3><button className="campaign-secondary" onClick={()=>setVersion(v=>v+1)}>Refresh report</button><button className="campaign-secondary" disabled={!report?.data.length} onClick={exportPage}>Export this page</button></div><div className="campaign-actions"><label className="campaign-field">Report<select value={type} onChange={e=>changeType(e.target.value)}>{CAMPAIGN_EVENTS.map(event=><option key={event} value={event}>{event[0].toUpperCase()+event.slice(1)}</option>)}<option value="links">Clicked links</option></select></label>{type!=='links'?<form className="campaign-actions" onSubmit={e=>{e.preventDefault();setSearch(filter);setVersion(v=>v+1);setCursors(['']);setReport(null);setLoading(true);}}><input aria-label="Filter recipients by email" placeholder="Search email" value={filter} onChange={e=>setFilter(e.target.value)}/><button className="campaign-secondary" type="submit">Search</button></form>:null}</div>{error?<p role="alert" className="admin-error">{error}</p>:null}<div className="admin-table-wrap"><table className="admin-table"><thead>{type==='links'?<tr><th>Link</th><th>Total clicks</th><th>Unique clicks</th></tr>:<tr><th>Recipient</th><th>Events</th><th>Details</th></tr>}</thead><tbody>{report?.data.map(row=><tr key={row.id}><td>{row.email||row.url}</td><td>{type==='links'?row.clicks:row.count ?? '—'}</td><td>{type==='links'?row.unique_clicks:row.bounce_type || row.clicked_links?.map(link=><div key={link.url}>{link.url} ({link.clicks})</div>) || '—'}</td></tr>)}{!report?.data.length?<tr><td colSpan={3}>{loading?'Loading report…':'No matching activity yet.'}</td></tr>:null}</tbody></table></div><div className="campaign-actions"><button className="campaign-secondary" disabled={cursors.length<2 || loading} onClick={()=>{setCursors(c=>c.slice(0,-1));setReport(null);setLoading(true);}}>Previous</button><span>Page {cursors.length}</span><button className="campaign-secondary" disabled={!report?.has_more || loading} onClick={()=>{const next=report?.data.at(-1)?.id;if(next){setCursors(c=>[...c,next]);setReport(null);setLoading(true);}}}>Next</button></div></section>;
}
