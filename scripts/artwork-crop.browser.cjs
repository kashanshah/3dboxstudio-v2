/* eslint-disable @typescript-eslint/no-require-imports */
// Run with BROWSER_EXECUTABLE_PATH=/path/to/chromium npm run test:artwork-browser.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('playwright-core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
require.extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
const { BoardArtworkImage } = require('../src/components/studio/board-artwork-image.tsx');

// Bundle the production rasterizer with TypeScript already installed by the app.
const modules = {};
function bundle(file) {
  const id = path.relative(path.resolve(__dirname, '..'), file);
  if (modules[id]) return id;
  let code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  modules[id] = '';
  code = code.replace(/require\("(\.[^"]+)"\)/g, (_, name) => `require(${JSON.stringify(bundle(path.resolve(path.dirname(file), name + '.ts')))})`);
  modules[id] = code;
  return id;
}
const entry = bundle(path.resolve(__dirname, '../src/lib/packaging/full-dieline-artwork.ts'));
const runtime = `const modules={${Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:(exports,require)=>{${code}}`).join(',')}};const cache={};window.require=id=>{if(!cache[id]){cache[id]={};modules[id](cache[id],window.require);}return cache[id];};`;

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE_PATH, headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({ content: runtime });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450" viewBox="0 0 900 450">${Array.from({length:18}, (_,i)=>`<rect x="${i*50}" width="50" height="450" fill="${i%2?'#90c9ff':'#ffb27e'}"/>`).join('')}<rect y="100" width="900" height="40" fill="#d02040"/><rect y="320" width="900" height="35" fill="#40c060"/></svg>`;
    const svgUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const pngUrl = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 450;
      canvas.getContext('2d').drawImage(image,0,0); return canvas.toDataURL();
    }, svgUrl);
    let comparisons = 0;
    for (const url of [svgUrl, pngUrl]) for (const dimensions of [
      {width:47.5,height:25.5,depth:22.5,thickness:.5},
      {width:20,height:80,depth:15,thickness:.5},
      {width:1500,height:80,depth:50,thickness:.5},
    ]) for (const rotation of [0,27,90]) for (const kind of ['sheet','panel']) {
      const transform = {x:55,y:50,width:65,height:80,rotation};
      const data = await page.evaluate(async ({entry,dimensions,url,transform,kind}) => {
        const {reverseTuckBounds,reverseTuckPanels}=window.require('src/lib/packaging/reverse-tuck.ts');
        let bounds=reverseTuckBounds(dimensions), panels=reverseTuckPanels(dimensions);
        const rasterizer=window.require(entry);
        let textures;
        if(kind==='panel'){
          const front=panels.find(panel=>panel.label==='FRONT');
          panels=[{...front,x:0,y:0}];bounds={width:front.width,height:front.height};
          textures=await rasterizer.rasterizePanelArtwork({Front:{name:'fixture',url,transform}},dimensions);
        }else textures=await rasterizer.rasterizeFullDielineLayers([{id:'fixture',name:'fixture',url,aspectRatio:2,transform}],dimensions);
        return {bounds,panels,textures};
      }, {entry,dimensions,url,transform,kind});
      const scale=760/Math.max(data.bounds.width,data.bounds.height);
      const imageHtml=renderToStaticMarkup(React.createElement(BoardArtworkImage,{url,aspectRatio:2,width:data.bounds.width*transform.width,height:data.bounds.height*transform.height}));
      await page.evaluate(({html,bounds,scale,t}) => {
        document.body.style.cssText='margin:0;background:white';
        document.body.innerHTML=`<div id="board" style="position:relative;overflow:hidden;width:${bounds.width*scale}px;height:${bounds.height*scale}px"><div style="position:absolute;left:${t.x}%;top:${t.y}%;width:${t.width}%;height:${t.height}%;transform:translate(-50%,-50%) rotate(${t.rotation}deg);transform-origin:center">${html}</div></div>`;
      }, {html:imageHtml,bounds:data.bounds,scale,t:transform});
      await page.locator('img').evaluate(img=>img.decode());
      const screenshot=await page.locator('#board').screenshot();
      const result=await page.evaluate(async ({screenshot,data,scale})=>{
        const decode=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0);return {pixels:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};};
        const board=await decode(screenshot);let bad=0,total=0;
        for(const panel of data.panels){
          const name=panel.label[0]+panel.label.slice(1).toLowerCase();
          const face=await decode(data.textures[name].url);
          for(let y=1;y<20;y++) for(let x=1;x<20;x++){
            const bx=Math.min(board.w-1,Math.floor((panel.x+panel.width*x/20)*scale));
            const by=Math.min(board.h-1,Math.floor((panel.y+panel.height*y/20)*scale));
            const fx=Math.max(0,Math.min(face.w-1,Math.floor(((bx+.5)/scale-panel.x)/panel.width*face.w)));
            const fy=Math.max(0,Math.min(face.h-1,Math.floor(((by+.5)/scale-panel.y)/panel.height*face.h)));
            const fi=(fy*face.w+fx)*4,bi=(by*board.w+bx)*4;
            // Compare flat interiors, excluding antialiased edges whose pixel
            // footprint differs between the screen and higher-resolution texture.
            const rx=Math.ceil(face.w/(panel.width*scale)),ry=Math.ceil(face.h/(panel.height*scale));
            const neighbors=[[-rx,0],[rx,0],[0,-ry],[0,ry]].map(([dx,dy])=>(Math.max(0,Math.min(face.h-1,fy+dy))*face.w+Math.max(0,Math.min(face.w-1,fx+dx)))*4);
            if(neighbors.some(index=>[0,1,2].some(channel=>Math.abs(face.pixels[index+channel]-face.pixels[fi+channel])>15)))continue;
            total++;if([0,1,2].some(channel=>Math.abs(board.pixels[bi+channel]-face.pixels[fi+channel])>45))bad++;
          }
        }return {bad,total};
      },{screenshot:'data:image/png;base64,'+screenshot.toString('base64'),data,scale});
      assert.ok(result.bad/result.total<.035,`${kind} ${url===svgUrl?'SVG':'PNG'} ${JSON.stringify(dimensions)} rotation ${rotation}: ${result.bad}/${result.total} pixels disagree`);
      comparisons+=result.total;
    }
    console.log(`Browser crop parity passed: 36 full-sheet/per-face SVG/PNG size/rotation cases, ${comparisons} pixel comparisons against production 3D face textures.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
