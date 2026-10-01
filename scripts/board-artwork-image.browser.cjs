/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const ts=require('typescript');
const React=require('react');
const {renderToString}=require('react-dom/server');
const {chromium}=require('playwright-core');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const source=path.resolve(__dirname,'../src/components/studio/board-artwork-image.tsx');
const code=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const {BoardArtworkImage}=require(source);
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'board-image-browser-'));
 let browser;
 try{
  fs.writeFileSync(path.join(dir,'board.js'),code);
  fs.writeFileSync(path.join(dir,'entry.js'),`const React=require('react');const {createRoot,hydrateRoot}=require('react-dom/client');const {BoardArtworkImage}=require('./board');let root;window.mount=(props,hydrate)=>{const container=document.querySelector('#board');root=hydrate?hydrateRoot(container,React.createElement(BoardArtworkImage,props)):createRoot(container);if(!hydrate)root.render(React.createElement(BoardArtworkImage,props));};window.update=props=>root.render(React.createElement(BoardArtworkImage,props));window.unmount=()=>root.unmount();`);
  await new Promise((resolve,reject)=>webpack({mode:'production',target:'web',entry:path.join(dir,'entry.js'),output:{path:dir,filename:'bundle.js'},resolve:{modules:[path.resolve(__dirname,'../node_modules')]},optimization:{minimize:false}},(err,stats)=>err?reject(err):stats.hasErrors()?reject(new Error(stats.toString({all:false,errors:true}))):resolve()));
  browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH,headless:true,args:['--no-sandbox']});
  const page=await browser.newPage();
  const svg=(w,h)=>'data:image/svg+xml;base64,'+Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#16a"/><rect x="0" y="0" width="20" height="20" fill="#f20"/></svg>`).toString('base64');
  const wide=svg(800,200),tall=svg(200,800);
  const rasterUrls=await page.evaluate(async ([wide,tall])=>{
   const urls=[];
   for(const [url,mime] of [[wide,'image/png'],[tall,'image/jpeg']]){
    const image=new Image();image.src=url;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    canvas.getContext('2d').drawImage(image,0,0);urls.push(canvas.toDataURL(mime));
   }
   return urls;
  },[wide,tall]);
  let cases=0;
  const check=async(label)=>{
   await page.waitForFunction(()=>{const img=document.querySelector('#board img');return img&&img.complete&&img.naturalWidth;});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const rect=await page.locator('#board img').boundingBox();
   assert.ok(Math.abs(rect.width-300)<1&&Math.abs(rect.height-150)<1,`${label}: got ${rect.width} x ${rect.height}, expected 300 x 150`);
   cases++;
  };
  for(const url of [wide,tall,...rasterUrls]){
   // Reproduce an image whose load event happened before React hydration.
   const props={url,aspectRatio:1,width:300,height:150};
   await page.setContent(`<div id="board" style="width:300px;height:150px">${renderToString(React.createElement(BoardArtworkImage,props))}</div>`);
   await page.locator('img').evaluate(img=>img.decode());
   await page.addScriptTag({path:path.join(dir,'bundle.js')});
   await page.evaluate(props=>window.mount(props,true),props);
   await check('already decoded before hydration');
   await page.evaluate(()=>window.unmount());
   await page.evaluate(props=>window.mount(props,false),props);
   await check('cached image on Design remount');
   await page.evaluate(props=>window.update(props),{...props,url:url===wide?tall:wide});
   await check('replace source with different natural aspect');
  }
  await page.route('https://artwork.test/image.svg',async route=>{
   await new Promise(resolve=>setTimeout(resolve,100));
   await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300"><rect width="100%" height="100%" fill="blue"/></svg>'});
  });
  await page.evaluate(()=>window.update({url:'https://artwork.test/image.svg',aspectRatio:1,width:300,height:150}));
  await check('delayed cold image load');
  await page.evaluate(()=>window.update({url:document.querySelector('#board img').src,aspectRatio:1,width:600,height:300}));
  await check('dimensions change without another load event');
  console.log(`Board image lifecycle passed: ${cases} hydration/cache/remount/source-change/cold-load/dimension cases.`);
 }finally{await browser?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
