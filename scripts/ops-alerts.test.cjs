/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const load=Module._load,resolve=Module._resolveFilename;
const sent=[],events=[];let failSend=false;
Module._load=function(request,...args){
 if(request==='@/server/email/mailer')return {adminAlertEmail:async()=>'admin@example.com',sendEmail:async(input)=>{if(failSend)throw Error('Resend down');sent.push(input);}};
 if(request==='@/lib/posthog-server')return {captureServerEvent:async(...args)=>{events.push(args);}};
 return load.call(this,request,...args);
};
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {alertAdmin}=require('../src/server/ops-alerts.ts');

test('admin alerts email the admin once per window, log every occurrence, escape details and never throw',async()=>{
 const quiet=console.error;console.error=()=>{};
 try{
  await alertAdmin('email_delivery','Password reset email could not be delivered',{recipient:'<a@example.com>'},new Error('Resend request failed (403): domain not verified'));
  await alertAdmin('email_delivery','Password reset email could not be delivered',{recipient:'b@example.com'},new Error('again'));
  assert.equal(sent.length,1,'repeat alerts are throttled');
  assert.equal(events.length,2,'every occurrence is still recorded');
  assert.equal(sent[0].to,'admin@example.com');
  assert.match(sent[0].subject,/Password reset email could not be delivered/);
  assert.match(sent[0].text,/domain not verified/);
  assert.match(sent[0].html,/&lt;a@example.com&gt;/);
  failSend=true;
  await assert.doesNotReject(alertAdmin('google_oauth','Google sign-in failed',{reason:'token_exchange'}));
 }finally{console.error=quiet;}
});
