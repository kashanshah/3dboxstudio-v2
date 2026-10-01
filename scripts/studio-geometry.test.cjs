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
const {reverseTuckPanels,reverseTuckBounds,reverseTuckFoldState,sanitizeCartonDimensions}=require('../src/lib/packaging/reverse-tuck.ts');
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
        if(name==='Glue' && closure>=68){
          assert.equal(mesh,undefined,'covered glue flap must not compete with the back artwork');
          continue;
        }
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

const {panForAnchoredZoom,scaleStudioZoom,wheelStudioZoom}=require('../src/lib/studio-zoom.ts');
const {studioViewProjection}=require('../src/components/studio/carton-engine.tsx');
test('zoom controls keep a 5% floor while remaining unrestricted above it',()=>{
  let zoom=82;
  for(let i=0;i<100;i++)zoom=scaleStudioZoom(zoom,1.1);
  assert.ok(zoom>100000);
  for(let i=0;i<200;i++)zoom=scaleStudioZoom(zoom,1/1.1);
  assert.equal(zoom,5);
  assert.ok(wheelStudioZoom(200,-100)>200);
  assert.ok(wheelStudioZoom(40,100)<40);
  assert.equal(wheelStudioZoom(5,1000),5);
  assert.equal(scaleStudioZoom(5,1/1.1),5);
  assert.equal(wheelStudioZoom(82,0),82);
  near(wheelStudioZoom(82,3,1),wheelStudioZoom(82,48,0));
  assert.ok(wheelStudioZoom(82,-1000)>wheelStudioZoom(82,-100));
  assert.equal(scaleStudioZoom(Number.MAX_VALUE,2),Number.MAX_VALUE);
  assert.equal(scaleStudioZoom(Number.MIN_VALUE,.5),5);
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
      if(closure===100){
        assert.equal(edges.length,0,'fully closed cartons should not draw hidden thickness walls over panel joins');
        continue;
      }
      assert.ok(edges.length>0 && edges.length<=7*4,'coincident hinge edges should be deduplicated');
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


test('cursor-anchored zoom keeps the same canvas point under the cursor',()=>{
  const cases=[
    {pan:{x:0,y:0},point:{x:240,y:-120},oldZoom:100,newZoom:200},
    {pan:{x:75,y:-30},point:{x:-180,y:95},oldZoom:112,newZoom:73},
    {pan:{x:-20,y:60},point:{x:0,y:0},oldZoom:82,newZoom:500},
  ];
  for(const item of cases){
    const nextPan=panForAnchoredZoom(item.pan,item.oldZoom,item.newZoom,item.point);
    const contentX=(item.point.x-item.pan.x)/item.oldZoom;
    const contentY=(item.point.y-item.pan.y)/item.oldZoom;
    near(nextPan.x+contentX*item.newZoom,item.point.x);
    near(nextPan.y+contentY*item.newZoom,item.point.y);
  }
});

test('3D screen-space projection offset translates NDC without changing depth',()=>{
  // studioViewProjection returns Float32Array values. Compare projected terms
  // with a relative tolerance so normal Float32 rounding at larger matrix
  // magnitudes does not turn a correct projection into a flaky CI failure.
  const nearProjection=(a,b)=>assert.ok(
    Math.abs(a-b)<Math.max(1,Math.abs(a),Math.abs(b))*1e-6,
    `${a} differs from ${b}`,
  );
  const base=studioViewProjection(180,1.5,-.55,.28,82);
  const ox=.35,oy=-.2;
  const shifted=studioViewProjection(180,1.5,-.55,.28,82,ox,oy);
  for(let column=0;column<4;column++){
    const i=column*4;
    nearProjection(shifted[i],base[i]+ox*base[i+3]);
    nearProjection(shifted[i+1],base[i+1]+oy*base[i+3]);
    nearProjection(shifted[i+2],base[i+2]);
    nearProjection(shifted[i+3],base[i+3]);
  }
});


const {baseBoxPanels,splitTopBoxPanels,baseBoxBounds,splitTopBoxBounds}=require('../src/lib/packaging/box-structures.ts');

test('base box and split-top nets preserve finished face dimensions',()=>{
  const dimensions={width:240,height:100,depth:160,thickness:.5};
  const base=baseBoxPanels(dimensions);
  const splitA=splitTopBoxPanels(dimensions,'side_a');
  const splitB=splitTopBoxPanels(dimensions,'side_b');
  assert.equal(base.find(panel=>panel.id==='front').width,240);
  assert.equal(base.find(panel=>panel.id==='left').width,160);
  assert.equal(base.find(panel=>panel.id==='top').height,160);
  assert.equal(splitA.filter(panel=>panel.id.startsWith('top')).length,2);
  assert.equal(splitA.find(panel=>panel.id==='topLeft').width,160);
  assert.equal(splitA.find(panel=>panel.id==='topLeft').height,120);
  assert.equal(splitA.find(panel=>panel.id==='topRight').width,160);
  assert.equal(splitA.find(panel=>panel.id==='topRight').height,120);
  assert.equal(splitB.find(panel=>panel.id==='topLeft').width,240);
  assert.equal(splitB.find(panel=>panel.id==='topLeft').height,80);
  assert.equal(splitB.find(panel=>panel.id==='topRight').width,240);
  assert.equal(splitB.find(panel=>panel.id==='topRight').height,80);
  for(const split of [splitA,splitB]){
    assert.equal(split.filter(panel=>panel.id.startsWith('bottom')).length,2);
    assert.equal(split.find(panel=>panel.id==='bottomFront').width,240);
    assert.equal(split.find(panel=>panel.id==='bottomBack').width,240);
  }
  assert.ok(baseBoxBounds(dimensions).width>dimensions.width);
  assert.ok(splitTopBoxBounds(dimensions,'side_a').height>dimensions.height);
});

test('base and split-top templates separate flat formation from package opening',()=>{
  const dimensions={width:240,height:100,depth:160,thickness:.5};
  const flat=buildMeshes(dimensions,0,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:0,openingMode:'lid_from_back'});
  const closed=buildMeshes(dimensions,0,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:100,openingMode:'lid_from_back'});
  const open=buildMeshes(dimensions,100,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:100,openingMode:'lid_from_back'});
  const flatTop=flat.find(mesh=>mesh.panel==='Top').pickCorners;
  const closedTop=closed.find(mesh=>mesh.panel==='Top').pickCorners;
  const openTop=open.find(mesh=>mesh.panel==='Top').pickCorners;
  assert.ok(flat.every(mesh=>!mesh.panel||mesh.pickCorners.every(point=>Math.abs(point[2]-flat[0].pickCorners[0][2])<dimensions.depth+dimensions.thickness+1)),'flat formation must remain on the dieline plane');
  assert.ok(closedTop.every(point=>Math.abs(point[1]-dimensions.height/2)<1e-6),'opening 0 must be a closed horizontal lid');
  assert.ok(openTop.some((point,index)=>Math.abs(point[1]-closedTop[index][1])>1),'opening 100 must move the lid away from closed');
  assert.notDeepEqual(flatTop,closedTop,'formation 0 and assembled closed must be distinct states');

  const splitFlat=buildMeshes({width:400,height:300,depth:300,thickness:.5},0,[1,1,1],[.8,.8,.8],{templateId:'split-top-box',formation:0,openingMode:'top_split_meet_center',splitTopHingeSide:'side_a'});
  const splitOpen=buildMeshes({width:400,height:300,depth:300,thickness:.5},100,[1,1,1],[.8,.8,.8],{templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_a'});
  assert.notDeepEqual(splitFlat.find(mesh=>mesh.panel==='Top Left').pickCorners,splitOpen.find(mesh=>mesh.panel==='Top Left').pickCorners);
});

test('legacy base-box opening modes articulate existing faces without changing topology',()=>{
  const dimensions={width:240,height:100,depth:160,thickness:.5};
  const closed=buildMeshes(dimensions,0,[1,1,1],[.8,.8,.8],{templateId:'base-box',openingMode:'lid_from_back'});
  const open=buildMeshes(dimensions,100,[1,1,1],[.8,.8,.8],{templateId:'base-box',openingMode:'lid_from_back'});
  assert.deepEqual(new Set(closed.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).map(mesh=>mesh.panel)),new Set(['Front','Back','Left','Right','Top','Bottom']));
  const closedTop=closed.find(mesh=>mesh.panel==='Top').pickCorners;
  const openTop=open.find(mesh=>mesh.panel==='Top').pickCorners;
  assert.ok(openTop.some((point,index)=>Math.abs(point[1]-closedTop[index][1])>1),'hinged lid must move in 3D');
  for(const mode of ['door_left','door_right','double_doors']){
    const meshes=buildMeshes(dimensions,100,[1,1,1],[.8,.8,.8],{templateId:'base-box',openingMode:mode});
    assert.equal(meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).length,6);
  }
});

