/* eslint-disable @typescript-eslint/no-require-imports */
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const test=require('node:test');
const assert=require('node:assert/strict');

// Load the renderer's actual TypeScript geometry without a DOM or WebGL context.
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){
  return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);
};
require.extensions['.ts']=require.extensions['.tsx']=(module,file)=>{
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
};
const {buildMeshes}=require('../src/components/studio/carton-engine.tsx');
const {reverseTuckPanels,reverseTuckBounds,sanitizeCartonDimensions}=require('../src/lib/packaging/reverse-tuck.ts');
const {dielineRasterSize,panelRasterSize,sheetTransformToPhysical}=require('../src/lib/packaging/full-dieline-artwork.ts');
const fixtures=[
  {width:47.5*25.4,height:22.5*25.4,depth:25.5*25.4,thickness:.5},
  {width:20,height:40,depth:10,thickness:.5},
  {width:1500,height:80,depth:50,thickness:.5},
];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} differs from ${b}`);

test('entered physical dimensions survive in both the net and all folded meshes',()=>{
  for(const dimensions of fixtures){
    assert.deepEqual(sanitizeCartonDimensions(dimensions),dimensions);
    const panels=reverseTuckPanels(dimensions);
    for(const closure of [0,6,50,100]){
      const meshes=buildMeshes(dimensions,closure,[1,1,1],[1,1,1]);
      for(const panel of panels){
        const name=panel.label[0]+panel.label.slice(1).toLowerCase();
        const mesh=meshes.find(item=>item.panel===name);
        assert.ok(mesh,`${name} is missing from 3D`);
        near(mesh.faceAspect,panel.width/panel.height);
        const c=mesh.pickCorners;
        near(Math.hypot(...c[1].map((v,i)=>v-c[0][i])),panel.width);
        near(Math.hypot(...c[3].map((v,i)=>v-c[0][i])),panel.height);
      }
    }
  }
});

test('fully open 3D corners match the complete 2D net, including the glue strip',()=>{
  for(const dimensions of fixtures){
    const panels=reverseTuckPanels(dimensions),front=panels.find(panel=>panel.id==='front');
    const meshes=buildMeshes(dimensions,0,[1,1,1],[1,1,1]);
    for(const panel of panels){
      const name=panel.label[0]+panel.label.slice(1).toLowerCase();
      const mesh=meshes.find(item=>item.panel===name);
      const expected=[[panel.x,panel.y+panel.height],[panel.x+panel.width,panel.y+panel.height],[panel.x+panel.width,panel.y],[panel.x,panel.y]];
      mesh.pickCorners.forEach((corner,i)=>{
        near(corner[0],expected[i][0]-front.x-dimensions.width/2);
        near(corner[1],dimensions.height/2-(expected[i][1]-front.y));
        near(corner[2],dimensions.depth/2);
      });
    }
  }
});

test('raster canvas keeps the sheet aspect ratio for unusually wide and tall nets',()=>{
  for(const dimensions of [...fixtures,{width:30,height:4000,depth:15,thickness:.5}]){
    const bounds=reverseTuckBounds(dimensions),size=dielineRasterSize(bounds);
    assert.equal(Math.max(size.width,size.height),1800);
    assert.ok(Math.abs(size.width/bounds.width-size.height/bounds.height)<=1/Math.min(bounds.width,bounds.height));
  }
});

const {scaleStudioZoom,wheelStudioZoom}=require('../src/lib/studio-zoom.ts');
const {studioViewProjection}=require('../src/components/studio/carton-engine.tsx');
test('zoom controls continue past previous limits and preserve positive scales',()=>{
  let zoom=82;
  for(let i=0;i<100;i++)zoom=scaleStudioZoom(zoom,1.1);
  assert.ok(zoom>100000);
  for(let i=0;i<200;i++)zoom=scaleStudioZoom(zoom,1/1.1);
  assert.ok(zoom>0&&zoom<.01);
  assert.ok(wheelStudioZoom(200,-100)>200);
  assert.ok(wheelStudioZoom(40,100)<40);
  assert.equal(wheelStudioZoom(82,0),82);
  near(wheelStudioZoom(82,3,1),wheelStudioZoom(82,48,0));
  assert.ok(wheelStudioZoom(82,-1000)>wheelStudioZoom(82,-100));
  assert.equal(scaleStudioZoom(Number.MAX_VALUE,2),Number.MAX_VALUE);
  assert.equal(scaleStudioZoom(Number.MIN_VALUE,.5),Number.MIN_VALUE);
});
test('3D projection keeps magnifying past old limits without moving the camera through the box',()=>{
  const original=studioViewProjection(180,1.5,-.55,.28,82);
  for(const zoom of [.01,20,40,140,500,100000]){
    const matrix=studioViewProjection(180,1.5,-.55,.28,zoom);
    assert.ok(matrix.every(Number.isFinite));
    assert.ok(Math.abs(matrix[0]-original[0]*zoom/82)<Math.max(1,Math.abs(matrix[0]))*1e-6);
    assert.ok(Math.abs(matrix[1]-original[1]*zoom/82)<Math.max(1,Math.abs(matrix[1]))*1e-6);
    near(matrix[2],original[2]);
    near(matrix[3],original[3]);
  }
});

test('3D depth range separates thin board surfaces at every zoom',()=>{
  for(const dimensions of fixtures){
    const maxDimension=Math.max(dimensions.width,dimensions.height,dimensions.depth);
    for(const zoom of [20,82,500]){
      const matrix=studioViewProjection(maxDimension,1,0,0,zoom);
      const depthTerm=matrix[10];
      const farToNear=(depthTerm-1)/(depthTerm+1);
      assert.ok(farToNear<100,`Depth range ${farToNear} loses board-edge precision`);
    }
  }
});

test('finished dimensions define exact 2D panel sizes used for 3D texture crops',()=>{
  for(const dimensions of fixtures){
    const panels=reverseTuckPanels(dimensions);
    const front=panels.find(panel=>panel.id==='front');
    const left=panels.find(panel=>panel.id==='left');
    const right=panels.find(panel=>panel.id==='right');
    const top=panels.find(panel=>panel.id==='top');
    const bottom=panels.find(panel=>panel.id==='bottom');

    near(front.width,dimensions.width);
    near(front.height,dimensions.height);
    near(left.width,dimensions.depth);
    near(left.height,dimensions.height);
    near(right.width,dimensions.depth);
    near(right.height,dimensions.height);
    near(top.width,dimensions.width);
    near(top.height,dimensions.depth);
    near(bottom.width,dimensions.width);
    near(bottom.height,dimensions.depth);

    for(const panel of [front,left,right,top,bottom]){
      const raster=panelRasterSize(panel);
      assert.ok(
        Math.abs(raster.width/raster.height-panel.width/panel.height) <= 1/Math.min(raster.width,raster.height),
        `Raster aspect drifted for ${panel.id}`,
      );
    }
  }
});

test('sheet artwork transforms convert to physical millimetres before panel cropping',()=>{
  for(const dimensions of fixtures){
    const bounds=reverseTuckBounds(dimensions);
    const physical=sheetTransformToPhysical({x:25,y:60,width:30,height:40,rotation:17},bounds);
    near(physical.centerX,bounds.width*.25);
    near(physical.centerY,bounds.height*.60);
    near(physical.width,bounds.width*.30);
    near(physical.height,bounds.height*.40);
    near(physical.rotation,17);
  }
});

const {dielinePrintBounds}=require('../src/lib/packaging/dieline-print.ts');
test('print page preserves physical dieline size and a 3mm outer margin',()=>{
 const bounds={width:200,height:300};
 assert.deepEqual(dielinePrintBounds(bounds,[]),{left:-3,top:-3,width:206,height:306});
});
test('print page includes all corners of rotated artwork beyond each edge',()=>{
 const bounds={width:200,height:300};
 const layers=[
  {transform:{x:-20,y:50,width:80,height:50,rotation:45}},
  {transform:{x:120,y:120,width:100,height:75,rotation:-30}},
  {transform:{x:50,y:-40,width:50,height:60,rotation:90}},
 ];
 const page=dielinePrintBounds(bounds,layers);
 assert.ok(page.left<0 && page.top<0);
 assert.ok(page.left+page.width>bounds.width && page.top+page.height>bounds.height);
 for(const {transform:t} of layers){
  const a=t.rotation*Math.PI/180,cx=bounds.width*t.x/100,cy=bounds.height*t.y/100;
  for(const sx of [-1,1])for(const sy of [-1,1]){
   const dx=sx*bounds.width*t.width/200,dy=sy*bounds.height*t.height/200;
   const x=cx+dx*Math.cos(a)-dy*Math.sin(a),y=cy+dx*Math.sin(a)+dy*Math.cos(a);
   assert.ok(x>=page.left+3-1e-6 && x<=page.left+page.width-3+1e-6);
   assert.ok(y>=page.top+3-1e-6 && y<=page.top+page.height-3+1e-6);
  }
 }
});


test('board thickness edges are single two-sided surfaces with no coplanar duplicates',()=>{
  for(const dimensions of fixtures){
    for(const closure of [0,50,100]){
      const meshes=buildMeshes(dimensions,closure,[1,1,1],[.8,.8,.8]);
      const edges=meshes.filter(mesh=>!mesh.panel);
      assert.equal(edges.length,7*4,'each carton panel should contribute one mesh per physical edge');
      assert.ok(edges.every(mesh=>mesh.doubleSided===true),'physical edge meshes must be rendered two-sided');

      const signatures=new Set();
      for(const mesh of edges){
        const points=[];
        for(let i=0;i<mesh.vertices.length;i+=8){
          points.push([
            Number(mesh.vertices[i].toFixed(5)),
            Number(mesh.vertices[i+1].toFixed(5)),
            Number(mesh.vertices[i+2].toFixed(5)),
          ].join(','));
        }
        const signature=[...new Set(points)].sort().join('|');
        assert.ok(!signatures.has(signature),'duplicate coplanar edge geometry detected');
        signatures.add(signature);
      }
    }
  }
});
