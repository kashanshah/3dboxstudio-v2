import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve('src');
function transpile(source) {
  return ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
function storageStub(values={}) {
  return {getItem:key=>values[key]??null,setItem:(key,value)=>{values[key]=String(value);},removeItem:key=>{delete values[key];}};
}
function analytics({env={},window={location:{pathname:'/studio/editor'}},console:logger=console,consent='granted'}={}) {
  if (!window.localStorage) window.localStorage = storageStub(consent ? {'3dbs_analytics_consent':consent} : {});
  window.dispatchEvent = window.dispatchEvent ?? (()=>true);
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file,exports);
    vm.runInNewContext(transpile(fs.readFileSync(file,'utf8')), {
      exports, process:{env:{NODE_ENV:'production',NEXT_PUBLIC_GA_MEASUREMENT_ID:'G-TEST',NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:'ph-test',...env}},
      window,console:logger,
      require: name => {
        if (name === 'posthog-js') return {
          capture(eventName, properties) {
            if (typeof window.posthog?.capture === 'function') {
              window.posthog.capture(eventName, properties);
              return;
            }
            window.__posthogCaptureQueue = window.__posthogCaptureQueue ?? [];
            window.__posthogCaptureQueue.push([eventName, properties]);
          },
        };
        return load(path.resolve(path.dirname(file), name + '.ts'));
      },
    },{filename:file});
    return exports;
  }
  return {api:load(path.join(root,'lib/analytics/index.ts')),consent:load(path.join(root,'lib/analytics/consent.ts')),window};
}

test('GA and PostHog receive their native pageview names; queued PostHog views retain the original URL',()=>{
  const {api,window} = analytics();
  api.trackEvent('page_view',{page_location:'https://www.3dboxstudio.com/blog?q=box',page_path:'/blog?q=box',page_title:'Box guide',page_referrer:'https://www.3dboxstudio.com/'});
  const event=window.dataLayer.map(args=>Array.from(args)).find(args=>args[0]==='event');
  assert.equal(event[1],'page_view');
  const [name,props]=window.__posthogCaptureQueue[0];
  assert.equal(name,'$pageview');
  assert.equal(props.$current_url,'https://www.3dboxstudio.com/blog?q=box');
  assert.equal(props.$pathname,'/blog');
  assert.equal(props.$title,'Box guide');
  assert.equal(props.$referrer,'https://www.3dboxstudio.com/');
  assert.equal(window.dataLayer.filter(args=>args[0]==='config').length,1);
  api.trackEvent('project_saved',{save_mode:'autosave'});
  assert.equal(window.dataLayer.filter(args=>args[0]==='config').length,1);
  assert.equal(window.__posthogCaptureQueue[1][0],'project_saved');
});

test('admin routes and disabled destinations do not collect custom events',()=>{
  for(const pathname of ['/admin','/admin/users']) {
    const {api,window}=analytics({window:{location:{pathname}}});
    api.trackEvent('export_completed');
    assert.equal(window.dataLayer,undefined);
    assert.equal(window.__posthogCaptureQueue,undefined);
  }
  const {api,window}=analytics({env:{NEXT_PUBLIC_GA_MEASUREMENT_ID:'',NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:''}});
  api.trackEvent('export_completed');
  assert.equal(window.dataLayer,undefined);
  assert.equal(window.__posthogCaptureQueue,undefined);
});

test('one broken analytics destination cannot break the user action or the other destination',()=>{
  const captured=[];
  const {api}=analytics({window:{location:{pathname:'/studio/editor'},gtag:()=>{throw Error('Blocked');},posthog:{capture:(...args)=>captured.push(args)}}});
  assert.doesNotThrow(()=>api.trackEvent('export_completed',{export_format:'png'}));
  assert.equal(captured[0][0],'export_completed');
  const second=analytics({window:{location:{pathname:'/studio/editor'},posthog:{capture:()=>{throw Error('Blocked');}}}});
  assert.doesNotThrow(()=>second.api.trackEvent('project_saved'));
  assert.equal(second.window.dataLayer.at(-1)[1],'project_saved');
});

