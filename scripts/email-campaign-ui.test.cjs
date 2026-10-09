/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {JSDOM}=require('jsdom'),React=require('react');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://example.com/admin/campaigns'});
for(const name of ['window','document','HTMLElement','HTMLDialogElement','Event','MutationObserver'])global[name]=dom.window[name];
Object.defineProperty(global,'navigator',{value:dom.window.navigator,configurable:true});
global.IS_REACT_ACT_ENVIRONMENT=true;
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){if(this.hasAttribute('open')){this.removeAttribute('open');this.dispatchEvent(new Event('close'));}};
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
const transpile=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
require.extensions['.ts']=transpile;require.extensions['.tsx']=transpile;
const {render,screen,fireEvent,waitFor,cleanup,within}=require('@testing-library/react');
const {AdminCampaignEditor}=require('../src/components/admin/admin-campaign-editor.tsx');
const {AdminCampaignSegments}=require('../src/components/admin/admin-campaign-segments.tsx');
const {AdminCampaignReports}=require('../src/components/admin/admin-campaign-reports.tsx');
const {launchCampaignDefaults}=require('../src/lib/email-campaigns.ts');
const {randomUUID}=require('node:crypto');
const segmentId='78261eea-8f8b-4381-83c6-79fa7120f1cf',segments=[{id:segmentId,name:'Launch users'}];
let campaign,calls=[],reportCalls=0;
const initial=()=>({...launchCampaignDefaults('Studio <updates@example.com>'),postalAddress:'123 Example Street, Toronto',segmentId,id:randomUUID(),revision:1,status:'draft',broadcastId:null,scheduledAt:null,timeZone:'America/Toronto',testedRevision:null,testEmailId:null,testRecipient:null,testedAt:null,metrics:{},metricsAt:null,lastError:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),busy:false});
test.beforeEach(()=>{
 calls=[];reportCalls=0;campaign=initial();
 global.fetch=async(url,options={})=>{
  const query=new URL(url,'https://example.com').searchParams,body=options.body?JSON.parse(options.body):null;calls.push({query,body});
  if(!body){
   if(query.get('view')==='detail')return Response.json({campaign,events:[],audit:[],recorded:[]});
   if(query.get('view')==='review')return Response.json({revision:campaign.revision,eligible:750,unsubscribed:8,segmentName:'Launch users',fingerprint:'a'.repeat(64),domain:{id:segmentId,name:'example.com',status:'verified',open_tracking:true,click_tracking:true},usage:{contacts:{used:758,limit:1000}},webhookReady:true});
   if(query.get('view')==='candidates')return Response.json({count:750,sample:[{email:'alex@example.com'}]});
   if(query.get('view')==='contacts')return Response.json({data:[{id:'contact',email:'alex@example.com',unsubscribed:true}],has_more:false});
   if(query.get('view')==='recipients'){reportCalls++;return Response.json({data:[{id:`cursor-${reportCalls}`,email:query.get('after')?'next@example.com':'alex@example.com',count:2}],has_more:!query.get('after')});}
   if(query.get('view')==='links')return Response.json({data:[{id:'link',url:'https://example.com/studio',clicks:12,unique_clicks:8}],has_more:false});
  }
  if(body?.action==='save')campaign={...campaign,...body.content,revision:campaign.revision+1};
  if(body?.action==='test')campaign={...campaign,testedRevision:campaign.revision,testedAt:new Date().toISOString(),testRecipient:body.recipient,testEmailId:randomUUID()};
  if(body?.action==='schedule')campaign={...campaign,status:'scheduled',scheduledAt:new Date(Date.now()+86400000).toISOString(),timeZone:body.timeZone,broadcastId:randomUUID()};
  if(body?.action==='cancel')campaign={...campaign,status:'canceled'};
  if(body?.action==='start-import')return Response.json({job:{id:randomUUID(),segmentId,total:750,processed:0,skipped:0,status:'pending',error:null}});
  if(body?.action==='import-chunk')return Response.json({job:{id:body.jobId,segmentId,total:750,processed:750,skipped:8,status:'complete',error:null}});
  return Response.json({campaign});
 };
});
test.afterEach(()=>cleanup());
test.after(()=>dom.window.close());

