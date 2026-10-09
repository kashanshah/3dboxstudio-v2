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
const within=(a,b,tol,label='')=>assert.ok(Math.abs(a-b)<=tol,`${label} ${a} differs from ${b} by more than ${tol}`);
// Creases bend over a few board thicknesses, so panels that share a crease
// keep two corners within that distance of each other.
const hinged=(a,b,tol,label='')=>{
  const joined=a.filter(p=>b.some(q=>Math.hypot(...p.map((v,i)=>v-q[i]))<=tol));
  assert.ok(joined.length>=2,`${label} panels came apart`);
};

test('pizza box keeps every artwork panel rigid from the flat sheet through lid closure',()=>{
  for(const dimensions of [{width:305,height:45,depth:305,thickness:1.5},{width:240,height:35,depth:180,thickness:1}]){
    const t=dimensions.thickness;
    const panels=getTemplateGeometry('pizza-box',dimensions).panels;
    const base=panels.find(panel=>panel.id==='bottom');
    for(const progress of [0,20,50,70,85,100]){
      const values=templateAssemblyValuesForProgress('pizza-box',progress,'lid_from_back');
      const meshes=buildMeshes(dimensions,values.opening,[1,1,1],[.8,.8,.8],{templateId:'pizza-box',formation:values.formation,openingMode:'lid_from_back'});
      for(const panel of panels){
        const name=panel.label.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
        const mesh=meshes.find(item=>item.panel===name);
        const c=mesh.pickCorners;
        near(Math.hypot(...c[1].map((v,i)=>v-c[0][i])),panel.width);
        near(Math.hypot(...c[3].map((v,i)=>v-c[0][i])),panel.height);
        assert.ok(mesh.vertices.every(Number.isFinite));
        assert.ok(meshes.some(item=>item.panel===`Interior ${name}`));
        if(progress===0){
          // Printed side down with the lid at the back: a proper turn of the
          // sheet, so the dieline's left wall lands on the viewer's right.
          const xs=c.map(p=>p[0]).sort((a,b)=>a-b),zs=c.map(p=>p[2]).sort((a,b)=>a-b);
          near(xs[0],base.x+base.width/2-panel.x-panel.width);
          near(xs[3],base.x+base.width/2-panel.x);
          near(zs[0],panel.y-base.y-base.height/2);
          near(zs[3],panel.y+panel.height-base.y-base.height/2);
          c.forEach(p=>near(p[1],-dimensions.height/2));
        }
      }
      const corners=name=>meshes.find(mesh=>mesh.panel===name).pickCorners;
      const top=corners('Top'),back=corners('Back'),bottom=corners('Bottom');
      // The lid stays on its crease along the back wall at every step.
      hinged(top,back,t*4,`lid at ${progress}%`);
      if(progress===70){
        top.forEach(p=>within(p[2],-dimensions.depth/2,t*3,'upright lid'));
      }
      if(progress===100){
        top.forEach(p=>within(p[1],dimensions.height/2,t*3,'closed lid'));
        bottom.forEach(p=>near(p[1],-dimensions.height/2));
        within(Math.min(...top.map(p=>p[2])),-dimensions.depth/2,t*3,'lid back');
        within(Math.max(...top.map(p=>p[2])),dimensions.depth/2,t*3,'lid front');
        const normal=Array.from(meshes.find(mesh=>mesh.panel==='Top').vertices.slice(3,6));
        near(normal[1],1);
      }
    }
    // The sheet has no overlapping artwork regions.
    for(let i=0;i<panels.length;i++)for(let j=i+1;j<panels.length;j++){
      const a=panels[i],b=panels[j];
      const overlapX=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
      const overlapY=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
      assert.ok(overlapX<=1e-6||overlapY<=1e-6,`${a.id} overlaps ${b.id}`);
    }
  }
});

const {reverseTuckSheet}=require('../src/lib/packaging/templates/reverse-tuck/export.ts');
const titleCase=label=>label.toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
const pairDistances=points=>{const out=[];for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)out.push(Math.hypot(...points[i].map((v,k)=>v-points[j][k])));return out.sort((a,b)=>a-b);};