test('split-top template always exposes two separately textured top panels',()=>{
  const dimensions={width:400,height:300,depth:300,thickness:.5};
  for(const splitTopHingeSide of ['side_a','side_b']){
    const meshes=buildMeshes(dimensions,35,[1,1,1],[.8,.8,.8],{templateId:'split-top-box',openingMode:'top_split_meet_center',splitTopHingeSide});
    const exterior=meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).map(mesh=>mesh.panel);
    assert.ok(exterior.includes('Top Left'));
    assert.ok(exterior.includes('Top Right'));
    assert.ok(!exterior.includes('Top'));
  }
});


test('base-box lid variants attach the top face to the matching body panel',()=>{
 const d={width:240,height:100,depth:160,thickness:.5};
 const modes=[['lid_from_front','front'],['lid_from_back','back'],['lid_from_left','left'],['lid_from_right','right']];
 for(const [mode,bodyId] of modes){
  const panels=baseBoxPanels(d,mode),body=panels.find(panel=>panel.id===bodyId),top=panels.find(panel=>panel.id==='top');
  assert.equal(top.x,body.x,mode+' top x should align to hinge wall');
  assert.equal(top.width,body.width,mode+' top hinge edge should equal wall top edge');
  assert.equal(top.y+top.height,body.y,mode+' top should touch the selected wall');
 }
});


