/* eslint-disable @typescript-eslint/no-require-imports */
// The dieline generator (src/lib/dieline): every style in every size mode and
// unit, the cut outline, the fold plan, and the exporters. Golden SVGs of
// each style at its default size live in scripts/reference/dieline; after an
// intended change to a template, regenerate them with
//   UPDATE_DIELINE_SNAPSHOTS=1 node --test scripts/dieline.test.cjs
// and look at the diff before committing.
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
require.extensions['.ts']=require.extensions['.tsx']=(module,file)=>{
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
};
const {DIELINE_STYLES,getDielineStyle,generateDieline,dielineToSvg,dielineToCricutSvg,dielineToDxf,parsePath}=require('../src/lib/dieline/index.ts');
const {dielineToPdf}=require('../src/lib/dieline/export/pdf.ts');
const {pieceOutlines,selfIntersects,isClosed,signedArea}=require('../src/lib/dieline/geometry.ts');
const {PDFDocument}=require('pdf-lib');

const SNAPSHOTS=path.join(__dirname,'reference/dieline');
const MM_PER_IN=25.4;
const AXES=['length','width','depth'];

// The panel side each size is measured by, crease to crease. Written out here
// rather than read from the styles, so the test states what a printer would
// measure on the flat sheet.
const WALLS={length:['front','x'],width:['left','x'],depth:['front','y']};
const TRAY={length:['bottom','x'],width:['bottom','y'],depth:['front','y']};
const MEASURED={
  'reverse-tuck-end':WALLS,'straight-tuck-end':WALLS,'snap-lock-bottom':WALLS,'auto-lock-bottom':WALLS,
  'mailer-box':TRAY,'shipping-box-rsc':WALLS,'gable-box':WALLS,'sleeve-box':WALLS,'pizza-box':TRAY,
  'drawer-box':{length:['sleeveBottom','x'],width:['sleeveBottom','y'],depth:['sleeveLeft','x']},
  'rigid-lid-and-base':TRAY,'four-corner-tray':TRAY,'telescope-box':TRAY,'cake-box':TRAY,
};