// Execute the real Studio callbacks with mocked browser/services, rather than
// duplicating their implementation. This covers success vs failed operations.
const shellSource=fs.readFileSync(path.join(root,'components/studio/studio-shell.tsx'),'utf8');
const shellAst=ts.createSourceFile('studio-shell.tsx',shellSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function callback(name,context={}) {
  let initializer;
  function visit(node) {
    if(ts.isVariableDeclaration(node)&&node.name.getText(shellAst)===name) initializer=node.initializer;
    ts.forEachChild(node,visit);
  }
  visit(shellAst);
  assert.ok(initializer,name);
  if(ts.isCallExpression(initializer)) initializer=initializer.arguments[0];
  const events=[];
  const sandbox={exports:{},trackEvent:(name,props)=>events.push([name,props]),...context};
  vm.runInNewContext(transpile('exports.handler = '+initializer.getText(shellAst)),sandbox);
  return {handler:sandbox.exports.handler,events};
}

test('PNG completion follows a successful renderer download; failure and preview navigation are distinct',()=>{
  for (const outcome of [true,false,'throw']) {
    const {handler,events}=callback('exportPng',{workflowStep:'preview',mode:'3d',selectedTemplateId:'reverse-tuck',setMessage:()=>{},engineRef:{current:{exportPng:()=>{if(outcome==='throw')throw Error('Canvas');return outcome;}}}});
    handler();
    assert.equal(events[0][0],'export_clicked');
    assert.equal(events[1][0],outcome===true?'export_completed':'export_failed');
    assert.equal(events[1][1].export_format,'png');
  }
  const pending=callback('exportPng',{workflowStep:'design',mode:'dieline',goToWorkflowStep:()=>{},setMessage:()=>{}});
  pending.handler();
  assert.equal(pending.events.length,0);
});

test('share creation is counted only after save and API success, independently of clipboard access',async()=>{
  for(const success of [true,false]) {
    const context={projectId:'private-project',shareBusy:false,selectedTemplateId:'reverse-tuck',saveDesign:async()=>true,
      fetch:async()=>({ok:success,json:async()=>success?{share:{path:'/preview/private-link',id:'private-link'}}:{error:'Service unavailable'}}),
      window:{location:{origin:'https://www.3dboxstudio.com'}},URL,
      navigator:{clipboard:{writeText:async()=>{throw Error('Permission denied');}}}};
    for(const setter of ['setShareBusy','setShareError','setShareId','setShareUrl','setShareOpen','setMessage','setFileMenuOpen'])context[setter]=()=>{};
    const {handler,events}=callback('shareDesign',context);
    await handler();
    assert.equal(events.length,success?1:0);
    if(success){assert.equal(events[0][0],'share_created');assert.ok(!JSON.stringify(events).includes('private-'));}
  }
});

test('artwork upload counts finalized files, but rejected uploads never produce success events',async()=>{
  for(const success of [true,false]) {
    const context={mediaUploadProgress:null,selectedTemplateId:'reverse-tuck',readUploadDimensions:async()=>({width:100,height:100}),
      uploadMediaFile:async()=>{if(!success)throw Error('Upload failed');return {id:'asset',name:'private.png'};},window:{setTimeout:()=>{}}};
    for(const setter of ['setMediaLibraryOpen','setMessage','setMediaUploadProgress','setMediaAssets','setSelectedMediaAssetId','setMediaLibraryTab'])context[setter]=()=>{};
    const {handler,events}=callback('handleArtworkFiles',context);
    await handler([{name:'private.png',type:'image/png',size:42}]);
    assert.equal(events.length,success?1:0);
    if(success){assert.equal(events[0][0],'artwork_uploaded');assert.equal(events[0][1].upload_surface,'media_library');assert.ok(!JSON.stringify(events).includes('private.png'));}
  }
});

test('saves count confirmed persistence and distinguish autosaves; rejected saves are not successes',async()=>{
  for(const mode of ['manual','autosave','failed','create','create-failed','unconfirmed']) {
    const creating=mode.startsWith('create'),failed=mode.includes('failed'),requests=[],closed=[],errors=[];
    const context={newDesignOpen:creating||mode==='unconfirmed',saveInFlightRef:{current:false},engineRef:{current:{thumbnail:()=> 'data:image/png;base64,x'}},
      newDesignPreviewRef:{current:{thumbnail:()=> 'data:image/png;base64,selected-template'}},
      artworkByPanel:{},outsideDielineLayers:[],insideDielineLayers:[],mediaAssets:[],selectedTemplateId:creating?'pizza-box':'reverse-tuck',
      dimensions:{width:10,height:20,length:30},material:'Kraft',opening:0,formation:100,openingMode:'closed',splitTopHingeSide:'side_a',measurementUnit:'mm',
      initial:undefined,outsideColorMode:'material',insideColorMode:'material',outsideCustomColor:'',insideCustomColor:'',projectName:'Private name',
      projectRevision:creating?undefined:1,workspaceProjectId:'private-workspace',projectId:creating?undefined:'private-project',historySerialized:'{}',saveFingerprint:'{}',
      lastSavedFingerprintRef:{current:''},autosaveBlockedFingerprintRef:{current:null},Blob,
      window:{history:{replaceState:()=>{}}},setNewDesignOpen:open=>closed.push(open),setNewDesignError:error=>errors.push(error),
      fetch:async(url,request)=>{requests.push({url,...request});return {ok:!failed,status:failed?(creating?500:409):200,json:async()=>failed?{error:'Service unavailable'}:{project:{id:'private-project',revision:creating?1:2}}};}};
    for(const setter of ['setSaving','setSaveFailed','setProjectId','setProjectRevision','setWorkspaceProjectId','setSaveConflictOpen','setHasUnsavedChanges','setMessage'])context[setter]=()=>{};
    const {handler,events}=callback('saveDesign',context);
    const saved=await handler(false,false,undefined,false,mode==='autosave','manual',creating);
    assert.equal(saved,!failed&&mode!=='unconfirmed');
    assert.equal(events.length,saved?1:0);
    if(saved){assert.equal(events[0][0],'project_saved');assert.equal(events[0][1].save_mode,creating?'manual':mode);assert.ok(!JSON.stringify(events).includes('private'));}
    if(mode==='unconfirmed')assert.equal(requests.length,0);
    if(creating){
      assert.equal(requests[0].method,'POST');assert.equal(requests[0].url,'/api/projects');
      const body=JSON.parse(requests[0].body);
      assert.equal(body.name,'Private name');assert.equal(body.workspaceProjectId,'private-workspace');
      assert.equal(body.state.templateId,'pizza-box');
      assert.deepEqual(body.state.dimensions,context.dimensions);
      assert.equal(body.preview,'data:image/png;base64,selected-template');
      assert.deepEqual(closed,failed?[]:[false]);
      if(failed){
        assert.ok(errors.at(-1));
        context.fetch=async()=>({ok:true,json:async()=>({project:{id:'retry',revision:1}})});
        const retry=callback('saveDesign',context);
        assert.equal(await retry.handler(false,false,undefined,false,false,'manual',true),true);
        assert.deepEqual(closed,[false]);
      }
    }
  }
});

test('new design defaults count all projects and use the requested project or My Project',()=>{
  const exports={};
  vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'lib/new-design.ts'),'utf8')),{exports});
  const projects=[{id:'mine',isDefault:true,designCount:2},{id:'client',isDefault:false,designCount:4}];
  assert.equal(exports.newDesignDefaults(projects,'client').name,'Box Design 7');
  assert.equal(exports.newDesignDefaults(projects,'client').workspaceProjectId,'client');
  assert.equal(exports.newDesignDefaults(projects).workspaceProjectId,'mine');
  assert.equal(exports.newDesignDefaults(projects,'other-users-project').workspaceProjectId,'mine');
  assert.equal(exports.newDesignDefaults([{id:'mine',isDefault:true,designCount:0}]).name,'Box Design 1');
});