test('entered physical dimensions survive in both the net and all folded meshes',()=>{
  for(const dimensions of fixtures){
    assert.deepEqual(sanitizeCartonDimensions(dimensions),dimensions);
    const sheet=reverseTuckSheet(dimensions);
    for(const closure of [0,6,50,100]){
      const meshes=buildMeshes(dimensions,closure,[1,1,1],[1,1,1]);
      // Every piece of the cutting template is in 3D, including the flaps,
      // and each stays rigid: its outline keeps its exact size and shape.
      for(const panel of sheet.panels){
        const name=titleCase(panel.label);
        const mesh=meshes.find(item=>item.panel===name);
        assert.ok(mesh,`${name} is missing from 3D`);
        const xs=panel.outline.map(p=>p.x),ys=panel.outline.map(p=>p.y);
        near(mesh.faceAspect,(Math.max(...xs)-Math.min(...xs))/(Math.max(...ys)-Math.min(...ys)));
        const expected=pairDistances(panel.outline.map(p=>[p.x,p.y,0]));
        pairDistances(mesh.pickCorners).forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-6,`${name} keeps its size`));
      }
    }
  }
});

test('the flat 3D sheet is exactly the cutting template',()=>{
  for(const dimensions of fixtures){
    const sheet=reverseTuckSheet(dimensions),front=sheet.panels.find(panel=>panel.id==='front');
    const meshes=buildMeshes(dimensions,0,[1,1,1],[1,1,1]);
    for(const panel of sheet.panels){
      const mesh=meshes.find(item=>item.panel===titleCase(panel.label));
      const expected=panel.outline.map(p=>[p.x-front.x-front.width/2,front.y+front.height/2-p.y,dimensions.depth/2]);
      for(const corner of mesh.pickCorners){
        assert.ok(expected.some(point=>point.every((v,i)=>Math.abs(v-corner[i])<1e-6)),`${panel.label} corner lies on the dieline`);
      }
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
      // The board's cut faces at either end of each bent crease.
      const edges=meshes.filter(mesh=>mesh.bend==='edge');
      assert.ok(edges.length>0,'bent creases show the board at their ends');
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
  closedTop.forEach(point=>within(point[1],dimensions.height/2,dimensions.thickness*3,'opening 0 must be a closed horizontal lid'));
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
  assert.deepEqual(new Set(closed.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).map(mesh=>mesh.panel)),new Set(['Glue','Front','Back','Left','Right','Top','Bottom']));
  const closedTop=closed.find(mesh=>mesh.panel==='Top').pickCorners;
  const openTop=open.find(mesh=>mesh.panel==='Top').pickCorners;
  assert.ok(openTop.some((point,index)=>Math.abs(point[1]-closedTop[index][1])>1),'hinged lid must move in 3D');
  for(const mode of ['door_left','door_right','double_doors']){
    const meshes=buildMeshes(dimensions,100,[1,1,1],[.8,.8,.8],{templateId:'base-box',openingMode:mode});
    assert.equal(meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).length,7);
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
  const tol=d.thickness*3;
  const reaches=(points,axis,value)=>assert.ok(points.some(point=>Math.abs(point[axis]-value)<=tol),`reaches ${value}`);
  near(Math.abs(left[0][2]-left[1][2]),d.depth);
  near(Math.abs(right[0][2]-right[1][2]),d.depth);
  reaches(left,0,-d.width/2);
  reaches(right,0,d.width/2);
  reaches(left,0,0);
  reaches(right,0,0);

  const sideB=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{
    templateId:'split-top-box',formation:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_b',
  });
  const front=sideB.find(mesh=>mesh.panel==='Top Left').pickCorners;
  const back=sideB.find(mesh=>mesh.panel==='Top Right').pickCorners;
  near(Math.abs(front[0][0]-front[1][0]),d.width);
  near(Math.abs(back[0][0]-back[1][0]),d.width);
  reaches(front,2,d.depth/2);
  reaches(back,2,-d.depth/2);
  reaches(front,2,0);
  reaches(back,2,0);
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
  const source=['carton-engine.tsx','carton-scene.ts','carton-renderer.ts']
    .map(file=>fs.readFileSync(path.resolve(__dirname,'../src/components/studio',file),'utf8')).join('\n');
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
    'pizza-box':'pizza-box',
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

    hinged(front,right,d.thickness*3,`front/right at ${formation}%`);
    hinged(right,back,d.thickness*3,`right/back at ${formation}%`);
    hinged(front,left,d.thickness*3,`front/left at ${formation}%`);
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
      hinged(flap,parent,d.thickness*4,`${splitTopHingeSide} flap at ${opening}%`);
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
    hinged(front,right,d.thickness*3,`front/right at ${formation}%`);
    hinged(right,back,d.thickness*3,`right/back at ${formation}%`);
    hinged(back,left,d.thickness*3,`back/left at ${formation}%`);

    if(formation===0){
      for(const panel of [front,right,back,left]){
        for(const point of panel)near(point[2],d.depth/2);
      }
    }
    if(formation===100){
      // The free edge of Left reaches Front's left edge only at full erection.
      hinged(left,front,d.thickness*3,'closed body seam');
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
      hinged(front,right,d.thickness*3);
      hinged(right,back,d.thickness*3);
      hinged(back,left,d.thickness*3);

      const parents=splitTopHingeSide==='side_a'?[left,right]:[front,back];
      for(const [flap,parent] of [[topLeft,parents[0]],[topRight,parents[1]]]){
        hinged(flap,parent,d.thickness*4);
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


test('reverse tuck glue flap bends round its crease and ends up inside the back',()=>{
  const d={width:240,height:300,depth:160,thickness:.5};
  const glueOutline=reverseTuckSheet(d).panels.find(panel=>panel.id==='glue').outline;
  const glueShape=pairDistances(glueOutline.map(p=>[p.x,p.y,0]));
  const distance=(a,b)=>Math.hypot(...b.map((v,i)=>v-a[i]));

  for(const progress of Array.from({length:101},(_,index)=>index)){
    const meshes=buildMeshes(d,progress,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:progress});
    const left=meshes.find(mesh=>mesh.panel==='Left').pickCorners;
    const glue=meshes.find(mesh=>mesh.panel==='Glue').pickCorners;
    // The scored Left/Glue crease stays joined for the whole fold: the flap's
    // edge never leaves the Left panel's edge by more than the bend itself.
    const joined=glue.filter(point=>left.some(other=>distance(point,other)<=d.thickness*5));
    assert.equal(joined.length,2,`glue stays on its crease at ${progress}%`);
    // Glue is a rigid flap; its physical width must never stretch or shrink.
    pairDistances(glue).forEach((value,i)=>near(value,glueShape[i]));
  }

  const flat=buildMeshes(d,0,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:0});
  const flatGlue=flat.find(mesh=>mesh.panel==='Glue').pickCorners;
  const flatLeft=flat.find(mesh=>mesh.panel==='Left').pickCorners;
  assert.ok(Math.max(...flatGlue.map(p=>p[0]))<=Math.min(...flatLeft.map(p=>p[0]))+1e-6,'flat glue flap extends outward from the left panel');

  // Closed, the glue flap lies against the inside of the back, not in it.
  const closed=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:100});
  const z=name=>Array.from(closed.find(mesh=>mesh.panel===name).vertices.slice(2,3))[0];
  assert.ok(z('Glue')>=z('Interior Back')-1e-6,'glue sits inside the back board');
  assert.ok(z('Glue')-z('Interior Back')<d.thickness,'glue rests against the back');
});

