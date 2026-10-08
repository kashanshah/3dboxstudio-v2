'use client';
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { DashboardData, DashboardPeriod, CountSeries, Breakdown } from '@/server/admin/dashboard';
import { AdminCampaignSummary } from '@/components/admin/admin-campaign-summary';
function bytes(value:number){return value>=1073741824?`${(value/1073741824).toFixed(2)} GB`:value>=1048576?`${(value/1048576).toFixed(1)} MB`:`${(value/1024).toFixed(1)} KB`;}
function money(amount:number,currency:string){try{return new Intl.NumberFormat('en-US',{style:'currency',currency,maximumFractionDigits:2}).format(amount);}catch{return `${amount.toFixed(2)} ${currency}`;}}
function Chart({title,data,spine,secondary,showTip,hideTip}:{title:string;data:CountSeries[];spine:DashboardData['spine'];secondary?:{label:string;data:CountSeries[]};showTip:(id:string,target:HTMLElement,label:string)=>void;hideTip:(id:string)=>void}){
 const values=spine.map(day=>Number(data.find(row=>row.date===day.date)?.count??0)),max=Math.max(1,...values);
 const show=(target:HTMLElement,label:string)=>showTip(title,target,label);
 return <section className="admin-panel"><div className="admin-panel-header"><h2>{title}</h2></div><div className="admin-panel-body">
 {secondary&&<p className="admin-muted">Blue: total · Green: {secondary.label}</p>}
 <div className="admin-dashboard-chart" aria-label={title} onMouseLeave={()=>hideTip(title)}>{spine.map((day,i)=>{const sub=Number(secondary?.data.find(row=>row.date===day.date)?.count??0);const label=`${day.label}: ${values[i]}${secondary?`, ${secondary.label}: ${sub}`:''}`;return <div key={day.date} className="admin-chart-column" tabIndex={0} aria-label={label} onMouseEnter={event=>show(event.currentTarget,label)} onFocus={event=>show(event.currentTarget,label)} onBlur={()=>hideTip(title)}><span style={{height:`${values[i]/max*100}%`}}/>{secondary&&<i style={{height:`${sub/max*100}%`}}/>}</div>;})}</div>
 <div className="admin-chart-dates"><span>{spine[0]?.label}</span><span>{spine.at(-1)?.label}</span></div>
 {!values.some(Boolean)&&<p className="admin-muted">No activity in this period.</p>}
 </div></section>;
}
function BreakdownPanel({title,rows}:{title:string;rows:Breakdown[]}){return <section className="admin-panel"><div className="admin-panel-header"><h2>{title} (30d)</h2></div><div className="admin-panel-body">{rows.length?<ul className="admin-breakdown">{rows.map(row=><li key={row.label}><span>{row.label}</span><strong>{Number(row.count).toLocaleString('en-US')}</strong></li>)}</ul>:<p className="admin-muted">No signups in the last 30 days.</p>}</div></section>;}
function AwsCostPanel({cost,storage}:{cost:DashboardData['awsCost'];storage:DashboardData['storage']}){
 const gb=storage.available?storage.bytes/1073741824:0;
 const storageEstimate=gb*0.023;
 if(!cost.available)return <section className="admin-panel"><div className="admin-panel-header"><h2>AWS estimated cost</h2></div><div className="admin-panel-body">{storage.available?<div className="admin-stat-grid"><div className="admin-stat"><span>Estimated S3 storage</span><strong>{money(storageEstimate,'USD')}</strong><small>{gb.toFixed(2)} GB in {storage.prefix}{storage.partial?' (partial inventory)':''}</small></div></div>:null}<p className="admin-muted">{cost.message} {storage.available?'Until then, this figure uses the published S3 Standard rate of $0.023 per GB-month and excludes requests, data transfer, and every other AWS service.':''}</p></div></section>;
 const estimated=cost.monthToDate+(cost.forecast??0);
 return <section className="admin-panel"><div className="admin-panel-header"><h2>AWS estimated cost</h2></div><div className="admin-panel-body"><div className="admin-stat-grid"><div className="admin-stat"><span>Estimated this month</span><strong>{money(estimated,cost.currency)}</strong><small>{money(cost.monthToDate,cost.currency)} through yesterday{cost.forecast!=null?` · ${money(cost.forecast,cost.currency)} forecast from today`:''}</small></div>{cost.lastMonth!=null&&<div className="admin-stat"><span>Last month</span><strong>{money(cost.lastMonth,cost.currency)}</strong><small>Unblended account total</small></div>}</div>{cost.services.length?<ul className="admin-breakdown admin-cost-services">{cost.services.map(service=><li key={service.name}><span>{service.name}</span><strong>{money(service.amount,cost.currency)}</strong></li>)}</ul>:<p className="admin-muted">No service charges recorded for this month yet.</p>}<p className="admin-muted">Account-wide Cost Explorer totals. This month is an estimate until AWS closes the bill, and it usually lags by about a day.</p></div></section>;
}
export function AdminDashboard({data,period,includeBlank}:{data:DashboardData;period:DashboardPeriod;includeBlank:boolean}){
 const router=useRouter(),m=data.metrics;
 const tipRef=useRef<HTMLDivElement>(null);
 const [tip,setTip]=useState<{id:string;label:string;x:number;y:number}|null>(null);
 useLayoutEffect(()=>{
  const node=tipRef.current;
  if(!tip||!node)return;
  const {width,height}=node.getBoundingClientRect();
  const margin=8;
  const left=Math.max(margin,Math.min(tip.x-width/2,window.innerWidth-width-margin));
  node.style.left=`${left}px`;
  node.style.top=`${Math.max(margin,tip.y-height-8)}px`;
  node.style.visibility='visible';
 },[tip]);
 const showTip=(id:string,target:HTMLElement,label:string)=>{const rect=target.getBoundingClientRect();setTip({id,label,x:rect.left+rect.width/2,y:rect.top});};
 const hideTip=(id:string)=>setTip(current=>current?.id===id?null:current);
 const change=(nextPeriod:string,blank:boolean)=>router.push(`/admin?period=${nextPeriod}${blank?'&includeBlank=true':''}`);
 const stats=[['Total users',m.users.total,`+${m.users.last7} last 7 days`],['Verified users',m.users.verified,`${m.users.total?Math.round(m.users.verified/m.users.total*100):0}% of users`],['Total designs',m.designs.total,`+${m.designs.last7} last 7 days`],['Total views',m.designs.views,'Across synced shared designs'],['Signups (30d)',m.users.last30,`${m.designs.last30} designs created`],['Daily average signup',m.users.last30/30,'Last 30 days'],['Daily designs created',m.designs.last30/30,'Last 30 days'],['Contact submissions',m.contacts.total,`${m.contacts.new} new · ${m.contacts.last7} last 7 days`]] as const;
 return <>
 <div className="admin-dashboard-controls"><label>Chart period<select value={period} onChange={event=>change(event.target.value,includeBlank)}>{['daily','weekly','monthly','quarterly','yearly'].map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}</select></label><label><input type="checkbox" checked={includeBlank} onChange={event=>change(period,event.target.checked)}/> Include designs without uploaded artwork</label><button className="admin-btn" onClick={()=>router.refresh()}>Refresh</button></div>
 <p className="admin-muted">{includeBlank?'All designs':'Designs with at least one uploaded image'} · Charts in {data.timezone}</p>
 <div className="admin-stat-grid">{stats.map(([label,value,detail])=><div className="admin-stat" key={label}><span>{label}</span><strong>{Number(value).toLocaleString('en-US',{maximumFractionDigits:1})}</strong><small>{detail}</small></div>)}</div>
 <div className="admin-dashboard-grid"><Chart title="Signups" data={m.signups} secondary={{label:'verified',data:m.verifiedActivity}} spine={data.spine} showTip={showTip} hideTip={hideTip}/><Chart title="Designs created" data={m.designActivity} spine={data.spine} showTip={showTip} hideTip={hideTip}/><Chart title="Signup methods" data={m.signups} secondary={{label:'Google',data:m.googleActivity}} spine={data.spine} showTip={showTip} hideTip={hideTip}/><Chart title="Design images and previews" data={m.imageActivity} spine={data.spine} showTip={showTip} hideTip={hideTip}/><BreakdownPanel title="Signups by UTM source" rows={m.sources}/><BreakdownPanel title="Signups by method" rows={m.methods}/><BreakdownPanel title="First landing page" rows={m.landings}/><BreakdownPanel title="Signup page" rows={m.conversions}/></div>
 <AdminCampaignSummary/>
 <AwsCostPanel cost={data.awsCost} storage={data.storage}/>
 <section className="admin-panel"><div className="admin-panel-header"><h2>Images & storage</h2></div><div className="admin-panel-body"><div className="admin-stat-grid"><div className="admin-stat"><span>Design images</span><strong>{m.images.faces.toLocaleString('en-US')}</strong><small>{m.images.previews} preview images</small></div><div className="admin-stat"><span>Images added (30d)</span><strong>{m.images.last30.toLocaleString('en-US')}</strong><small>{m.images.last7} last 7 days · By design creation date</small></div><div className="admin-stat"><span>V2 media assets</span><strong>{m.media.count.toLocaleString('en-US')}</strong><small>{bytes(m.media.bytes)} recorded in database</small></div>{data.storage.available&&<><div className="admin-stat"><span>S3 objects {data.storage.partial?'(partial)':''}</span><strong>{data.storage.objects.toLocaleString('en-US')}</strong><small>{data.storage.last30Days} added last 30 days</small></div><div className="admin-stat"><span>S3 storage {data.storage.partial?'(partial)':''}</span><strong>{bytes(data.storage.bytes)}</strong><small>{data.storage.objects?bytes(data.storage.bytes/data.storage.objects):'0 KB'} average per object</small></div></>}</div><p className="admin-muted">{data.storage.available?`S3 inventory covers ${data.storage.prefix} only; legacy asset files have not been copied into V2 storage.`:data.storage.message}</p></div></section>
 <section className="admin-panel"><div className="admin-panel-header"><h2>Legacy sync</h2></div><div className="admin-panel-body">{data.runs.length?<ul className="admin-breakdown">{data.runs.map(run=><li key={`${run.source}-${run.completed_at}`}><span>{run.source}</span><span>Snapshot: {new Date(run.snapshot_at).toLocaleString('en-CA',{timeZone:data.timezone})}</span></li>)}</ul>:<p className="admin-muted">No completed sync yet.</p>}<p className="admin-muted">Legacy design records and asset references are preserved. Opening them in the new editor requires a separate compatibility conversion.</p></div></section>
 {tip&&createPortal(<div ref={tipRef} className="admin-chart-tooltip" style={{visibility:'hidden',left:tip.x,top:tip.y}} role="tooltip">{tip.label}</div>,document.querySelector('.admin-root')??document.body)}
 </>;
}