test('pageview effect deduplicates replay, updates SPA referrer, and excludes admin',()=>{
  const refs=[],events=[],effects=[];
  let index=0,pathname='/',query='';
  const browser={location:{href:'https://www.3dboxstudio.com/'}};
  const doc={title:'Home',referrer:'https://google.com/'};
  const exports={};
  vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'components/analytics/AnalyticsPageView.tsx'),'utf8')),{
    exports,window:browser,document:doc,
    require:name=>{
      if(name==='react')return {useRef:value=>refs[index++]??(refs[index-1]={current:value}),useEffect:fn=>effects.push(fn)};
      if(name==='next/navigation')return {usePathname:()=>pathname,useSearchParams:()=>({toString:()=>query})};
      if(name==='@/lib/analytics')return {trackEvent:(...args)=>events.push(args)};
      if(name==='@/lib/analytics/policy')return {ANALYTICS_ENABLED:true,isAnalyticsBlockedPath:p=>p==='/admin'||p.startsWith('/admin/')};
      throw Error(name);
    },
  });
  function render(){index=0;exports.AnalyticsPageView();const fn=effects.pop();fn();fn();}
  render();
  assert.equal(events.length,1);
  assert.equal(events[0][1].page_referrer,'https://google.com/');
  pathname='/blog';query='q=box';browser.location.href='https://www.3dboxstudio.com/blog?q=box';doc.title='Blog';render();
  assert.equal(events.length,2);
  assert.equal(events[1][1].page_referrer,'https://www.3dboxstudio.com/');
  assert.equal(events[1][1].page_title,'Blog');
  pathname='/admin/users';render();
  assert.equal(events.length,2);
});