test('split-top front/back axis matches the production major/minor panel sequence',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};
  const panels=splitTopBoxPanels(d,'side_b');
  const glue=panels.find(panel=>panel.id==='glue');
  const front=panels.find(panel=>panel.id==='front');
  const right=panels.find(panel=>panel.id==='right');
  const back=panels.find(panel=>panel.id==='back');
  const left=panels.find(panel=>panel.id==='left');
  assert.equal(front.x,glue.x+glue.width);
  assert.equal(right.x,front.x+front.width);
  assert.equal(back.x,right.x+right.width);
  assert.equal(left.x,back.x+back.width);
  assert.deepEqual([front.width,right.width,back.width,left.width],[475,255,475,255]);

  const topFront=panels.find(panel=>panel.id==='topLeft');
  const topBack=panels.find(panel=>panel.id==='topRight');
  const bottomFront=panels.find(panel=>panel.id==='bottomFront');
  const bottomBack=panels.find(panel=>panel.id==='bottomBack');
  for(const [flap,parent] of [[topFront,front],[topBack,back],[bottomFront,front],[bottomBack,back]]){
    assert.equal(flap.x,parent.x);
    assert.equal(flap.width,parent.width);
  }
  assert.equal(topFront.y+topFront.height,front.y);
  assert.equal(topBack.y+topBack.height,back.y);
  assert.equal(bottomFront.y,front.y+front.height);
  assert.equal(bottomBack.y,back.y+back.height);
});

test('split-top 3D closes around the selected physical hinge axis',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};

  const sideA=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{
    templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_a',
  });
  const left=sideA.find(mesh=>mesh.panel==='Top Left').pickCorners;
  const right=sideA.find(mesh=>mesh.panel==='Top Right').pickCorners;
  near(Math.abs(left[0][2]-left[1][2]),d.depth);
  near(Math.abs(right[0][2]-right[1][2]),d.depth);
  assert.ok(left.some(point=>Math.abs(point[0]+d.width/2)<1e-6));
  assert.ok(right.some(point=>Math.abs(point[0]-d.width/2)<1e-6));
  assert.ok(left.some(point=>Math.abs(point[0])<1e-6));
  assert.ok(right.some(point=>Math.abs(point[0])<1e-6));

  const sideB=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{
    templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_b',
  });
  const front=sideB.find(mesh=>mesh.panel==='Top Left').pickCorners;
  const back=sideB.find(mesh=>mesh.panel==='Top Right').pickCorners;
  near(Math.abs(front[0][0]-front[1][0]),d.width);
  near(Math.abs(back[0][0]-back[1][0]),d.width);
  assert.ok(front.some(point=>Math.abs(point[2]-d.depth/2)<1e-6));
  assert.ok(back.some(point=>Math.abs(point[2]+d.depth/2)<1e-6));
  assert.ok(front.some(point=>Math.abs(point[2])<1e-6));
  assert.ok(back.some(point=>Math.abs(point[2])<1e-6));
});


