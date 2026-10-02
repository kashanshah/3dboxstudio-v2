import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module,{createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
let state=[],index=0,effect,refs=[],refIndex=0,refreshCount=0;
const load=Module._load;
Module._load=function(request,...args){
  if(request==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(request==='react')return {
    useState(initial){const i=index++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},
    useRef(initial){const i=refIndex++;return refs[i]??= {current:initial};},
    useEffect(callback){effect=callback;},
  };
  if(request==='./auth-provider')return {useAuth:()=>({refresh:async()=>{refreshCount++;}})};
  if(request==='./auth-shell')return {AuthShell:'shell',AuthNotice:'notice'};
  if(request==='next/link')return 'link';
  // Icons are decorative; don't load Lucide against the minimal React hook mock.
  if(request==='lucide-react')return {ArrowRight:'arrow-right'};
  if(request==='@/lib/auth-navigation')return {safeReturnTo:()=>'/studio'};
  return load.call(this,request,...args);
};
const file=new URL('../src/components/auth/verify-email-token.tsx',import.meta.url);
const compiled=new Module(file.pathname);compiled.filename=file.pathname;compiled.paths=Module._nodeModulePaths(file.pathname);
compiled._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file.pathname);
Module._load=load;
const {VerifyEmailToken}=compiled.exports;
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('opening the page verifies automatically once during Strict Mode replay and refreshes auth',async()=>{
  const original=globalThis.fetch;let calls=0,resolveResponse;
  state=[];refs=[];index=0;refIndex=0;refreshCount=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'/api/auth/verify-email');assert.deepEqual(JSON.parse(options.body),{token:'token'});return new Promise(resolve=>{resolveResponse=resolve;});};
  try{
    VerifyEmailToken({token:'token'});
    const cleanup=effect();cleanup();const finalCleanup=effect();
    assert.equal(calls,1);
    resolveResponse(new Response(JSON.stringify({message:'Your email is verified.'}),{status:200}));
    await flush();await flush();
    assert.deepEqual(state[0],{ok:true,message:'Your email is verified.'});
    assert.equal(refreshCount,1);finalCleanup();
  }finally{globalThis.fetch=original;}
});

test('expired tokens show recovery and unmounted requests do not refresh auth',async()=>{
  const original=globalThis.fetch;
  try{
    for(const unmount of [false,true]){
      state=[];refs=[];index=0;refIndex=0;refreshCount=0;
      globalThis.fetch=async()=>new Response(JSON.stringify({error:'This link has expired.'}),{status:400});
      VerifyEmailToken({token:'expired'});const cleanup=effect();if(unmount)cleanup();
      await flush();await flush();
      assert.equal(refreshCount,0);
      assert.deepEqual(state[0],unmount?null:{ok:false,error:'This link has expired.',retryable:false});
      cleanup();
    }
  }finally{globalThis.fetch=original;}
});