test('thick board edges never lie in the same plane as a printed face (no z-fighting seams)',()=>{
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const corners=mesh=>[0,1,2,5].map(i=>Array.from(mesh.vertices.slice(i*8,i*8+3)));
  const inside=(point,quad,normal)=>quad.every((a,i)=>dot(cross(sub(quad[(i+1)%4],a),sub(point,a)),normal)>1e-6)
    ||quad.every((a,i)=>dot(cross(sub(quad[(i+1)%4],a),sub(point,a)),normal)<-1e-6);
  for(const dimensions of [{width:120,height:180,depth:55,thickness:6},{width:300,height:120,depth:200,thickness:4},{width:60,height:60,depth:60,thickness:10}]){
    for(let formation=0;formation<100;formation+=3){
      const meshes=buildMeshes(dimensions,formation,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation});
      const faces=meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior')).map(mesh=>{const q=corners(mesh);return {q,n:unit(cross(sub(q[1],q[0]),sub(q[3],q[0])))};});
      for(const edge of meshes.filter(mesh=>!mesh.panel)){
        const q=corners(edge),n=unit(cross(sub(q[1],q[0]),sub(q[3],q[0])));
        const centroid=[0,1,2].map(k=>(q[0][k]+q[1][k]+q[2][k]+q[3][k])/4);
        for(const face of faces){
          const coplanar=Math.abs(Math.abs(dot(n,face.n))-1)<1e-6&&Math.abs(dot(sub(centroid,face.q[0]),face.n))<1e-4;
          assert.ok(!(coplanar&&inside(centroid,face.q,face.n)),`board edge overlaps a printed face at ${formation}% (${JSON.stringify(dimensions)})`);
        }
      }
    }
  }
});

