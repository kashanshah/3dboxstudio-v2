/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',{url:'https://example.com/studio/editor',pretendToBeVisual:true});
for(const name of ['window','self','document','navigator','location','HTMLElement','HTMLCanvasElement','localStorage','requestAnimationFrame','cancelAnimationFrame'])Object.defineProperty(global,name,{value:dom.window[name],configurable:true});
global.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
const transpile=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
require.extensions['.ts']=transpile;require.extensions['.tsx']=transpile;require.extensions['.css']=()=>{};
const React=require('react'),{createRoot}=require('react-dom/client');
const authModule=new Module(path.resolve(__dirname,'../src/components/auth/auth-provider.tsx'));
authModule.exports={useAuth:()=>({loading:true})};authModule.loaded=true;require.cache[authModule.id]=authModule;
const {StudioShell}=require('../src/components/studio/studio-shell.tsx');
const wait=ms=>new Promise(done=>setTimeout(done,ms));

test('dragging the native inside color picker does not hit the React update depth limit',async()=>{
  const errors=[];
  const onError=event=>{errors.push(event.error);event.preventDefault();};
  dom.window.addEventListener('error',onError);
  const root=createRoot(document.getElementById('root'));
  root.render(React.createElement(StudioShell,{initialProject:{id:'p1',name:'Color test',updatedAt:new Date().toISOString(),favorite:false,revision:1,workspaceProjectId:null,state:{
    version:1,templateId:'reverse-tuck-end',dimensions:{width:80,height:120,depth:40,thickness:.5},material:'Soft touch',opening:0,measurementUnit:'mm',
    artworkByPanel:{},outsideArtworkLayers:[],insideArtworkLayers:[],mediaAssets:[],
    outsideColorMode:'material',insideColorMode:'custom',outsideCustomColor:'#C7D4DE',insideCustomColor:'#D7E0E7',
  }}}));
  const clickButton=async text=>{[...document.querySelectorAll('button')].find(button=>button.textContent.startsWith(text)).click();await wait(50);};
  await wait(50);
  await clickButton('1Box');
  await clickButton('Material & Finish');
  const picker=document.querySelector('input[aria-label="Choose inside box color"]');
  assert.ok(picker,'inside color picker is visible');
  // A native picker drag sends input events faster than React's default-priority work can run.
  const setValue=Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set;
  let color='';
  for(let step=0;step<200;step++){
    color=`#${(0x204060+step*0x010203).toString(16).padStart(6,'0')}`;
    setValue.call(picker,color);
    picker.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  }
  await wait(50);
  assert.equal(document.querySelector('input[aria-label="inside color hex value"]').value,color.toUpperCase());
  dom.window.removeEventListener('error',onError);
  root.unmount();
  assert.deepEqual(errors.map(error=>error?.message),[]);
  dom.window.close();
});
