/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const {randomUUID,randomBytes}=require('node:crypto');
const originalLoad=Module._load,originalResolve=Module._resolveFilename;
let db,authenticated=true,providerCalls=[],remoteBroadcasts=[],contacts=new Map(),failAt='',afterCreate=null;
const segmentId='78261eea-8f8b-4381-83c6-79fa7120f1cf',domainId='e169aa45-1ecf-4183-9955-b1499d5701d3';
const signingSecret=`whsec_${randomBytes(32).toString('base64')}`;
const sql=(strings,...values)=>db.query(strings.reduce((text,part,i)=>text+(i?`$${i}`:'')+part,''),values).then(result=>result.rows);
sql.query=(text,values=[])=>db.query(text,values).then(result=>result.rows);
Module._load=function(request,...args){
 if(request==='@/server/db')return {getSql:()=>sql,ensureV2Schema:async()=>{}};
 if(request==='@/server/admin/auth')return {requireAdminApi:async()=>authenticated?null:Response.json({error:'Unauthorized'},{status:401})};
 return originalLoad.call(this,request,...args);
};
Module._resolveFilename=function(request,...args){return originalResolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const model=require('../src/lib/email-campaigns.ts');
const provider=require('../src/server/email/campaign-resend.ts');
const realRequest=provider.resendCampaignRequest,realRows=provider.allResendRows;
provider.allResendRows=async route=>{
 if(route==='/domains')return [{id:domainId,name:'example.com',status:'verified'}];
 if(route==='/segments')return [{id:segmentId,name:'Launch users'}];
 if(route==='/broadcasts')return remoteBroadcasts;
 if(route==='/webhooks')return [];
 if(route===`/segments/${segmentId}/contacts`)return [...contacts.values()];
 throw Error(`Unexpected list ${route}`);
};
provider.resendCampaignRequest=async(route,method='GET',body,key)=>{
 providerCalls.push({route,method,body,key});
 if(failAt===`${method} ${route}`)throw new model.CampaignError('Unconfirmed response',502);
 if(route==='/webhooks'&&method==='POST')return {id:randomUUID(),signing_secret:signingSecret};
 if(route===`/domains/${domainId}`)return {id:domainId,name:'example.com',status:'verified',open_tracking:true,click_tracking:true};
 if(route==='/usage')return {contacts:{used:contacts.size,limit:1000},emails:{daily:{used:1,limit:100},monthly:{used:1,limit:3000}}};
 if(route===`/segments/${segmentId}`)return {id:segmentId,name:'Launch users'};
 if(route==='/emails')return {id:randomUUID()};
 if(route==='/broadcasts'&&method==='POST'){
  const remote={id:randomUUID(),name:body.name,status:'draft'};remoteBroadcasts.push(remote);
  if(afterCreate)await afterCreate(remote);
  return {id:remote.id};
 }
 if(route.startsWith('/broadcasts/')){
  const parts=route.split('/');const remote=remoteBroadcasts.find(b=>b.id===parts[2]);
  assert.ok(remote,'remote broadcast exists');
  if(parts[3]==='send'){assert.equal(remote.status,'draft');remote.status='scheduled';remote.scheduled_at=body.scheduled_at;return {id:remote.id};}
  if(parts[3]==='cancel'){remote.status='canceled';return {id:remote.id};}
  return {...remote};
 }
 if(route.startsWith('/emails/metrics')&&new URLSearchParams(route.split('?')[1]).get('dimensions')==='broadcast')return {data:remoteBroadcasts.map(b=>({broadcast_id:b.id,broadcast_name:b.name,delivered:12,unique_opened:5,unique_clicked:3}))};
 if(route.startsWith('/emails/metrics'))return {totals:{sent:10,delivered:9,unique_opened:4,unique_clicked:2,opened:7,clicked:3,bounced:1,complained:0,unsubscribed:1,suppressed:0},data:[{period:'2026-10-06',delivered:9}]};
 if(route.startsWith('/contacts/')&&method==='GET'){
  const identifier=decodeURIComponent(route.split('/')[2]);const contact=contacts.get(identifier)||[...contacts.values()].find(c=>c.id===identifier);
  if(!contact)throw new provider.ResendCampaignError('Contact not found',404);
  return {...contact};
 }
 if(route==='/contacts'&&method==='POST'){
  assert.equal(body.unsubscribed,undefined,'never override subscription status');
  if(!contacts.has(body.email))contacts.set(body.email,{id:randomUUID(),email:body.email,unsubscribed:false});
  return {id:contacts.get(body.email).id};
 }
 if(route.includes('/segments/')&&route.startsWith('/contacts/')&&method==='POST')return {id:segmentId};
 throw Error(`Unexpected provider request ${method} ${route}`);
};
const schema=require('../src/server/email/campaign-schema.ts');
const service=require('../src/server/email/campaigns.ts');
const webhook=require('../src/server/email/campaign-webhook.ts');
const route=require('../src/app/api/admin/campaigns/route.ts');
const hookRoute=require('../src/app/api/webhooks/resend/campaigns/route.ts');
const {Webhook}=require('svix');
test.before(async()=>{
 process.env.ADMIN_PASSWORD='campaign-tests-not-a-production-password';
 db=new PGlite();
 await db.exec('CREATE TABLE users(id text PRIMARY KEY,email text,name text,email_verified_at timestamptz,migrated_from text)');
 await schema.ensureCampaignSchema();
});
test.beforeEach(async()=>{
 providerCalls=[];remoteBroadcasts=[];contacts=new Map();failAt='';afterCreate=null;authenticated=true;
 await db.exec('TRUNCATE email_campaigns,email_campaign_imports,email_campaign_segment_locks,email_campaign_events,email_campaign_webhook,email_campaign_audit,users CASCADE');
 contacts.set('ada@example.com',{id:randomUUID(),email:'ada@example.com',unsubscribed:false});
 await webhook.configureCampaignWebhook();
 providerCalls=[];
});
test.after(async()=>db.close());
const content=()=>({...model.launchCampaignDefaults('Studio <updates@example.com>'),segmentId,postalAddress:'123 Test Street, Toronto ON'});
async function draft(){return service.createCampaign(content());}
async function tested(){const c=await draft();return service.testCampaign(c.id,c.revision,'tester@example.com',randomUUID());}
function futureWall(){return new Date(Date.now()+2*86400000).toISOString().slice(0,16);}
async function schedule(c){const review=await service.reviewCampaign(c.id);return service.scheduleCampaign(c.id,{revision:c.revision,fingerprint:review.fingerprint,wallTime:futureWall(),timeZone:'UTC',confirmed:true});}

test('schedule conversion honors Toronto DST and rejects ambiguous, skipped and invalid dates',()=>{
 const now=Date.parse('2026-01-01T00:00:00Z');
 assert.equal(model.campaignScheduleIso('2026-10-06T09:00','America/Toronto',now),'2026-10-06T13:00:00.000Z');
 assert.equal(model.campaignScheduleIso('2026-12-06T09:00','America/Toronto',now),'2026-12-06T14:00:00.000Z');
 for(const wall of ['2026-03-08T02:30','2026-11-01T01:30','2026-02-30T09:00'])assert.throws(()=>model.campaignScheduleIso(wall,'America/Toronto',now));
 assert.throws(()=>model.campaignScheduleIso('2026-10-06T09:00','Bad/Zone',now));
 assert.throws(()=>model.campaignScheduleIso('2026-10-06T09:00','UTC',Date.parse('2026-10-06T08:59Z')));
});
test('email validation, sender footer, personalization and unsubscribe render safely',()=>{
 const c=content();model.validateSendContent(model.validateContent(c));
 const normal=model.renderCampaign(c),preview=model.renderCampaign({...c,postalAddress:'<b>address</b>'},true);
 assert.match(normal.html,/href="\{\{\{RESEND_UNSUBSCRIBE_URL\}\}\}"/);assert.match(normal.text,/RESEND_UNSUBSCRIBE_URL/);
 assert.match(preview.html,/&lt;b&gt;address&lt;\/b&gt;/);assert.match(preview.html,/Hi there/);assert.doesNotMatch(preview.html,/\{\{\{/);
 assert.match(preview.text,/Test email/);
 for(const html of ['<script>x</script>','<img src=x onerror=evil()>','<a href="javascript:alert(1)">x</a>','{{{unknown_variable}}}'])assert.throws(()=>model.validateContent({...c,html}));
 assert.throws(()=>model.validateSendContent({...c,text:'No opt-out link'}));
 assert.throws(()=>model.validateContent({...c,subject:'subject\nBcc: attacker@example.com'}));
});
test('full draft → test → schedule → metrics → cancel flow persists provider identity and history',async()=>{
 const c=await tested();assert.equal(c.testedRevision,1);
 const testSend=providerCalls.find(call=>call.route==='/emails');assert.deepEqual(testSend.body.to,['tester@example.com']);assert.match(testSend.key,/campaign-test/);assert.doesNotMatch(testSend.body.html,/\{\{\{/);
 const sent=await schedule(c);assert.equal(sent.status,'scheduled');assert.equal(remoteBroadcasts.length,1);
 const result=await service.refreshCampaign(c.id);assert.equal(result.metrics.delivered,9);assert.equal(result.metrics.unique_opened,4);assert.equal(result.trend.length,1);
 await service.refreshCampaignTotals();const overview=await service.listCampaigns();assert.equal(overview.campaigns[0].metrics.delivered,12);assert.equal(overview.totals.unique_clicked,3);assert.equal(overview.campaigns[0].html,'');
 const canceled=await service.cancelCampaign(c.id);assert.equal(canceled.status,'canceled');
 const activity=await service.campaignActivity(c.id);assert.ok(activity.audit.some(a=>a.action==='schedule_requested'));assert.ok(activity.audit.some(a=>a.action==='canceled'));
 await assert.rejects(schedule(c),/Only a draft/);assert.equal(providerCalls.filter(call=>call.route.endsWith('/send')).length,1);
});
test('stale edits, changed recipients, missing unsubscribe and untested revisions cannot schedule',async()=>{
 const c=await tested();const review=await service.reviewCampaign(c.id);
 const saved=await service.saveCampaign(c.id,c.revision,{...c,subject:'Changed'});
 await assert.rejects(service.saveCampaign(c.id,c.revision,c),/changed or is locked/);
 await assert.rejects(schedule(saved),/Send a test/);
 const updated=await service.testCampaign(saved.id,saved.revision,'tester@example.com',randomUUID());
 contacts.set('bob@example.com',{id:randomUUID(),email:'bob@example.com',unsubscribed:false});
 await assert.rejects(service.scheduleCampaign(c.id,{revision:updated.revision,fingerprint:review.fingerprint,wallTime:futureWall(),timeZone:'UTC',confirmed:true}),/Recipients changed/);
 assert.equal(remoteBroadcasts.length,0);
});
test('an ambiguous draft creation is recovered by its campaign UUID without creating or sending twice',async()=>{
 const c=await tested();afterCreate=async()=>{throw new model.CampaignError('Connection interrupted',502);};
 await assert.rejects(schedule(c),/interrupted/);assert.equal(remoteBroadcasts.length,1);
 afterCreate=null;await service.refreshCampaign(c.id);
 const recovered=await service.getCampaign(c.id);assert.equal(recovered.broadcastId,remoteBroadcasts[0].id);
 await schedule(recovered);assert.equal(remoteBroadcasts.length,1);assert.equal(providerCalls.filter(call=>call.route.endsWith('/send')).length,1);
});
test('an uncertain schedule response reconciles a scheduled broadcast instead of sending again',async()=>{
 const c=await tested();const review=await service.reviewCampaign(c.id);
 // Mimic remote scheduling followed by a lost acknowledgement.
 afterCreate=async remote=>{failAt=`POST /broadcasts/${remote.id}/send`;};
 await assert.rejects(service.scheduleCampaign(c.id,{revision:c.revision,fingerprint:review.fingerprint,wallTime:futureWall(),timeZone:'UTC',confirmed:true}),/Unconfirmed/);
 remoteBroadcasts[0].status='scheduled';remoteBroadcasts[0].scheduled_at=new Date(Date.now()+86400000).toISOString();failAt='';
 const refreshed=await service.refreshCampaign(c.id);assert.equal(refreshed.status,'scheduled');
 await assert.rejects(schedule(refreshed),/Only a draft/);assert.equal(providerCalls.filter(call=>call.route.endsWith('/send')).length,1);
});
test('database leases reject concurrent campaign operations and active imports block scheduling',async()=>{
 const c=await tested();await db.query("UPDATE email_campaigns SET lock_token='other',lock_until=NOW()+INTERVAL '5 minutes' WHERE id=$1",[c.id]);
 await assert.rejects(service.testCampaign(c.id,1,'tester@example.com',randomUUID()),/Another operation/);
 await db.query('UPDATE email_campaigns SET lock_until=NULL WHERE id=$1',[c.id]);
 await db.exec("INSERT INTO users VALUES('a','ada@example.com','Ada',NOW(),NULL)");
 await service.startSegmentImport(segmentId,'verified',true);
 await assert.rejects(schedule(c),/Finish the segment import/);assert.equal(remoteBroadcasts.length,0);
});
test('resumable imports normalize/de-duplicate users and never re-subscribe opted-out contacts',async()=>{
 await db.exec("INSERT INTO users VALUES('a',' ADA@example.com ','Ada',NOW(),'v1'),('a2','ada@example.com','Ada',NOW(),NULL),('b','bob@example.com','Bob',NOW(),NULL),('u','unverified@example.com','Unverified',NULL,NULL)");
 contacts.set('ada@example.com',{id:randomUUID(),email:'ada@example.com',unsubscribed:true});
 const job=await service.startSegmentImport(segmentId,'verified',true);assert.equal(job.total,2);
 const done=await service.runImportChunk(job.id);assert.equal(done.status,'complete');assert.equal(done.processed,2);assert.equal(done.skipped,1);
 assert.equal(contacts.get('ada@example.com').unsubscribed,true);
 assert.equal(providerCalls.filter(call=>call.route.startsWith('/contacts/')&&call.route.includes('/segments/')&&call.method==='POST').length,1);
 await assert.rejects(service.runImportChunk(job.id),/complete or another/);
 const all=await service.importCandidates('all');assert.equal(all.length,3);
 await assert.rejects(service.importCandidates('all; DROP TABLE users'),/Invalid recipient filter/);
});
test('a failed import resumes from its committed cursor and observes new opt-outs',async()=>{
 await db.exec("INSERT INTO users VALUES('a','ada@example.com','Ada',NOW(),NULL),('b','bob@example.com','Bob',NOW(),NULL)");
 const job=await service.startSegmentImport(segmentId,'verified',true);
 failAt='GET /contacts/bob%40example.com';
 const failed=await service.runImportChunk(job.id);assert.equal(failed.status,'failed');assert.equal(failed.processed,1);
 const additions=providerCalls.filter(c=>c.route.includes('/segments/')&&c.route.startsWith('/contacts/')&&c.method==='POST').length;
 failAt='';contacts.set('bob@example.com',{id:randomUUID(),email:'bob@example.com',unsubscribed:true});
 const done=await service.runImportChunk(job.id);assert.equal(done.status,'complete');assert.equal(done.processed,2);assert.equal(done.skipped,1);
 assert.equal(providerCalls.filter(c=>c.route.includes('/segments/')&&c.route.startsWith('/contacts/')&&c.method==='POST').length,additions);
});
test('empty segments, incomplete webhook setup and active segment leases block scheduling',async()=>{
 const c=await tested();contacts.clear();await assert.rejects(schedule(c),/no subscribed contacts/);
 contacts.set('ada@example.com',{id:randomUUID(),email:'ada@example.com',unsubscribed:false});
 await db.exec('DELETE FROM email_campaign_webhook');await assert.rejects(schedule(c),/Configure campaign webhooks/);
 await webhook.configureCampaignWebhook();
 await db.query("INSERT INTO email_campaign_segment_locks VALUES($1,'other',NOW()+INTERVAL '5 minutes')",[segmentId]);
 await assert.rejects(schedule(c),/Another operation is updating this segment/);
 assert.equal(remoteBroadcasts.length,0);
});
test('signed webhooks reject forgeries, deduplicate redeliveries and tolerate out-of-order events',async()=>{
 const c=await tested();await schedule(c);const broadcastId=remoteBroadcasts[0].id,emailId=randomUUID();
 const event={type:'email.clicked',created_at:new Date().toISOString(),data:{broadcast_id:broadcastId,email_id:emailId,to:['ada@example.com'],click:{link:'https://www.3dboxstudio.com/studio?utm_campaign=v2_launch',ipAddress:'sensitive-ip'}}};
 const payload=JSON.stringify(event),eventId='msg_testcampaign',timestamp=new Date();
 const signature=new Webhook(signingSecret).sign(eventId,timestamp,payload);
 const headers={'svix-id':eventId,'svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':signature};
 const verified=await webhook.verifyCampaignWebhook(payload,headers);await webhook.storeCampaignWebhook(eventId,verified);await webhook.storeCampaignWebhook(eventId,verified);
 await webhook.storeCampaignWebhook('msg_later',{...event,type:'email.delivered',created_at:new Date(Date.now()-5000).toISOString()});
 const events=(await service.campaignActivity(c.id)).events;assert.equal(events.length,2);assert.equal(events[0].event_type,'email.clicked');assert.match(events[0].link,/utm_campaign/);assert.equal(events[0].detail.ipAddress,undefined);
 await assert.rejects(webhook.verifyCampaignWebhook(payload+' ',headers),/Invalid webhook signature/);
 const response=await hookRoute.POST(new Request('https://example.com/api/webhooks/resend/campaigns',{method:'POST',headers,body:payload}));assert.equal(response.status,200);
 const invalid=await hookRoute.POST(new Request('https://example.com/api/webhooks/resend/campaigns',{method:'POST',headers:{...headers,'svix-signature':'v1,bad'},body:payload}));assert.equal(invalid.status,401);
});
test('webhook secrets are encrypted at rest and not returned to the admin client',async()=>{
 const row=(await db.query('SELECT encrypted_secret FROM email_campaign_webhook')).rows[0];assert.notEqual(row.encrypted_secret,signingSecret);assert.equal(webhook.decryptWebhookSecret(row.encrypted_secret),signingSecret);
 const config=await webhook.webhookConfiguration();assert.equal(config.ready,true);assert.equal(JSON.stringify(config).includes(signingSecret),false);
 const parts=row.encrypted_secret.split('.');parts[1]='invalid';assert.throws(()=>webhook.decryptWebhookSecret(parts.join('.')));
});
test('admin API requires authentication, same origin, JSON and a current saved revision',async()=>{
 const req=body=>new Request('https://example.com/api/admin/campaigns',{method:'POST',headers:{origin:'https://example.com','content-type':'application/json'},body:JSON.stringify(body)});
 authenticated=false;assert.equal((await route.GET(new Request('https://example.com/api/admin/campaigns'))).status,401);assert.equal((await route.POST(req({action:'create',content:content()}))).status,401);
 authenticated=true;
 const cross=new Request('https://example.com/api/admin/campaigns',{method:'POST',headers:{origin:'https://attacker.example','content-type':'application/json'},body:'{}'});assert.equal((await route.POST(cross)).status,403);
 const created=await route.POST(req({action:'create',content:content()}));assert.equal(created.status,200);const c=(await created.json()).campaign;
 assert.equal((await route.POST(req({action:'save',id:c.id,revision:0,content:content()}))).status,400);
 const noJson=new Request('https://example.com/api/admin/campaigns',{method:'POST',headers:{origin:'https://example.com'},body:'{}'});assert.equal((await route.POST(noJson)).status,415);
});
test('provider transport uses bounded throttling retries, complete pagination, and never retries a timed-out mutation',async t=>{
 const originalFetch=global.fetch;process.env.RESEND_API_KEY='test-key';let calls=0;
 try{
  global.fetch=async()=>{calls++;throw Error('timeout');};await assert.rejects(realRequest('/broadcasts','POST',{}),/did not confirm/);assert.equal(calls,1);
  calls=0;global.fetch=async()=>{calls++;return Response.json(calls===1?{data:[{id:'page-one'}],has_more:true}:{data:[{id:'page-two'}],has_more:false});};
  const rows=await realRows('/segments');assert.deepEqual(rows.map(r=>r.id),['page-one','page-two']);assert.equal(calls,2);
  global.fetch=async()=>Response.json({message:'Permission denied'},{status:403});await assert.rejects(realRequest('/segments'),/Permission denied/);
 }finally{global.fetch=originalFetch;t.mock.restoreAll();}
});