const {analyseSurfaces,solidify}=require('../src/components/studio/carton-surfaces.ts');
test('closed carton: creases are real bends, inside corners are shaded',()=>{
  const dimensions={width:120,height:180,depth:55,thickness:.5};
  const meshes=buildMeshes(dimensions,100,[1,1,1],[.8,.8,.8]);
  const shading=analyseSurfaces(meshes,dimensions.thickness);
  const frontMesh=meshes.find(mesh=>mesh.panel==='Front');
  const front=shading[meshes.indexOf(frontMesh)];
  // Front's three creases bend as geometry, so they need no painted rounding.
  assert.equal(frontMesh.creases.length,3);
  assert.deepEqual(front.rounded,[0,0,0,0]);
  assert.ok(front.occlusion.every(value=>value===0));
  const bends=meshes.filter(mesh=>mesh.bend==='outside');
  for(const name of ['Left','Right','Top'])assert.ok(bends.some(mesh=>mesh.sourcePanel===name),`${name} crease bends`);
  const inside=shading[meshes.findIndex(mesh=>mesh.panel==='Interior Front')];
  assert.ok(inside.occlusion.every(value=>value>0.4),'inside corners of a closed carton are shaded');
  assert.ok(inside.rounded.every(value=>value===0));
});
test('flat dielines get no fold shading',()=>{
  const dimensions={width:120,height:180,depth:55,thickness:.5};
  const meshes=buildMeshes(dimensions,0,[1,1,1],[.8,.8,.8]);
  for(const item of analyseSurfaces(meshes,dimensions.thickness).filter(Boolean)){
    assert.ok(item.occlusion.every(value=>value===0)&&item.rounded.every(value=>value===0));
  }
});
test('solid board: inside faces meet at creases, edges only on cut sides, covered panels stop at the cover',()=>{
  const corners=mesh=>[0,1,2,5].map(i=>Array.from(mesh.vertices.slice(i*8,i*8+3)));
  const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  // Closed carton: the inside of Front and Left meet along one line at the corner.
  const tuck={width:120,height:180,depth:55,thickness:2};
  const closed=solidify(buildMeshes(tuck,100,[1,1,1],[.8,.8,.8]),tuck.thickness);
  // Closed carton: the inside of Front runs on into the bend at the corner.
  const front=corners(closed.find(mesh=>mesh.panel==='Interior Front'));
  const left=corners(closed.find(mesh=>mesh.panel==='Interior Left'));
  const insideBends=closed.filter(mesh=>mesh.bend==='inside').map(corners);
  for(const face of [front,left]){
    const joined=face.filter(p=>insideBends.some(bend=>bend.some(q=>dist(p,q)<1e-3)));
    assert.ok(joined.length>=2,'inside faces continue into the bend at the corner');
  }
  // The side walls stop under the closed lid: they fold into dust flaps there.
  const lid=closed.find(mesh=>mesh.panel==='Top');
  const lidOutside=Math.max(...corners(lid).map(p=>p[1]));
  for(const wall of ['Left','Right']){
    const inside=Math.max(...corners(closed.find(mesh=>mesh.panel===`Interior ${wall}`)).map(p=>p[1]));
    assert.ok(inside<=lidOutside-tuck.thickness+1e-3,`${wall} inside face stops under the lid`);
  }
  // Template edge strips are rebuilt, and none is drawn along a crease.
  const mailer={width:200,height:80,depth:150,thickness:3};
  const open=buildMeshes(mailer,60,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:100,openingMode:'lid_from_back'});
  const solid=solidify(open,mailer.thickness);
  const strips=solid.filter(mesh=>mesh.doubleSided&&!mesh.panel&&!mesh.bend);
  assert.ok(strips.length>0,'open mailer shows its cut rim');
  for(const strip of strips){
    const c=corners(strip);
    const short=Math.min(dist(c[0],c[1]),dist(c[0],c[3]));
    assert.ok(short>0&&short<=mailer.thickness*1.5,'each strip spans about one board');
  }
  const flat=buildMeshes(mailer,0,[1,1,1],[.8,.8,.8],{templateId:'base-box',formation:0,openingMode:'lid_from_back'});
  const flatStrips=solidify(flat,mailer.thickness).filter(mesh=>mesh.doubleSided&&!mesh.panel&&!mesh.bend).length;
  const panels=flat.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior ')).length;
  assert.ok(flatStrips<panels*4,'fold lines between panels are not drawn as cut edges');
});