test('real campaign editor enforces save → test → explicit scheduling review and shows scheduled status',async()=>{
 render(React.createElement(AdminCampaignEditor,{initial:campaign,segments,webhookReady:true,onBack:()=>{},onChanged:()=>{}}));
 assert.equal(screen.getByRole('button',{name:'Review and schedule'}).disabled,true);
 assert.equal(screen.getByTitle('Campaign email preview').getAttribute('sandbox'),'');
 fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'Your new packaging Studio is ready'}});
 fireEvent.change(screen.getByLabelText('Test email address'),{target:{value:'tester@example.com'}});
 assert.equal(screen.getByRole('button',{name:'Send test email'}).disabled,true);
 fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
 await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Send test email'}).disabled,false));
 fireEvent.click(screen.getByRole('button',{name:'Send test email'}));
 await screen.findByText(/Test accepted by Resend/);
 assert.equal(calls.find(c=>c.body?.action==='test').body.recipient,'tester@example.com');
 fireEvent.change(screen.getByLabelText('Time zone'),{target:{value:'UTC'}});
 fireEvent.change(screen.getByLabelText('Send date and time'),{target:{value:new Date(Date.now()+2*86400000).toISOString().slice(0,16)}});
 fireEvent.click(screen.getByRole('button',{name:'Review and schedule'}));
 const dialog=await screen.findByRole('dialog');
 assert.match(dialog.textContent,/750 subscribed/);assert.match(dialog.textContent,/8 unsubscribed/);
 const schedule=within(dialog).getByRole('button',{name:'Schedule campaign'});assert.equal(schedule.disabled,true);
 fireEvent.click(within(dialog).getByRole('checkbox'));
 fireEvent.click(schedule);
 await screen.findByText('Campaign scheduled in Resend.');
 assert.equal(calls.filter(c=>c.body?.action==='schedule').length,1);
 assert.equal(calls.find(c=>c.body?.action==='schedule').body.confirmed,true);
 assert.equal(screen.getByLabelText('Subject').closest('fieldset').disabled,true);
 // The review dialog closes asynchronously after scheduling; until it does it
 // also renders a "Cancel campaign" action, so wait for the page button alone.
 await waitFor(()=>assert.equal(screen.queryByRole('dialog'),null));
 fireEvent.click(screen.getByRole('button',{name:'Cancel campaign'}));
 const cancelDialog=await screen.findByRole('dialog');fireEvent.click(within(cancelDialog).getByRole('checkbox'));fireEvent.click(within(cancelDialog).getByRole('button',{name:'Cancel campaign'}));
 await waitFor(()=>assert.equal(campaign.status,'canceled'));
});
test('segment import requires explicit eligibility and reports completed progress with unsubscribe exclusions',async()=>{
 render(React.createElement(AdminCampaignSegments,{segments,error:'',jobs:[],onRefresh:async()=>{}}));
 await screen.findByText(/matching email addresses/);
 fireEvent.change(screen.getByLabelText('Recipient segment'),{target:{value:segmentId}});
 const importButton=screen.getByRole('button',{name:'Import to selected segment'});assert.equal(importButton.disabled,true);
 fireEvent.click(screen.getByRole('checkbox'));assert.equal(importButton.disabled,false);
 fireEvent.click(importButton);
 await screen.findByText(/750 \/ 750 processed/);
 assert.match(screen.getByRole('status').textContent,/8 unsubscribed contacts skipped/);
 assert.equal(calls.find(c=>c.body?.action==='start-import').body.confirmed,true);
 fireEvent.click(screen.getByRole('button',{name:'View contacts'}));
 await screen.findByText('Unsubscribed');
});
test('recipient reports support opaque cursors, repeated email searches, and clicked-link reports',async()=>{
 render(React.createElement(AdminCampaignReports,{id:campaign.id,broadcastId:randomUUID()}));
 await screen.findByText('alex@example.com');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 await screen.findByText('next@example.com');assert.ok(calls.some(c=>c.query.get('after')==='cursor-1'));
 fireEvent.change(screen.getByLabelText('Filter recipients by email'),{target:{value:'alex'}});
 fireEvent.click(screen.getByRole('button',{name:'Search'}));await screen.findByText('alex@example.com');
 const previous=reportCalls;fireEvent.click(screen.getByRole('button',{name:'Search'}));
 await waitFor(()=>assert.ok(reportCalls>previous));
 fireEvent.change(screen.getByLabelText('Report'),{target:{value:'links'}});
 await screen.findByText('https://example.com/studio');assert.ok(screen.getByText('Unique clicks'));
});