const {getReadyPackagingTemplates,getDefaultPackagingTemplate}=require('../src/lib/packaging/template-registry.ts');
const {
  getTemplateRuntime,
  getTemplateGeometry,
  getTemplateAssemblyState,
  templateAssemblyValuesForProgress,
}=require('../src/lib/packaging/template-runtime.ts');

test('every ready template has a matching runtime and real default dimensions',()=>{
  const ready=getReadyPackagingTemplates();
  assert.ok(ready.length>0);
  assert.ok(getDefaultPackagingTemplate());
  assert.equal(ready.filter(template=>template.isDefault).length,1,'exactly one ready template should be the default');

  for(const template of ready){
    const runtime=getTemplateRuntime(template.id);
    assert.ok(runtime,`${template.id} is ready but has no runtime`);
    assert.equal(runtime.structureKey,template.structureKey);
    assert.equal(runtime.rendererKey,template.rendererKey);
    assert.equal(typeof runtime.buildMeshes,'function',`${template.id} is missing its template-owned mesh builder`);
    assert.ok(template.defaultDimensions,`${template.id} is ready but has no default dimensions`);

    const geometry=getTemplateGeometry(template.id,template.defaultDimensions,{
      openingMode:runtime.assembly.defaultOpeningMode,
      splitTopHingeSide:'side_a',
    });
    assert.ok(geometry.panels.length>=6,`${template.id} has incomplete dieline geometry`);
    assert.ok(geometry.bounds.width>0&&geometry.bounds.height>0);
    assert.ok(geometry.panels.every(panel=>[panel.x,panel.y,panel.width,panel.height].every(Number.isFinite)));

    const meshes=buildMeshes(template.defaultDimensions,0,[1,1,1],[.8,.8,.8],{
      templateId:template.id,
      formation:100,
      openingMode:runtime.assembly.defaultOpeningMode,
      splitTopHingeSide:'side_a',
    });
    const exterior=new Set(meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).map(mesh=>mesh.panel));
    for(const region of template.artworkRegions.filter(region=>region.surface==='outside')){
      assert.ok(exterior.has(region.panelId),`${template.id} is missing 3D artwork surface ${region.panelId}`);
    }
  }
});

test('template geometry never silently falls back to another template',()=>{
  assert.equal(getTemplateRuntime('not-a-template'),null);
  assert.throws(
    ()=>getTemplateGeometry('not-a-template',{width:100,height:100,depth:100,thickness:.5}),
    /No runtime is registered/,
  );
});

test('dimension changes flow through each ready template runtime',()=>{
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const d=template.defaultDimensions;
    const options={openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'};
    const a=getTemplateGeometry(template.id,d,options);
    const changed={...d,width:d.width*1.17,height:d.height*.83,depth:d.depth*1.11};
    const b=getTemplateGeometry(template.id,changed,options);
    assert.notDeepEqual(a.bounds,b.bounds,`${template.id} ignored changed dimensions`);
    const front=b.panels.find(panel=>panel.label==='FRONT');
    assert.ok(front,`${template.id} has no FRONT panel`);
    near(front.width,changed.width);
    near(front.height,changed.height);
  }
});

test('assembly progress is provided by each template runtime',()=>{
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    for(const progress of [0,35,70,100]){
      const values=templateAssemblyValuesForProgress(template.id,progress,runtime.assembly.defaultOpeningMode);
      const state=getTemplateAssemblyState(template.id,{
        formation:values.formation,
        opening:values.opening,
        openingMode:runtime.assembly.defaultOpeningMode,
      });
      near(state.progress,progress);
      assert.equal(state.control,runtime.assembly.control);
    }
  }
});

