/* eslint-disable @typescript-eslint/no-require-imports */
// Onboarding emails: the welcome and its one follow-up carry an unsubscribe
// link, ask for a reply, and are claimed in the database before sending so
// nothing goes out twice or to people who unsubscribed.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {renderWelcomeTemplate,renderOnboardingFollowUpTemplate}=require('../src/server/email/templates.ts');
const {FEATURES}=require('../src/lib/features.ts');
const source=fs.readFileSync(path.resolve(__dirname,'../src/server/onboarding-emails.ts'),'utf8');
const unsubscribeUrl='https://www.3dboxstudio.com/unsubscribe?token=abc_DEF-123456789';

test('the welcome links the Studio, generator and templates, escapes the name and can be unsubscribed from',()=>{
  const email=renderWelcomeTemplate({name:'<b>Alex</b>',unsubscribeUrl});
  assert.equal(email.subject,'Welcome to 3D Box Studio');
  for(const pathname of ['/studio','/box-dieline-generator','/box-templates']) assert.ok(email.text.includes(pathname),pathname);
  assert.doesNotMatch(email.html,/<b>Alex<\/b>/);
  assert.ok(email.html.includes(`href="${unsubscribeUrl}"`));
  assert.ok(email.text.includes(`Unsubscribe: ${unsubscribeUrl}`));
  assert.match(email.text,/Reply to this email/);
  assert.throws(()=>renderWelcomeTemplate({name:'Alex',unsubscribeUrl:'javascript:alert(1)'}));
});

test('the follow-up suggests next steps by whether a design was saved, and says it is the last',()=>{
  const fresh=renderOnboardingFollowUpTemplate({name:null,hasDesign:false,unsubscribeUrl});
  const started=renderOnboardingFollowUpTemplate({name:'Alex',hasDesign:true,unsubscribeUrl});
  assert.equal(fresh.subject,'Your first box in three steps');
  assert.match(fresh.text,/^Hi there,/);
  assert.match(fresh.text,/\/box-templates/);
  assert.match(started.text,/Share it/);
  assert.match(started.text,/\/studio/);
  for(const email of [fresh,started]){
    assert.ok(email.html.includes(`href="${unsubscribeUrl}"`));
    assert.match(email.text,/last of our two welcome emails/);
  }
});

test('sends are claimed first, only for verified, subscribed, recent accounts, behind a feature flag',()=>{
  assert.equal(FEATURES.welcomeEmails.pro,false);
  assert.notEqual(FEATURES.welcomeEmails.status,'off');
  const {CLAIM_WELCOME_SQL,CLAIM_FOLLOW_UPS_SQL}=require('../src/server/onboarding-emails.ts');
  assert.match(CLAIM_WELCOME_SQL,/welcome_email_sent_at IS NULL AND email_verified_at IS NOT NULL AND email_unsubscribed_at IS NULL/);
  assert.match(CLAIM_WELCOME_SQL,/created_at>NOW\(\)-INTERVAL '30 days'/);
  assert.match(CLAIM_FOLLOW_UPS_SQL,/follow_up_email_sent_at IS NULL AND email_unsubscribed_at IS NULL/);
  assert.match(CLAIM_FOLLOW_UPS_SQL,/FOR UPDATE SKIP LOCKED/);
  // A failed send releases its claim so the next run retries it.
  assert.match(source,/SET welcome_email_sent_at=NULL/);
  assert.match(source,/SET follow_up_email_sent_at=NULL/);
  assert.match(source,/isFeatureOn\('welcomeEmails'\)[\s\S]*isFeatureOn\('welcomeEmails'\)/);
});

test('PostgreSQL: the welcome is claimed once, the follow-up comes 3 days later, unsubscribing stops both',async()=>{
  const {PGlite}=require('@electric-sql/pglite');
  const {CLAIM_WELCOME_SQL,CLAIM_FOLLOW_UPS_SQL}=require('../src/server/onboarding-emails.ts');
  const db=new PGlite();
  try{
    await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,email_verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      welcome_email_sent_at TIMESTAMPTZ,follow_up_email_sent_at TIMESTAMPTZ,email_unsubscribed_at TIMESTAMPTZ,email_unsubscribe_token TEXT);
      CREATE TABLE projects(id TEXT PRIMARY KEY,user_id TEXT);
      INSERT INTO users(id,email,email_verified_at,created_at) VALUES
        ('new','a@example.com',NOW(),NOW()),('unverified','b@example.com',NULL,NOW()),('old','c@example.com',NOW(),NOW()-INTERVAL '90 days'),('gone','d@example.com',NOW(),NOW());
      UPDATE users SET email_unsubscribed_at=NOW() WHERE id='gone';`);
    const claim=async id=>(await db.query(CLAIM_WELCOME_SQL,[id,`token-for-${id}-0123456789`])).rows;
    assert.equal((await claim('new')).length,1);
    assert.equal((await claim('new')).length,0,'claimed once only');
    for(const id of ['unverified','old','gone']) assert.equal((await claim(id)).length,0,id);
    const due=async()=>(await db.query(CLAIM_FOLLOW_UPS_SQL,[40,3,10])).rows;
    assert.equal((await due()).length,0,'not yet due');
    await db.exec(`UPDATE users SET welcome_email_sent_at=NOW()-INTERVAL '4 days' WHERE id='new'; INSERT INTO projects VALUES('p1','new');`);
    const [row]=await due();
    assert.equal(row.id,'new');assert.equal(row.has_design,true);assert.equal(row.email_unsubscribe_token,'token-for-new-0123456789');
    assert.equal((await due()).length,0,'follow-up claimed once only');
    await db.exec(`UPDATE users SET follow_up_email_sent_at=NULL,email_unsubscribed_at=NOW() WHERE id='new'`);
    assert.equal((await due()).length,0,'unsubscribed');
    await db.exec(`UPDATE users SET email_unsubscribed_at=NULL,welcome_email_sent_at=NOW()-INTERVAL '11 days' WHERE id='new'`);
    assert.equal((await due()).length,0,'too late');
  }finally{await db.close();}
});