const input=(style,overrides={})=>({styleId:style.id,...style.defaults,units:'mm',dimensionMode:'inner',...overrides});
const box=points=>{
  const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
  return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys),x:Math.max(...xs)-Math.min(...xs),y:Math.max(...ys)-Math.min(...ys)};
};
const segments=(output,type)=>output.paths.filter(item=>item.type===type).flatMap(item=>parsePath(item.d)).flatMap(run=>run.slice(1).map((point,i)=>[run[i],point]));
function measure(style,output){
  const spec=MEASURED[style.id];
  return Object.fromEntries(AXES.map(axis=>{
    const [id,side]=spec[axis];
    const panel=output.panels.find(item=>item.id===id);
    assert.ok(panel,`${style.id}: panel ${id} is missing`);
    return [axis,box(panel.polygon)[side]];
  }));
}
const close=(actual,expected,tolerance,message)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} is not within ${tolerance} of ${expected}`);

test('there are fifteen styles with unique ids, each found by id',()=>{
  assert.equal(DIELINE_STYLES.length,15);
  assert.equal(new Set(DIELINE_STYLES.map(style=>style.id)).size,DIELINE_STYLES.length);
  for(const style of DIELINE_STYLES){
    assert.equal(getDielineStyle(style.id),style);
    for(const axis of AXES) assert.ok(style.defaults[axis]>0,`${style.id} default ${axis}`);
    assert.ok(style.defaults.thickness>0);
  }
  assert.equal(getDielineStyle('no-such-box'),null);
  assert.throws(()=>generateDieline({...input(DIELINE_STYLES[0]),styleId:'no-such-box'}));
});

test('every style is drawn at its default size with lines, panels and no warnings',()=>{
  for(const style of DIELINE_STYLES){
    const output=generateDieline(input(style,{dimensionMode:style.modes[0]}));
    const types=new Set(output.paths.map(item=>item.type));
    for(const type of ['cut','crease','bleed','safe']) assert.ok(types.has(type),`${style.id} has no ${type} lines`);
    assert.ok(output.panels.length>=4,`${style.id} panels`);
    assert.ok(output.bounds.width>0&&output.bounds.height>0);
    assert.deepEqual(output.warnings,[],`${style.id} warnings`);
  }
});

test('manufacture sizes are crease to crease on the sheet and outer sizes add one board',()=>{
  for(const style of DIELINE_STYLES.filter(item=>MEASURED[item.id])){
    assert.deepEqual(style.modes,['inner','outer','manufacture'],style.id);
    const {length,width,depth,thickness}=style.defaults;
    const target={length:length+10,width:width+6,depth:depth+8};
    const made=generateDieline(input(style,{...target,dimensionMode:'manufacture'}));
    const measured=measure(style,made);
    for(const axis of AXES) close(measured[axis],target[axis],0.02,`${style.id} manufacture ${axis}`);
    // The inside is never bigger than crease to crease (tuck boxes keep the height crease at the inside height).
    for(const axis of AXES) assert.ok(made.inner[axis]<=target[axis]+0.01,`${style.id}: the inside is bigger than crease to crease (${axis})`);

    const outer=generateDieline(input(style,{length:target.length+thickness,width:target.width+thickness,depth:target.depth+thickness,dimensionMode:'outer'}));
    for(const axis of AXES) close(outer.inner[axis],made.inner[axis],0.02,`${style.id} outer ${axis}`);

    // Drawing the solved inside directly gives the same sheet.
    const inner=generateDieline(input(style,{...made.inner,dimensionMode:'inner'}));
    close(inner.bounds.width,made.bounds.width,0.05,`${style.id} sheet width`);
    close(inner.bounds.height,made.bounds.height,0.05,`${style.id} sheet height`);
  }
});

// The pizza box template draws the same panels whatever the board.
const IGNORES_THICKNESS=new Set(['pizza-box']);

test('a thicker board grows the sheet for the same inside and shrinks the inside for the same outside',()=>{
  for(const style of DIELINE_STYLES.filter(item=>MEASURED[item.id])){
    const thin=style.defaults.thickness,thick=thin*2;
    const a=measure(style,generateDieline(input(style,{thickness:thin}))),b=measure(style,generateDieline(input(style,{thickness:thick})));
    for(const axis of AXES) assert.ok(b[axis]>=a[axis]-0.01,`${style.id}: a thicker board shrank the ${axis}`);
    if(!IGNORES_THICKNESS.has(style.id)) assert.ok(AXES.some(axis=>b[axis]>a[axis]+thin/4),`${style.id}: a thicker board should need bigger panels`);
    const outerThin=generateDieline(input(style,{thickness:thin,dimensionMode:'outer'})),outerThick=generateDieline(input(style,{thickness:thick,dimensionMode:'outer'}));
    for(const axis of AXES) assert.ok(outerThick.inner[axis]<outerThin.inner[axis],`${style.id}: outer ${axis} with a thicker board`);
  }
});

test('inches give the same sheet as millimetres',()=>{
  for(const style of DIELINE_STYLES){
    for(const mode of style.modes){
      const mm=generateDieline(input(style,{dimensionMode:mode}));
      const d=style.defaults;
      const inches=generateDieline(input(style,{length:d.length/MM_PER_IN,width:d.width/MM_PER_IN,depth:d.depth/MM_PER_IN,thickness:d.thickness/MM_PER_IN,units:'in',dimensionMode:mode}));
      close(inches.bounds.width,mm.bounds.width,0.01,`${style.id} ${mode} width`);
      close(inches.bounds.height,mm.bounds.height,0.01,`${style.id} ${mode} height`);
      for(const axis of AXES) close(inches.inner[axis],mm.inner[axis],0.01,`${style.id} ${mode} inner ${axis}`);
    }
  }
});

test('a style sized by its outside says so when asked for another mode',()=>{
  const pillow=getDielineStyle('pillow-box');
  assert.deepEqual(pillow.modes,['outer']);
  const output=generateDieline(input(pillow,{dimensionMode:'inner'}));
  assert.equal(output.warnings.length,1);
  assert.match(output.warnings[0],/outside/);
});

test('sizes a box cannot be made at are refused in plain words',()=>{
  const style=getDielineStyle('reverse-tuck-end');
  assert.throws(()=>generateDieline(input(style,{length:0})),/length above zero/);
  assert.throws(()=>generateDieline(input(style,{thickness:0})),/thickness above zero/);
  assert.throws(()=>generateDieline(input(style,{depth:1,thickness:3,dimensionMode:'outer'})),/too small/);
});

test('style sizes from the options change the sheet',()=>{
  const style=getDielineStyle('reverse-tuck-end');
  assert.ok(style.params.length>0);
  const param=style.params[0];
  const base=generateDieline(input(style));
  const changed=generateDieline(input(style,{options:{[param.key]:20}}));
  assert.notDeepEqual(changed.paths,base.paths,`${param.key} had no effect`);
});

test('every piece has one closed cut outline that does not cross itself',()=>{
  for(const style of DIELINE_STYLES){
    const output=generateDieline(input(style,{dimensionMode:style.modes[0]}));
    const pieces=pieceOutlines(segments(output,'cut'),output.panels.map(panel=>panel.polygon));
    const expected=['drawer-box','rigid-lid-and-base','telescope-box'].includes(style.id)?2:1;
    assert.equal(pieces.length,expected,`${style.id} pieces`);
    for(const piece of pieces){
      assert.ok(isClosed([...piece,piece[0]]),`${style.id}: an outline is open`);
      assert.equal(selfIntersects(piece),false,`${style.id}: an outline crosses itself`);
      assert.ok(Math.abs(signedArea(piece))>100,`${style.id}: an outline has no area`);
    }
    // Every cut line lies on the sheet.
    for(const [a,b] of segments(output,'cut')) for(const point of [a,b]){
      assert.ok(point[0]>=-0.01&&point[0]<=output.bounds.width+0.01&&point[1]>=-0.01&&point[1]<=output.bounds.height+0.01,`${style.id}: a cut leaves the sheet`);
    }
  }
});

test('every folding panel hangs off a real panel along a shared crease',()=>{
  for(const style of DIELINE_STYLES){
    const output=generateDieline(input(style,{dimensionMode:style.modes[0]}));
    const ids=new Set(output.panels.map(panel=>panel.id));
    const folding=output.panels.filter(panel=>panel.foldParent);
    assert.ok(folding.length>=1,`${style.id}: no panel folds`);
    for(const panel of folding){
      assert.ok(ids.has(panel.foldParent),`${style.id}: ${panel.id} folds on a missing panel`);
      assert.ok(Number.isFinite(panel.foldAngle)&&Math.abs(panel.foldAngle)<=180,`${style.id}: ${panel.id} fold angle`);
      assert.ok(panel.foldAxis,`${style.id}: ${panel.id} has no fold axis`);
      const [a,b]=panel.foldAxis;
      assert.ok(Math.hypot(b[0]-a[0],b[1]-a[1])>1,`${style.id}: ${panel.id} fold axis is a point`);
    }
    // No panel folds on itself through a loop.
    const parent=new Map(folding.map(panel=>[panel.id,panel.foldParent]));
    for(const id of parent.keys()){
      const seen=new Set();
      for(let at=id;parent.has(at);at=parent.get(at)){assert.ok(!seen.has(at),`${style.id}: fold loop at ${id}`);seen.add(at);}
    }
  }
});

test('the SVG matches the golden file for each style',()=>{
  const update=process.env.UPDATE_DIELINE_SNAPSHOTS==='1';
  if(update) fs.mkdirSync(SNAPSHOTS,{recursive:true});
  for(const style of DIELINE_STYLES){
    const svg=dielineToSvg(generateDieline(input(style,{dimensionMode:style.modes[0]})),{title:style.name,annotations:true});
    const file=path.join(SNAPSHOTS,`${style.id}.svg`);
    if(update) fs.writeFileSync(file,svg);
    else assert.equal(svg,fs.readFileSync(file,'utf8'),`${style.id}.svg changed: if intended, regenerate with UPDATE_DIELINE_SNAPSHOTS=1`);
  }
});

test('the SVG has a layer per line type at the sheet size in millimetres',()=>{
  const style=getDielineStyle('reverse-tuck-end');
  const output=generateDieline(input(style));
  const svg=dielineToSvg(output,{title:'A <test> & box'});
  assert.match(svg,/<svg[^>]+width="[\d.]+mm" height="[\d.]+mm"/);
  for(const type of ['cut','crease','bleed','safe']) assert.match(svg,new RegExp(`<g id="${type}"[^>]*inkscape:groupmode="layer"`));
  assert.doesNotMatch(svg,/<test>/);
  const only=dielineToSvg(output,{layers:['cut']});
  assert.match(only,/id="cut"/);
  assert.doesNotMatch(only,/id="crease"/);
  // The cut lines span the sheet exactly.
  const cut=box(segments(output,'cut').flat());
  close(cut.x,output.bounds.width,0.01,'cut width');
  close(cut.y,output.bounds.height,0.01,'cut height');
});

test('the Cricut SVG is sized in inches with only cut and score groups',()=>{
  for(const style of DIELINE_STYLES){
    const output=generateDieline(input(style,{dimensionMode:style.modes[0]}));
    const svg=dielineToCricutSvg(output,style.name);
    const size=svg.match(/width="([\d.]+)in" height="([\d.]+)in"/);
    assert.ok(size,`${style.id} has no size in inches`);
    close(Number(size[1])*MM_PER_IN,output.bounds.width,0.01,`${style.id} width`);
    close(Number(size[2])*MM_PER_IN,output.bounds.height,0.01,`${style.id} height`);
    assert.match(svg,/<g id="Cut"/);
    assert.match(svg,/<g id="Score"/);
    assert.doesNotMatch(svg,/bleed|safe|<text/i);
  }
});

test('the DXF holds every cut and crease line, in millimetres, the same size as the sheet',()=>{
  for(const style of DIELINE_STYLES){
    const output=generateDieline(input(style,{dimensionMode:style.modes[0]}));
    const dxf=dielineToDxf(output);
    const codes=dxf.trim().split('\n');
    assert.equal(codes[codes.length-1],'EOF');
    assert.match(dxf,/\$INSUNITS\n70\n4\n/);
    const lines={CUT:0,CREASE:0,PERF:0};
    const points=[];
    for(let i=0;i<codes.length-1;i+=2){
      if(codes[i]==='0'&&codes[i+1]==='LINE'){
        const entity={};
        for(let j=i+2;j<codes.length-1&&codes[j]!=='0';j+=2) entity[codes[j]]=codes[j+1];
        lines[entity['8']]++;
        points.push([Number(entity['10']),Number(entity['20'])],[Number(entity['11']),Number(entity['21'])]);
      }
    }
    assert.equal(lines.CUT,segments(output,'cut').length,`${style.id} cut lines`);
    assert.equal(lines.CREASE,segments(output,'crease').length,`${style.id} crease lines`);
    const extent=box(points);
    close(extent.x,output.bounds.width,0.01,`${style.id} DXF width`);
    close(extent.y,output.bounds.height,0.01,`${style.id} DXF height`);
    assert.ok(extent.minX>=-0.01&&extent.minY>=-0.01,`${style.id}: the DXF has negative coordinates`);
  }
});

test('the PDF is one page at full size, or tiles across A4 pages',async()=>{
  const style=getDielineStyle('shipping-box-rsc');
  const output=generateDieline(input(style));
  const single=await PDFDocument.load(await dielineToPdf(output,{title:style.name,annotations:true}));
  assert.equal(single.getPageCount(),1);
  const {width,height}=single.getPage(0).getSize();
  // The sheet plus 6 mm round it for bleed and labels, a 15 mm margin and a 16 mm legend.
  close(width/(72/MM_PER_IN),output.bounds.width+12+30,0.05,'page width');
  close(height/(72/MM_PER_IN),output.bounds.height+12+30+16,0.05,'page height');
  assert.equal(single.getTitle(),style.name);

  const tiled=await PDFDocument.load(await dielineToPdf(output,{tile:'a4'}));
  assert.ok(tiled.getPageCount()>1,'a shipping carton needs more than one A4 page');
  for(const page of tiled.getPages()){
    const size=page.getSize();
    const sides=[size.width,size.height].map(value=>Math.round(value/(72/MM_PER_IN))).sort((a,b)=>a-b);
    assert.deepEqual(sides,[210,297]);
  }
  const letter=await PDFDocument.load(await dielineToPdf(output,{tile:'letter'}));
  const page=letter.getPage(0).getSize();
  assert.deepEqual([page.width,page.height].map(value=>Math.round(value)).sort((a,b)=>a-b),[612,792]);
});