test('PDF completion follows generated download; generation failures are reported and duplicate requests are suppressed',async()=>{
  let callback;
  function visit(node){
    if(ts.isCallExpression(node)&&node.expression.getText(shellAst)==='useCallback'&&node.arguments[0]?.getText(shellAst).includes('downloadDielinePdf('))callback=node.arguments[0];
    ts.forEachChild(node,visit);
  }
  visit(shellAst);
  assert.ok(callback);
  for(const success of [true,false]){
    const events=[],statuses=[];
    let resolveDownload;
    const pending=new Promise(resolve=>{resolveDownload=resolve;});
    const context={Error,exports:{},pdfRunning:{current:false},pdfExportOptions:{bleedMm:3},pdfBaseColor:null,artworkByPanel:{},
      selectedTemplateId:'fixture',dimensions:{},openingMode:'closed',splitTopHingeSide:'side_a',layers:[],artworkScope:'outside',
      setPrintError:()=>{},setPrinting:()=>{},onPdfStatus:(...args)=>statuses.push(args),trackEvent:(...args)=>events.push(args),
      require:()=>({downloadDielinePdf:async()=>{await pending;if(!success)throw Error('Image failed');return {widthMm:100,heightMm:200};}})};
    vm.runInNewContext(transpile('exports.handler = '+callback.getText(shellAst)),context);
    const first=context.exports.handler();
    await context.exports.handler();
    assert.equal(events.length,1,'completion must wait for PDF generation');
    resolveDownload();
    await first;
    assert.equal(events[0][0],'export_clicked');
    assert.equal(events[1][0],success?'export_completed':'export_failed');
    assert.equal(events.length,2);
    assert.equal(context.pdfRunning.current,false);
    assert.equal(statuses.at(-1)[0],false);
    if(!success)assert.equal(statuses.at(-1)[1],'Image failed');
  }
});

test('session replay blocks owner-only artwork so off-site replays never request it',()=>{
  const policy={};
  vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'lib/analytics/policy.ts'),'utf8')),{exports:policy,process:{env:{}},window:{}});
  const parts=policy.REPLAY_BLOCK_SELECTOR.split(', ');
  for(const prefix of ['/api/media/','/api/legacy-designs/']) {
    assert.ok(parts.includes(`[src*="${prefix}"]`),`img src ${prefix}`);
    assert.ok(parts.includes(`[style*="${prefix}"]`),`background-image ${prefix}`);
  }
  assert.ok(!parts.some(part=>part.includes('/api/shares/')),'public share media stays visible in replays');
  assert.match(fs.readFileSync('instrumentation-client.ts','utf8'),/session_recording:\{blockSelector:REPLAY_BLOCK_SELECTOR\}/);
});

