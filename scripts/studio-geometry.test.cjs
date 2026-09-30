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
  for(const split of [splitA,splitB]){
    assert.equal(split.find(panel=>panel.id==='topLeft').width,240);
    assert.equal(split.find(panel=>panel.id==='topLeft').height,80);
    assert.equal(split.find(panel=>panel.id==='topRight').width,240);
    assert.equal(split.find(panel=>panel.id==='topRight').height,80);
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


test('split-top net matches the production major/minor panel sequence',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};
  const panels=splitTopBoxPanels(d,'side_a');
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

test('split-top 3D halves meet along the depth centre and hinge from front/back edges',()=>{
  const d={width:475,height:225,depth:255,thickness:.5};
  const closed=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center'});
  const a=closed.find(mesh=>mesh.panel==='Top Left').pickCorners;
  const b=closed.find(mesh=>mesh.panel==='Top Right').pickCorners;
  near(Math.abs(a[0][0]-a[1][0]),d.width);
  near(Math.abs(b[0][0]-b[1][0]),d.width);
  assert.ok(a.some(point=>Math.abs(point[2]-d.depth/2)<1e-6));
  assert.ok(b.some(point=>Math.abs(point[2]+d.depth/2)<1e-6));
  assert.ok(a.some(point=>Math.abs(point[2])<1e-6));
  assert.ok(b.some(point=>Math.abs(point[2])<1e-6));
});