test('inside faces of every template can be picked in 3D',()=>{
  const cases=[['reverse-tuck-carton','closed'],['base-box','lid_from_back'],['split-top-box','top_split_meet_center'],['pizza-box','lid_from_back']];
  for(const [templateId,openingMode] of cases){
    const meshes=buildMeshes({width:200,height:120,depth:150,thickness:1},60,[1,1,1],[.8,.8,.8],{templateId,formation:100,openingMode});
    const inside=meshes.filter(mesh=>mesh.panel&&mesh.panel.startsWith('Interior '));
    assert.ok(inside.length>0);
    for(const mesh of inside)assert.equal(mesh.pickCorners?.length,4,`${templateId} ${mesh.panel} is pickable`);
  }
});

test('inside artwork keeps its long-standing orientation: across as outside, turned top to bottom',()=>{
  const uvDirections=mesh=>{
    const v=mesh.vertices,P=i=>[v[i*8],v[i*8+1],v[i*8+2]],U=i=>[v[i*8+6],v[i*8+7]];
    const e1=P(1).map((x,k)=>x-P(0)[k]),e2=P(2).map((x,k)=>x-P(0)[k]);
    const d1=[U(1)[0]-U(0)[0],U(1)[1]-U(0)[1]],d2=[U(2)[0]-U(0)[0],U(2)[1]-U(0)[1]];
    const det=d1[0]*d2[1]-d2[0]*d1[1];
    return {u:e1.map((x,k)=>(x*d2[1]-e2[k]*d1[1])/det),v:e2.map((x,k)=>(x*d1[0]-e1[k]*d2[0])/det)};
  };
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0)/Math.hypot(...a)/Math.hypot(...b);
  for(const templateId of ['reverse-tuck-carton','base-box','split-top-box','pizza-box']){
    const meshes=buildMeshes({width:200,height:120,depth:150,thickness:1},100,[1,1,1],[.8,.8,.8],{templateId,formation:0,openingMode:templateId==='pizza-box'?'lid_from_back':'closed'});
    for(const outside of meshes.filter(mesh=>mesh.panel&&!mesh.panel.startsWith('Interior '))){
      const inside=meshes.find(mesh=>mesh.panel===`Interior ${outside.panel}`);
      const a=uvDirections(outside),b=uvDirections(inside);
      assert.ok(dot(a.u,b.u)>0.999,`${templateId} ${outside.panel} inside runs the same way across`);
      assert.ok(dot(a.v,b.v)<-0.999,`${templateId} ${outside.panel} inside is turned top to bottom`);
    }
  }
});

test('reverse-tuck tuck and dust flaps continue their panel\'s artwork, mirrored across the crease',()=>{
  const d={width:120,height:180,depth:55,thickness:.5};
  const meshes=buildMeshes(d,100,[1,1,1],[.8,.8,.8],{templateId:'reverse-tuck-carton',formation:0});
  const sheet=reverseTuckSheet(d),panel=id=>sheet.panels.find(p=>p.id===id);
  const tuck=meshes.find(mesh=>mesh.panel==='Top Tuck');
  assert.equal(tuck.fallbackPanel,'Top');
  const [u0,v0,du,dv]=tuck.fallbackUv;
  const top=panel('top'),tongue=panel('top-tuck');
  // At the crease the tongue meets the top of the Top artwork, and further up
  // it reads back down into Top by its own height.
  near(v0,1);near(dv,-tongue.height/top.height);
  near(u0,(tongue.x-top.x)/top.width);near(du,tongue.width/top.width);
  for(const [flap,source] of [['Top Left Dust Flap','Left'],['Bottom Right Dust Flap','Right'],['Bottom Tuck','Bottom']]){
    const mesh=meshes.find(item=>item.panel===flap);
    assert.equal(mesh.fallbackPanel,source);
    assert.equal(meshes.find(item=>item.panel===`Interior ${flap}`).fallbackPanel,`Interior ${source}`);
  }
  // The glue flap stays unprinted for gluing.
  assert.equal(meshes.find(item=>item.panel==='Glue').fallbackPanel,undefined);
  // Bends of a flap borrow the same artwork.
  assert.ok(meshes.some(mesh=>mesh.bend==='outside'&&mesh.sourcePanel==='Top Left Dust Flap'&&mesh.fallbackPanel==='Left'));
});