test('generic Studio paths contain no template-id geometry shortcuts',()=>{
  const genericFiles=[
    'src/components/studio/studio-shell.tsx',
    'src/components/studio/shared-design-viewer.tsx',
    'src/components/studio/template-visual.tsx',
    'src/components/studio/carton-engine.tsx',
    'src/lib/packaging/full-dieline-artwork.ts',
    'src/lib/studio-project.ts',
  ];
  const forbiddenTemplateIds=['reverse-tuck-carton','base-box','split-top-box'];
  for(const relative of genericFiles){
    const source=fs.readFileSync(path.resolve(__dirname,'..',relative),'utf8');
    for(const id of forbiddenTemplateIds){
      assert.equal(source.includes(id),false,`${relative} hard-codes template id ${id}`);
    }
    assert.equal(/reverseTuck(?:Panels|Bounds|FoldState)/.test(source),false,`${relative} bypasses the template runtime`);
  }
});

test('shared carton engine delegates geometry instead of registering template renderers',()=>{
  const source=fs.readFileSync(path.resolve(__dirname,'../src/components/studio/carton-engine.tsx'),'utf8');
  for(const rendererKey of ['reverse-tuck-v1','base-box-v1','split-top-box-v1']){
    assert.equal(source.includes(rendererKey),false,`shared renderer hard-codes ${rendererKey}`);
  }
  for(const implementation of ['buildReverseTuckMeshes','buildLegacyBoxMeshes','buildBaseBoxTemplateMeshes','buildSplitTopTemplateMeshes']){
    assert.equal(source.includes(implementation),false,`shared renderer contains template implementation ${implementation}`);
  }
  assert.match(source,/runtime\.buildMeshes\s*\(/,'shared renderer must delegate through the active template runtime');
});

test('ready templates keep runtime, geometry and renderer ownership in template modules',()=>{
  const folders={
    'reverse-tuck-carton':'reverse-tuck',
    'base-box':'base-box',
    'split-top-box':'split-top',
  };
  for(const template of getReadyPackagingTemplates()){
    const folder=folders[template.id];
    assert.ok(folder,`ready template ${template.id} has no isolated module assertion`);
    const root=path.resolve(__dirname,'../src/lib/packaging/templates',folder);
    const runtime=fs.readFileSync(path.join(root,'runtime.ts'),'utf8');
    const geometry=fs.readFileSync(path.join(root,'geometry.ts'),'utf8');
    const renderer=fs.readFileSync(path.join(root,'renderer.ts'),'utf8');
    assert.match(runtime,/buildMeshes:/,`${template.id} runtime does not own its mesh builder registration`);
    assert.ok(geometry.length>0,`${template.id} geometry entry point is empty`);
    assert.match(renderer,/TemplateMeshBuilder/,`${template.id} renderer does not implement the shared mesh contract`);
  }
});



test('split bottom flaps have independent artwork keys and preserve legacy full-bottom UVs',()=>{
 const dimensions={width:240,height:100,depth:160,thickness:.5};
 const panels=getTemplateGeometry('split-top-box',dimensions).panels;
 assert.equal(new Set(panels.map(panel=>panel.label)).size,panels.length);
 const meshes=buildMeshes(dimensions,0,[1,1,1],[1,1,1],{templateId:'split-top-box',formation:100});
 for(const [name,y] of [['Bottom Front',.5],['Bottom Back',0]]){
  const mesh=meshes.find(mesh=>mesh.panel===name);
  assert.ok(mesh);
  assert.equal(mesh.fallbackPanel,'Bottom');
  assert.deepEqual(mesh.fallbackUv,[0,y,1,.5]);
  near(mesh.faceAspect,dimensions.width/(dimensions.depth/2));
 }
});


test('base-box formation uses rigid crease rotations at every percentage',()=>{
  const d={width:240,height:100,depth:160,thickness:.5};
  const distance=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));
  const samePoint=(a,b,label)=>a.forEach((v,i)=>near(v,b[i],label));
  for(const formation of Array.from({length:101},(_,index)=>index)){
    const meshes=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{
      templateId:'base-box',formation,openingMode:'lid_from_back',
    });
    const by=name=>meshes.find(mesh=>mesh.panel===name).pickCorners;
    const front=by('Front'),right=by('Right'),back=by('Back'),left=by('Left');
    near(distance(front[0],front[1]),d.width);
    near(distance(front[0],front[3]),d.height);
    near(distance(right[0],right[1]),d.depth);
    near(distance(right[0],right[3]),d.height);
    near(distance(back[0],back[1]),d.width);
    near(distance(back[0],back[3]),d.height);
    near(distance(left[0],left[1]),d.depth);
    near(distance(left[0],left[3]),d.height);

    samePoint(front[1],right[0],`front/right lower hinge at ${formation}%`);
    samePoint(front[2],right[3],`front/right upper hinge at ${formation}%`);
    samePoint(right[1],back[0],`right/back lower hinge at ${formation}%`);
    samePoint(right[2],back[3],`right/back upper hinge at ${formation}%`);
    samePoint(front[0],left[1],`front/left lower hinge at ${formation}%`);
    samePoint(front[3],left[2],`front/left upper hinge at ${formation}%`);
  }
});

