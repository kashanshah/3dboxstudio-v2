/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const load=Module._load,resolve=Module._resolveFilename;
const scheduled=[];
Module._load=function(request,...args){if(request==='next/server')return {after:callback=>scheduled.push(callback)};return load.call(this,request,...args);};
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);

test('server analytics reuse one PostHog client, add no process listeners, and flush after the response',async()=>{
 process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN='phc_test';process.env.NEXT_PUBLIC_POSTHOG_HOST='http://127.0.0.1:9';
 const {getPostHogClient,captureServerEvent,captureServerException}=require('../src/lib/posthog-server.ts');
 const listeners=()=>process.listenerCount('uncaughtException')+process.listenerCount('unhandledRejection');
 const before=listeners();
 const client=getPostHogClient();
 client.flush=async()=>{};
 for(let i=0;i<15;i++){await captureServerEvent('user','design_saved',{i});await captureServerException(new Error('boom'),'user');}
 assert.equal(getPostHogClient(),client);
 assert.equal(listeners(),before);
 assert.equal(scheduled.length,30,'each capture defers its flush with after()');
  client.disable?.();
 client._events?.removeAllListeners?.();
});