test('analytics waits for consent: pending events are sent on accept and dropped on decline',()=>{
  const accepted=analytics({consent:null});
  accepted.api.trackEvent('page_view',{page_path:'/',page_location:'https://www.3dboxstudio.com/'});
  accepted.api.trackEvent('export_clicked');
  assert.equal(accepted.window.dataLayer,undefined,'nothing reaches GA before a decision');
  assert.equal(accepted.window.__posthogCaptureQueue,undefined,'nothing reaches PostHog before a decision');
  accepted.consent.setConsentState('granted');
  assert.deepEqual(accepted.window.__posthogCaptureQueue.map(([name])=>name),['$pageview','export_clicked']);
  assert.equal(accepted.window.localStorage.getItem('3dbs_analytics_consent'),'granted');

  const declined=analytics({consent:null});
  declined.api.trackEvent('export_clicked');
  declined.consent.setConsentState('denied');
  declined.api.trackEvent('project_saved');
  assert.equal(declined.window.__posthogCaptureQueue,undefined);
  assert.equal((declined.window.dataLayer??[]).filter(args=>args[0]==='event').length,0);

  const outsideConsentRegion=analytics({consent:null,window:{location:{pathname:'/'},localStorage:storageStub({'3dbs_consent_region':'not_required'})}});
  outsideConsentRegion.api.trackEvent('export_clicked');
  assert.equal(outsideConsentRegion.window.__posthogCaptureQueue[0][0],'export_clicked');
});

test('PostHog init sends one pageview per route, honours consent, and drops every admin event',()=>{
  let initOptions;
  const consentApi={};
  const window={location:{pathname:'/'},localStorage:storageStub({})};
  const listeners=[];
  vm.runInNewContext(transpile(fs.readFileSync('instrumentation-client.ts','utf8')),{
    exports:{},window,URL,process:{env:{NODE_ENV:'production',NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN:'ph',NEXT_PUBLIC_POSTHOG_HOST:'https://us.i.posthog.com'}},
    require:name=>{
      if(name==='posthog-js')return {__esModule:true,default:{init:(token,options)=>{initOptions=options;},opt_in_capturing:()=>listeners.push('in'),opt_out_capturing:()=>listeners.push('out')}};
      if(name==='@/lib/analytics/policy'){const out={};vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'lib/analytics/policy.ts'),'utf8')),{exports:out,process:{env:{}},window});return out;}
      if(name==='@/lib/analytics/consent'){vm.runInNewContext(transpile(fs.readFileSync(path.join(root,'lib/analytics/consent.ts'),'utf8')),{exports:consentApi,window});return consentApi;}
      throw new Error('unexpected import '+name);
    },
  });
  assert.equal(initOptions.capture_pageview,false);
  assert.equal(initOptions.opt_out_capturing_by_default,true,'no capture before consent');
  const event=url=>({event:'$autocapture',properties:{$current_url:url}});
  assert.equal(initOptions.before_send(event('https://www.3dboxstudio.com/admin/users')),null);
  assert.equal(initOptions.before_send(event('https://www.3dboxstudio.com/admin')),null);
  assert.ok(initOptions.before_send(event('https://www.3dboxstudio.com/administrators-guide')));
  assert.ok(initOptions.before_send(event('https://www.3dboxstudio.com/studio')));
  for (const key of ['$current_url','page_location','page_path']) assert.equal(initOptions.before_send({properties:{[key]:'/admin/users?tab=projects'}}),null);
  window.location={pathname:'/admin/settings'};
  assert.equal(initOptions.before_send(event('https://www.3dboxstudio.com/studio')),null,'events sent while on an admin page are dropped');
  window.location={pathname:'/'};
  consentApi.setConsentState('granted');consentApi.setConsentState('denied');
  assert.deepEqual(listeners,['in','out']);
});