test('closure flaps remain rigid and hinged throughout opening percentages on both split axes',()=>{
  const d={width:400,height:300,depth:300,thickness:.5};
  const distance=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));
  for(const splitTopHingeSide of ['side_a','side_b'])for(const opening of [0,10,25,50,75,90,100]){
    const meshes=buildMeshes(d,opening,[1,1,1],[.8,.8,.8],{
      templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center',splitTopHingeSide,
    });
    const by=name=>meshes.find(mesh=>mesh.panel===name).pickCorners;
    const topLeft=by('Top Left'),topRight=by('Top Right');
    const parents=splitTopHingeSide==='side_a'?[by('Left'),by('Right')]:[by('Front'),by('Back')];
    const hingeSpan=splitTopHingeSide==='side_a'?d.depth:d.width;
    const flapReach=splitTopHingeSide==='side_a'?d.width/2:d.depth/2;
    for(const [flap,parent] of [[topLeft,parents[0]],[topRight,parents[1]]]){
      near(distance(flap[0],flap[1]),hingeSpan);
      near(distance(flap[0],flap[3]),flapReach);
      flap[0].forEach((v,i)=>near(v,parent[3][i]));
      flap[1].forEach((v,i)=>near(v,parent[2][i]));
    }
  }
});

test('flat box state is the exact dieline plane for every opening mode',()=>{
  const d={width:240,height:100,depth:160,thickness:.5};
  for(const openingMode of ['closed','lid_from_back','lid_from_front','lid_from_left','lid_from_right','door_left','door_right','double_doors']){
    const meshes=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:0,openingMode});
    const exterior=meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior '));
    for(const mesh of exterior){
      for(const point of mesh.pickCorners)near(point[2],d.depth/2);
    }
  }
});


test('split-top body follows the production crease chain from flat dieline to formed box',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};
  const distance=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));
  const same=(a,b,label)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`${label}: ${a} != ${b}`));

  for(const formation of [0,10,25,50,75,90,100]){
    const meshes=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{
      templateId:'split-top-box',
      formation,
      openingMode:'top_split_meet_center',
      splitTopHingeSide:'side_b',
    });
    const by=name=>meshes.find(mesh=>mesh.panel===name).pickCorners;
    const front=by('Front'),right=by('Right'),back=by('Back'),left=by('Left');

    // Every body panel remains rigid.
    near(distance(front[0],front[1]),d.width);
    near(distance(front[0],front[3]),d.height);
    near(distance(right[0],right[1]),d.depth);
    near(distance(right[0],right[3]),d.height);
    near(distance(back[0],back[1]),d.width);
    near(distance(back[0],back[3]),d.height);
    near(distance(left[0],left[1]),d.depth);
    near(distance(left[0],left[3]),d.height);

    // Every scored crease remains coincident throughout the fold.
    same(front[1],right[0],`front/right lower crease at ${formation}%`);
    same(front[2],right[3],`front/right upper crease at ${formation}%`);
    same(right[1],back[0],`right/back lower crease at ${formation}%`);
    same(right[2],back[3],`right/back upper crease at ${formation}%`);
    same(back[1],left[0],`back/left lower crease at ${formation}%`);
    same(back[2],left[3],`back/left upper crease at ${formation}%`);

    if(formation===0){
      for(const panel of [front,right,back,left]){
        for(const point of panel)near(point[2],d.depth/2);
      }
    }
    if(formation===100){
      // The free edge of Left reaches Front's left edge only at full erection.
      same(left[1],front[0],'closed body lower seam');
      same(left[2],front[3],'closed body upper seam');
    }
  }
});

