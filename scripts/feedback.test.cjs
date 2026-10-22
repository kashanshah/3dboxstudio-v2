/* eslint-disable @typescript-eslint/no-require-imports */
// Site feedback from the Studio and the dieline generator: messages are
// checked before they are stored, odd context is dropped rather than
// refused, and the stored message lists everything the admin needs.
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
const {parseFeedback,feedbackLines,FEEDBACK_KINDS}=require('../src/content/feedback.ts');

const good={kind:'request',message:'  A hexagon box for candles.  ',email:'',source:'generator-style-request',pagePath:'/box-dieline-generator?l=80',context:{box:'Reverse tuck end',size:'80 x 80 x 100 mm',board_mm:0.46}};

test('a message is accepted with its kind, place and context, trimmed',()=>{
  const result=parseFeedback(good);
  assert.equal(result.ok,true);
  assert.deepEqual(result.request,{kind:'request',message:'A hexagon box for candles.',email:null,source:'generator-style-request',pagePath:'/box-dieline-generator?l=80',context:{box:'Reverse tuck end',size:'80 x 80 x 100 mm',board_mm:0.46}});
  assert.deepEqual(FEEDBACK_KINDS.map(kind=>kind.value),['problem','request','idea','other']);
});

test('a message needs a kind and some words; an email is optional but must be real',()=>{
  const error=change=>{const result=parseFeedback({...good,...change});assert.equal(result.ok,false);return result.error;};
  assert.match(error({kind:'praise'}),/about/);
  assert.match(error({message:'   '}),/few words/);
  assert.match(error({message:'x'.repeat(3001)}),/3,000/);
  assert.match(error({email:'not-an-email'}),/email/);
  assert.equal(parseFeedback({...good,email:' alex@example.com '}).request.email,'alex@example.com');
  assert.equal(parseFeedback(null).ok,false);
});

test('an odd place, page or context is dropped rather than refused',()=>{
  const result=parseFeedback({...good,source:'<script>',pagePath:'https://evil.test/x',context:{'bad key':'x',ok:'yes',nested:{a:1},blank:'  ',long:'y'.repeat(500),n:Infinity}});
  assert.equal(result.ok,true);
  assert.equal(result.request.source,'unknown');
  assert.equal(result.request.pagePath,null);
  assert.deepEqual(Object.keys(result.request.context),['ok','long']);
  assert.equal(result.request.context.long.length,300);
  const many=Object.fromEntries(Array.from({length:30},(_,i)=>[`k${String.fromCharCode(97+i%26)}${i<26?'':'z'}`,i]));
  assert.equal(Object.keys(parseFeedback({...good,context:many}).request.context).length,12);
});

test('the stored message says who to reply to, where it came from and the box',()=>{
  const {request}=parseFeedback(good);
  const anonymous=Object.fromEntries(feedbackLines(request,null));
  assert.equal(anonymous['Reply to'],'No email given');
  assert.equal(anonymous.About,'A box or size I need');
  assert.equal(anonymous['Sent from'],'generator-style-request');
  assert.equal(anonymous['board mm'],'0.46');
  assert.equal(anonymous.Account,undefined);
  const signedIn=Object.fromEntries(feedbackLines(request,'member@example.com'));
  assert.equal(signedIn['Reply to'],'member@example.com');
  assert.equal(signedIn.Account,'member@example.com');
  const {request:withEmail}=parseFeedback({...good,email:'alex@example.com'});
  assert.equal(Object.fromEntries(feedbackLines(withEmail,'member@example.com'))['Reply to'],'alex@example.com');
});
