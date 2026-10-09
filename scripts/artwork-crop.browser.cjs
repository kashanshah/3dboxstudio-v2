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
  code = code.replace(/require\("(\.[^"]+|@\/[^"]+)"\)/g, (_, name) => `require(${JSON.stringify(bundle(name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2) + '.ts') : path.resolve(path.dirname(file), name + '.ts')))})`);
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
    // Exercise the renderer's actual artwork placement GLSL against V1's Three.js UV matrix.
    const rendererSource=fs.readFileSync(path.resolve(__dirname,'../src/components/studio/carton-renderer.ts'),'utf8');
    const glsl=name=>rendererSource.match(new RegExp(`const ${name} = /\\* glsl \\*/\`([\\s\\S]*?)\`;`))[1];
    const shader=`#extension GL_OES_standard_derivatives : enable\nprecision highp float;\n${glsl('FRAGMENT_PARS')}\nvoid main(){vec4 diffuseColor=vec4(0.,0.,0.,1.);${glsl('ARTWORK_FRAGMENT')}gl_FragColor=vec4(diffuseColor.rgb,1.);}`;
    const uvResult=await page.evaluate(fragment=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
      const gl=canvas.getContext('webgl',{preserveDrawingBuffer:true,antialias:false});
      if(!gl)throw new Error('WebGL unavailable');
      gl.getExtension('OES_standard_derivatives');
      const compile=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh;};
      const program=gl.createProgram();
      gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 aPosition;varying vec2 vArtUv;void main(){gl_Position=vec4(aPosition,0.,1.);vArtUv=aPosition*.5+.5;}'));
      gl.attachShader(program,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);gl.useProgram(program);
      const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const location=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
      const source=document.createElement('canvas');source.width=source.height=32;
      const ctx=source.getContext('2d'),data=ctx.createImageData(32,32);
      for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=(y*32+x)*4;data.data.set([x*7,y*7,(x+y)%32*7,255],i);}ctx.putImageData(data,0,0);
      const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const uniform=name=>gl.getUniformLocation(program,name);
      gl.uniform1i(uniform('uUseArt'),1);gl.uniform2f(uniform('uUvScale'),1,1);gl.uniform2f(uniform('uUvOffset'),0,0);gl.uniform1f(uniform('uFiber'),0);
      let comparisons=0;
      for(const crop of [{x:0,y:0,width:1,height:1},{x:.2,y:.1,width:.5,height:.8}])for(const deg of [0,27,90,180,270])for(const range of [[0,0,1,1],[0,0,1,.5],[0,.5,1,.5]]){
        gl.uniform4f(uniform('uUvCrop'),crop.x,1-crop.y-crop.height,crop.width,crop.height);gl.uniform1f(uniform('uUvRotation'),deg*Math.PI/180);gl.uniform4f(uniform('uFaceUv'),...range);gl.drawArrays(gl.TRIANGLES,0,6);
        const pixels=new Uint8Array(64*64*4);gl.readPixels(0,0,64,64,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        for(let y=7;y<64;y+=13)for(let x=7;x<64;x+=13){
          const u=range[0]+(x+.5)/64*range[2]-.5,v=range[1]+(y+.5)/64*range[3]-.5,c=Math.cos(deg*Math.PI/180),si=Math.sin(deg*Math.PI/180);
          const tx=crop.x+crop.width*(c*u+si*v+.5),ty=1-crop.y-crop.height+crop.height*(-si*u+c*v+.5);
          // Skip exact texel boundaries where GPU float rounding changes nearest sampling.
          if([tx,ty].some(value=>value>0&&value<1&&Math.abs(value*32-Math.round(value*32))<1e-5))continue;
          const ix=Math.max(0,Math.min(31,Math.floor(tx*32))),iy=31-Math.max(0,Math.min(31,Math.floor(ty*32))),i=(y*64+x)*4,expected=[ix*7,iy*7,(ix+iy)%32*7];
          if(expected.some((value,index)=>Math.abs(value-pixels[i+index])>1))throw new Error(`Legacy UV mismatch at ${deg} degrees crop ${JSON.stringify(crop)} range ${range} pixel ${x},${y}: ${expected} / ${Array.from(pixels.slice(i,i+3))} uv ${tx},${ty}`);
          comparisons++;
        }
      }
      return comparisons;
    },shader);
    console.log(`Legacy shader UV parity passed: ${uvResult} comparisons for full/moved/resized crops, 0/27/90/180/270-degree rotations and split-bottom fallback ranges.`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="450" viewBox="0 0 900 450">${Array.from({length:18}, (_,i)=>`<rect x="${i*50}" width="50" height="450" fill="${i%2?'#90c9ff':'#ffb27e'}"/>`).join('')}<rect y="100" width="900" height="40" fill="#d02040"/><rect y="320" width="900" height="35" fill="#40c060"/></svg>`;
    const svgUrl = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
    const pngUrl = await page.evaluate(async url => {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 450;
      canvas.getContext('2d').drawImage(image,0,0); return canvas.toDataURL();
    }, svgUrl);
    const templates=await page.evaluate(()=>window.require('src/lib/packaging/template-registry.ts').getReadyPackagingTemplates().map(template=>({id:template.id,openingMode:window.require('src/lib/packaging/template-runtime.ts').getTemplateRuntime(template.id).assembly.defaultOpeningMode})));
    let comparisons = 0, cases = 0;
    for (const template of templates) for (const url of [svgUrl, pngUrl]) for (const dimensions of [
      {width:47.5,height:25.5,depth:22.5,thickness:.5},
      {width:20,height:80,depth:15,thickness:.5},
      {width:1500,height:80,depth:50,thickness:.5},
    ]) for (const rotation of [0,27,90]) for (const kind of ['sheet','panel']) {
      const transform = {x:55,y:50,width:65,height:80,rotation};
      const data = await page.evaluate(async ({entry,dimensions,url,transform,kind,template}) => {
        const {getTemplateGeometry}=window.require('src/lib/packaging/template-runtime.ts');
        const options={openingMode:template.openingMode,splitTopHingeSide:'side_a'};
        let {bounds,panels}=getTemplateGeometry(template.id,dimensions,options);
        const rasterizer=window.require(entry);
        let textures;
        if(kind==='panel'){
          const front=panels.find(panel=>panel.label==='FRONT');
          panels=[{...front,x:0,y:0}];bounds={width:front.width,height:front.height};
          textures=await rasterizer.rasterizePanelArtwork({Front:{name:'fixture',url,transform}},dimensions,template.id,options);
        }else textures=await rasterizer.rasterizeFullDielineLayers([{id:'fixture',name:'fixture',url,aspectRatio:2,transform}],dimensions,template.id,'',options);
        return {bounds,panels,textures};
      }, {entry,dimensions,url,transform,kind,template});
      const scale=760/Math.max(data.bounds.width,data.bounds.height);
      const imageHtml=renderToStaticMarkup(React.createElement(BoardArtworkImage,{url,aspectRatio:2,width:data.bounds.width*transform.width,height:data.bounds.height*transform.height}));
      await page.evaluate(({html,bounds,scale,t}) => {
        document.body.style.cssText='margin:0;background:white';
        document.body.innerHTML=`<div id="board" style="position:relative;overflow:hidden;width:${bounds.width*scale}px;height:${bounds.height*scale}px"><div style="position:absolute;left:${t.x}%;top:${t.y}%;width:${t.width}%;height:${t.height}%;transform:translate(-50%,-50%) rotate(${t.rotation}deg);transform-origin:center">${html}</div></div>`;
      }, {html:imageHtml,bounds:data.bounds,scale,t:transform});
      // This parity fixture renders static markup without hydration. Reveal the
      // decoded bitmap explicitly; loading lifecycle is tested separately.
      await page.locator('img').evaluate(async img=>{await img.decode();img.style.visibility='visible';document.querySelectorAll('.board-artwork-status').forEach(status=>status.remove());});
      const screenshot=await page.locator('#board').screenshot();
      const result=await page.evaluate(async ({screenshot,data,scale})=>{
        const decode=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0);return {pixels:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height};};
        const board=await decode(screenshot);let bad=0,total=0;
        for(const panel of data.panels){
          const name=panel.label.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
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
      assert.ok(result.bad/result.total<.035,`${template.id} ${kind} ${url===svgUrl?'SVG':'PNG'} ${JSON.stringify(dimensions)} rotation ${rotation}: ${result.bad}/${result.total} pixels disagree`);
      comparisons+=result.total; cases++;
    }
    console.log(`Browser crop parity passed: ${cases} full-sheet/per-face SVG/PNG size/rotation cases across ${templates.length} ready templates, ${comparisons} pixel comparisons against production 3D face textures.`);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