test('split-top assembly timeline is physically staged from dieline through flap closure',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};
  const {templateAssemblyValuesForProgress}=require('../src/lib/packaging/template-runtime.ts');
  const points=Array.from({length:101},(_,index)=>index);

  for(const splitTopHingeSide of ['side_a','side_b']){
    for(const progress of points){
      const values=templateAssemblyValuesForProgress('split-top-box',progress,'top_split_meet_center');
      const meshes=buildMeshes(d,values.opening,[1,1,1],[.8,.8,.8],{
        templateId:'split-top-box',
        formation:values.formation,
        openingMode:'top_split_meet_center',
        splitTopHingeSide,
      });
      const by=name=>meshes.find(mesh=>mesh.panel===name).pickCorners;
      const front=by('Front'),right=by('Right'),back=by('Back'),left=by('Left');
      const topLeft=by('Top Left'),topRight=by('Top Right');

      // Body topology must never disconnect while the slider advances.
      front[1].forEach((v,i)=>near(v,right[0][i]));
      right[1].forEach((v,i)=>near(v,back[0][i]));
      back[1].forEach((v,i)=>near(v,left[0][i]));

      const parents=splitTopHingeSide==='side_a'?[left,right]:[front,back];
      for(const [flap,parent] of [[topLeft,parents[0]],[topRight,parents[1]]]){
        flap[0].forEach((v,i)=>near(v,parent[3][i]));
        flap[1].forEach((v,i)=>near(v,parent[2][i]));
      }

      if(progress<=70){
        // Closure remains fully open while the body erects.
        near(values.opening,100);
      }else{
        near(values.formation,100);
      }
    }
  }
});


test('reverse tuck glue strip follows its own physical hinge in the correct direction',()=>{
  const d={width:240,height:300,depth:160,thickness:.5};
  const footprint=reverseTuckPanels(d);
  const glueWidth=footprint.find(panel=>panel.id==='glue').width;
  const distance=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));

  for(const progress of Array.from({length:101},(_,index)=>index)){
    const meshes=buildMeshes(d,progress,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:progress});
    const left=meshes.find(mesh=>mesh.panel==='Left').pickCorners;
    const glueMesh=meshes.find(mesh=>mesh.panel==='Glue');
    if(reverseTuckFoldState(progress).back>=.999){
      assert.equal(glueMesh,undefined,'glue is hidden when covered by the back panel');
      assert.equal(meshes.find(mesh=>mesh.panel==='Interior Glue'),undefined);
      assert.ok(meshes.find(mesh=>mesh.panel==='Back'),'printed back remains visible');
      continue;
    }
    const glue=glueMesh.pickCorners;

    // The scored Left/Glue crease must remain connected for the whole fold.
    glue[1].forEach((value,i)=>near(value,left[0][i]));
    glue[2].forEach((value,i)=>near(value,left[3][i]));

    // Glue is a rigid flap; its physical width must never stretch or shrink.
    near(distance(glue[0],glue[1]),glueWidth);
    near(distance(glue[3],glue[2]),glueWidth);
  }

  const flat=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:0});
  const flatGlue=flat.find(mesh=>mesh.panel==='Glue').pickCorners;
  assert.ok(flatGlue[0][0]<flatGlue[1][0],'flat glue flap must extend outward from the left panel');

  const closed=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:100});
  assert.equal(closed.find(mesh=>mesh.panel==='Glue'),undefined);
  assert.equal(closed.find(mesh=>mesh.panel==='Interior Glue'),undefined);
});
