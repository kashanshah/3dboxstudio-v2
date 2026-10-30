/* eslint-disable @typescript-eslint/no-require-imports */
// Feature flags and the "Get this box printed" request: Pro flags stay off
// and never take over a free feature, drafts show only where drafts are
// served, and quote requests are checked before they are stored.
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const test=require('node:test');
const assert=require('node:assert/strict');

const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){
  return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);
};
require.extensions['.ts']=(module,file)=>{
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
};
const features=path.resolve(__dirname,'../src/lib/features.ts');
const {FEATURES,isFeatureOn}=require(features);
const {parseQuoteRequest,quoteLines}=require('../src/content/print-quote.ts');

const withEnv=(env,run)=>{
  const saved={...process.env};
  for(const [key,value] of Object.entries(env)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  try{return run();}finally{process.env=saved;}
};

test('Pro flags are off for everyone unless a deployment asks for one',()=>{
  const pro=Object.entries(FEATURES).filter(([,feature])=>feature.pro);
  assert.deepEqual(pro.map(([id])=>id).sort(),['apiKeys','bulkExport','clientShares','costEstimate','nesting','savedDielines']);
  for(const [id,feature] of pro){
    assert.ok(['off','beta'].includes(feature.status),`${id} should be off, or beta for Pro accounts`);
    withEnv({NEXT_PUBLIC_SHOW_DRAFTS:'true',NEXT_PUBLIC_FEATURES:undefined},()=>assert.equal(isFeatureOn(id),false));
  }
  withEnv({NEXT_PUBLIC_FEATURES:'nesting, apiKeys'},()=>{assert.equal(isFeatureOn('nesting'),true);assert.equal(isFeatureOn('apiKeys'),true);assert.equal(isFeatureOn('bulkExport'),false);});
});

test('no Pro flag gates something that is free today',()=>{
  // Free today: every download format, the Studio, saved Studio projects, share links, image and video export.
  const free=/\b(svg|pdf|dxf|png|jpg|mp4|cricut|share link|studio project|3d preview|download)s?\b/i;
  for(const [id,feature] of Object.entries(FEATURES).filter(([,item])=>item.pro)){
    const claim=feature.summary.replace(/(Saving Studio projects|Single files|Plain share links) stays? free\./,'');
    assert.doesNotMatch(claim,free,`${id} mentions a free feature: ${feature.summary}`);
  }
});

test('the quote form is on everywhere',()=>{
  assert.equal(FEATURES.printQuote.status,'on');
  withEnv({NEXT_PUBLIC_SHOW_DRAFTS:'false',NEXT_PUBLIC_FEATURES:undefined},()=>assert.equal(isFeatureOn('printQuote'),true));
  withEnv({NEXT_PUBLIC_SHOW_DRAFTS:undefined,NEXT_PUBLIC_FEATURES:undefined},()=>assert.equal(isFeatureOn('printQuote'),true));
});

const box={style:'mailer-box',styleName:'Mailer box',length:220,width:160,depth:80,units:'mm',mode:'inside',material:'E-flute corrugated',thickness:1.5,link:'/box-templates/mailer-box?l=220&w=160&d=80'};
const good={box,quantity:'500–999',colours:'Full colour (CMYK)',finish:'Matte',deadline:'2026-12-01',name:'Alex',email:'alex@example.com',country:'gb',notes:'',consent:true};

test('a complete quote request is accepted and listed in full',()=>{
  const result=parseQuoteRequest(good);
  assert.equal(result.ok,true);
  assert.equal(result.request.notes,null);
  const lines=Object.fromEntries(quoteLines(result.request));
  assert.equal(lines.Size,'220 × 160 × 80 mm (inside)');
  assert.match(lines['Box link'],/^https:\/\/[^/]+\/box-templates\/mailer-box\?l=220/);
  // The country is kept as its code and listed by name.
  assert.equal(result.request.country,'GB');
  assert.equal(lines.Country,'United Kingdom (GB)');
  assert.equal(lines['Sent from'],'Dieline generator');
});

test('printing is offered in the US, Canada, the UK and the EU; elsewhere the form takes a waitlist email',()=>{
  const {PRINT_COUNTRIES,COUNTRY_CODES,printsIn,countryCode,countryName,parseWaitlistRequest}=require('../src/content/print-quote.ts');
  assert.equal(PRINT_COUNTRIES.size,30);
  for(const code of PRINT_COUNTRIES)assert.ok(COUNTRY_CODES.includes(code),code);
  for(const code of ['US','CA','GB','DE','FR','IE','PL'])assert.equal(printsIn(code),true,code);
  for(const code of ['IN','CN','BR','AU','CH','NO',null])assert.equal(printsIn(code),false,String(code));
  assert.equal(countryCode(' us '),'US');
  assert.equal(countryCode('XX'),null);
  assert.equal(countryName('IN'),'India');
  // A quote is refused from a country printing isn't offered in, and a waitlist email from one it is.
  assert.match(parseQuoteRequest({...good,country:'IN'}).error,/isn.t available in India/);
  const waitlist={email:'priya@example.com',country:'IN',consent:true,box:{style:'mailer-box',styleName:'Mailer box',source:'studio'}};
  const joined=parseWaitlistRequest(waitlist);
  assert.equal(joined.ok,true);
  assert.deepEqual(joined.request,{email:'priya@example.com',country:'IN',box:{style:'mailer-box',styleName:'Mailer box',source:'studio'}});
  assert.match(parseWaitlistRequest({...waitlist,country:'US'}).error,/ask for a quote/);
  assert.match(parseWaitlistRequest({...waitlist,consent:false}).error,/Tick/);
  assert.match(parseWaitlistRequest({...waitlist,email:'nope'}).error,/email/);
});

test('a Studio box is described as the generator draws it, with a link anyone can open',()=>{
  const {studioQuoteBox}=require('../src/lib/print-quote-box.ts');
  // Studio width × height × depth are the generator's length × depth × width.
  const box=studioQuoteBox('mailer-box',{width:220,height:80,depth:160,thickness:1.5},'Kraft');
  assert.deepEqual({...box,link:undefined},{style:'mailer-box',styleName:'Roll end tuck front mailer box',length:220,width:160,depth:80,units:'mm',mode:'inside',material:'E-flute corrugated',thickness:1.5,link:undefined,source:'studio',finish:'Kraft'});
  assert.equal(box.link,'/box-dieline-generator?style=mailer-box&l=220&w=160&d=80&u=mm&mode=inner&t=1.5');
  const parsed=parseQuoteRequest({...good,box});
  assert.equal(parsed.ok,true);
  const lines=Object.fromEntries(quoteLines(parsed.request));
  assert.equal(lines['Sent from'],'Studio');
  assert.equal(lines['Studio finish'],'Kraft');
  assert.equal(studioQuoteBox('not-a-template',{width:1,height:1,depth:1,thickness:1}),null);
});

test('quote requests are refused without consent, contact details or a real box',()=>{
  const error=change=>{const result=parseQuoteRequest({...good,...change});assert.equal(result.ok,false);return result.error;};
  assert.match(error({consent:false}),/agree/);
  assert.match(error({consent:'on'}),/agree/);
  assert.match(error({email:'not-an-email'}),/email/);
  assert.match(error({name:'  '}),/name/);
  assert.match(error({country:''}),/country/);
  assert.match(error({country:'Narnia'}),/country/);
  assert.match(error({quantity:'a million'}),/quantity/);
  assert.match(error({deadline:'next week'}),/date/);
  assert.match(error({box:{...box,length:-1}}),/size/);
  assert.match(error({box:{...box,link:'https://example.com/phish'}}),/size/);
  assert.match(error({box:{...box,link:'//example.com/x'}}),/size/);
  assert.equal(parseQuoteRequest(null).ok,false);
});

test('a beta Pro feature is on only for accounts given Pro access',()=>{
  const {canUseFeature}=require(features);
  assert.equal(FEATURES.clientShares.status,'beta');
  withEnv({NEXT_PUBLIC_SHOW_DRAFTS:'true',NEXT_PUBLIC_FEATURES:undefined},()=>{
    assert.equal(isFeatureOn('clientShares'),false);
    assert.equal(canUseFeature('clientShares',null),false);
    assert.equal(canUseFeature('clientShares',{pro:false}),false);
    assert.equal(canUseFeature('clientShares',{pro:true}),true);
    assert.equal(canUseFeature('nesting',{pro:true}),false,'an off Pro feature stays off');
    assert.equal(canUseFeature('printQuote',{pro:false}),true,'a non-Pro feature follows its flag');
  });
  withEnv({NEXT_PUBLIC_FEATURES:'clientShares'},()=>assert.equal(canUseFeature('clientShares',null),true));
});
