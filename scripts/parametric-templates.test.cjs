/* eslint-disable @typescript-eslint/no-require-imports */
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
const {compileParametricTemplate,TemplateDefinitionError}=require('../src/lib/packaging/parametric/compile.ts');
const {evaluate,interpolate}=require('../src/lib/packaging/parametric/expression.ts');
const {expandRepeats}=require('../src/lib/packaging/parametric/repeat.ts');
const {splitTopDefinition}=require('../src/lib/packaging/parametric/definitions/split-top.ts');
// The hand-written split top this definition replaced, frozen for comparison.
const {splitTopReferenceRuntime:splitTopRuntime}=require('./reference/split-top-handwritten.ts');
const {getTemplateRuntime}=require('../src/lib/packaging/template-runtime.ts');
const {splitTopSheet,splitTopExportGeometry}=require('../src/lib/packaging/templates/split-top/geometry.ts');
const {baseBoxSheet}=require('./reference/tuck-end/base-box-geometry.ts');
const {tuckEndBodySizes,tuckEndLidSizes}=require('./reference/tuck-end/tuck-end.ts');

// Same shape and values, numbers within a hair (expressions and hand-written
// code may round differently in the last bit).
function assertClose(actual,expected,where='value'){
  if(typeof expected==='number'){
    assert.equal(typeof actual,'number',`${where} is not a number`);
    assert.ok(Math.abs(actual-expected)<=1e-9*Math.max(1,Math.abs(expected)),`${where}: ${actual} differs from ${expected}`);
    return;
  }
  if(expected===null||typeof expected!=='object'){assert.equal(actual,expected,where);return;}
  if(ArrayBuffer.isView(expected)||Array.isArray(expected)){
    assert.equal(actual.length,expected.length,`${where} length`);
    for(let i=0;i<expected.length;i++)assertClose(actual[i],expected[i],`${where}[${i}]`);
    return;
  }
  const keys=Object.keys(expected).filter(key=>expected[key]!==undefined);
  assert.deepEqual(Object.keys(actual).filter(key=>actual[key]!==undefined).sort(),keys.sort(),`${where} keys`);
  for(const key of keys)assertClose(actual[key],expected[key],`${where}.${key}`);
}

const fixtures=[
  {width:400,height:300,depth:300,thickness:3},
  {width:120,height:180,depth:55,thickness:0.5},
  {width:610,height:150,depth:95,thickness:7},
  {width:60,height:40,depth:50,thickness:1.5},
];
const sides=['side_a','side_b'];
const parametric=compileParametricTemplate(splitTopDefinition);

test('expressions follow arithmetic precedence and reach nothing but their scope',()=>{
  assert.equal(evaluate('1 + 2 * 3 - 4 / 2',{}),5);
  assert.equal(evaluate('-(a + b) * 2',{a:1,b:2}),-6);
  assert.equal(evaluate('a > 1 && b < 1 ? 10 : a >= 1 || b ? 20 : 30',{a:1,b:0}),20);
  assert.equal(evaluate('max(1, min(5, 3), clamp(9, 0, 4))',{}),4);
  assert.equal(evaluate('!x + front.width % 4',{x:0,'front.width':10}),3);
  assert.equal(evaluate('2.5e1 + .5',{}),25.5);
  assert.equal(interpolate('at least {joint + 5} mm',{joint:35}),'at least 40 mm');
  for(const source of ['constructor','process.env','toString','a b','1 +','max(1','eval(1)','a = 1','x[0]','"s"']){
    assert.throws(()=>evaluate(source,{a:1}),Error,source);
  }
  assert.throws(()=>evaluate('1 / 0',{}),/finite/);
});

test('the parametric split top cleans sizes exactly as the hand-written one',()=>{
  for(const input of [...fixtures,{width:NaN,height:-5,depth:Infinity,thickness:99},{width:0.2,height:1e6,depth:3,thickness:0}]){
    assert.deepEqual(parametric.sanitizeParameters(input),splitTopRuntime.sanitizeParameters(input));
  }
});

test('the parametric split top refuses the same undersized boxes with the same messages',()=>{
  for(const dimensions of [{width:30,height:300,depth:300,thickness:3},{width:300,height:300,depth:20,thickness:3},{width:300,height:10,depth:300,thickness:3}]){
    assert.throws(()=>splitTopRuntime.getExportGeometry(dimensions));
    const message=(()=>{try{splitTopRuntime.getExportGeometry(dimensions);}catch(error){return error.message;}})();
    assert.throws(()=>parametric.getExportGeometry(dimensions),{message});
  }
});

// The split top's die and fold matched the hand-written reference until the
// flaps on the glued end wall were lengthened to end in line with the flaps
// opposite them; the reference still checks sizes, limits and assembly.
test('the closed split top has every pair of matching flaps ending in line', () => {
  const extent = (meshes, id) => {
    const mesh = meshes.find(item => item.panel === id);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < mesh.vertices.length; i += 8) { lo = Math.min(lo, mesh.vertices[i + 2]); hi = Math.max(hi, mesh.vertices[i + 2]); }
    return [lo, hi];
  };
  for (const dimensions of fixtures) for (const side of sides) {
    const meshes = parametric.buildMeshes({ dimensions, formation: 100, opening: 0, openingMode: 'top_split_meet_center', splitTopHingeSide: side, color: [1, 1, 1], interiorColor: [1, 1, 1] });
    for (const end of ['Top', 'Bottom']) {
      const left = extent(meshes, `${end} Left`), right = extent(meshes, `${end} Right`);
      assertClose(left, right, `${JSON.stringify(dimensions)} ${side} ${end}`);
    }
  }
});

test('the parametric split top keeps the same assembly behaviour',()=>{
  const {hasOpeningStage,...assembly}=parametric.assembly;
  const {hasOpeningStage:expectedStage,...expected}=splitTopRuntime.assembly;
  assert.deepEqual(JSON.parse(JSON.stringify(assembly)),expected);
  for(const mode of ['closed','top_split_meet_center','lid_from_back'])assert.equal(hasOpeningStage(mode),expectedStage(mode));
  for(const key of ['templateId','structureKey','rendererKey','exportSummary','exportArtworkNote'])assert.equal(parametric[key],splitTopRuntime[key]);
});

test('the studio and the public template pages use the definition',()=>{
  const live=getTemplateRuntime('split-top-box');
  const dimensions=fixtures[0];
  assertClose(live.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}),parametric.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
  const input={dimensions,formation:60,opening:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]};
  assertClose(live.buildMeshes(input),parametric.buildMeshes(input));
  assertClose(splitTopSheet(dimensions,'side_b'),parametric.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
  assertClose(splitTopExportGeometry(dimensions),parametric.getExportGeometry(dimensions));
});

// The straight tuck end's thumb-notched back and rounded top tuck, written
// with arcs and fold shapes, with sizes taken from the hand-written die.
function tuckPanelsDefinition(d){
  const body=tuckEndBodySizes(d),lid=tuckEndLidSizes(d,'front');
  const hand=Object.fromEntries(baseBoxSheet(d,'closed').panels.map(panel=>[panel.id,panel]));
  const back=hand.back.fold;
  return {
    format:'parametric-template/1',templateId:'tuck-arcs',structureKey:'tuck-arcs',rendererKey:'tuck-arcs',
    parameters:{width:{fallback:d.width},height:{fallback:d.height},depth:{fallback:d.depth},thickness:{fallback:d.thickness}},
    derived:[
      ['x0',back[0].x],['y0',back[0].y],['wallWidth',back[1].x-back[0].x],['y1',back[2].y],
      ['notch',Math.min(10,body.inside.back/6)],
      ['hingeY',hand.top.y],['l',hand.top.x+body.tuckInset],['r',hand.top.x+lid.width-body.tuckInset],
      ['tongue',lid.tongue],['shoulder',lid.shoulder],['radius',lid.radius],
      ['tip','hingeY - tongue'],['bevel','radius * (1 - sqrt(0.5))'],
    ],
    panels:[
      // Plain walls and lid linking the back and the tuck, as on the real die.
      ...['front','right','top'].map(id=>({id,label:id.toUpperCase(),kind:hand[id].kind,rect:[hand[id].x,hand[id].y,hand[id].width,hand[id].height]})),
      {id:'back',label:'BACK',kind:'body',
        outline:[['x0','y0'],{arc:{center:['x0 + wallWidth / 2','y0'],radius:'notch',from:180,to:0,segments:12}},['x0 + wallWidth','y0'],['x0 + wallWidth','y1'],['x0','y1']],
        fold:[['x0','y0'],['x0 + wallWidth','y0'],['x0 + wallWidth','y1'],['x0','y1']]},
      {id:'top-tuck',label:'TOP TUCK',kind:'flap',
        outline:[['l','hingeY'],['r','hingeY'],['r','hingeY - shoulder'],
          {arc:{center:['r - radius','tip + radius'],radius:'radius',from:0,to:-90}},
          {arc:{center:['l + radius','tip + radius'],radius:'radius',from:-90,to:-180}},
          ['l','hingeY - shoulder']],
        fold:[['l','hingeY'],['r','hingeY'],['r - bevel','tip'],['l + bevel','tip']]},
    ],
    notes:[],
    fold:{root:'front',thickness:'thickness',offset:[0,0,0],hinges:[
      {child:'right',parent:'front',drive:'formation',from:0,to:0.5},
      {child:'back',parent:'right',drive:'formation',from:0,to:0.5},
      {child:'top',parent:'front',drive:'formation',from:0.5,to:1},
      {child:'top-tuck',parent:'top',drive:'formation',from:0.5,to:1},
    ]},
    assembly:{control:'none',defaultOpeningMode:'closed',openingStage:'never'},
    export:{kind:'cutting-template'},
  };
}

test('arcs and fold shapes draw the tuck end die\'s thumb notch and rounded tuck exactly',()=>{
  for(const d of [{width:65,height:160,depth:65,thickness:0.5},{width:240,height:100,depth:160,thickness:0.4},{width:20,height:24,depth:10,thickness:0.3}]){
    const hand=Object.fromEntries(baseBoxSheet(d,'closed').panels.map(panel=>[panel.id,panel]));
    const runtime=compileParametricTemplate(tuckPanelsDefinition(d));
    const panels=Object.fromEntries(runtime.getDielinePanels(d).map(panel=>[panel.id,panel]));
    for(const id of ['back','top-tuck']){
      assertClose(panels[id].outline,hand[id].outline,`${id} outline`);
      assertClose(panels[id].fold,hand[id].fold,`${id} fold`);
      for(const key of ['x','y','width','height'])assertClose(panels[id][key],hand[id][key],`${id}.${key}`);
    }
    // The model folds the four-corner shape: one face per side, not the curve's points.
    const meshes=runtime.buildMeshes({dimensions:d,formation:0,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    const tuck=meshes.find(mesh=>mesh.panel==='Top Tuck');
    assertClose(tuck.pickCorners.map(([x,y])=>({x,y:-y})),hand['top-tuck'].fold,'tuck pick corners');
  }
});

test('a definition survives a JSON round trip unchanged',()=>{
  const fromJson=compileParametricTemplate(JSON.parse(JSON.stringify(splitTopDefinition)));
  const dimensions=fixtures[0];
  assertClose(fromJson.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}),parametric.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
});

test('authoring mistakes are refused when the definition is compiled',()=>{
  // Mistakes are made on the expanded definition, where every panel and hinge is listed.
  const expanded=expandRepeats(splitTopDefinition,message=>{throw new Error(message);});
  const broken=change=>{const copy=structuredClone(expanded);change(copy);return ()=>compileParametricTemplate(copy);};
  const cases=[
    [copy=>{copy.format='parametric-template/9';},/unsupported format/],
    [copy=>{copy.panels.push({...copy.panels[1]});},/defined twice/],
    [copy=>{copy.fold.hinges=copy.fold.hinges.filter(h=>h.child!=='topLeft');},/"topLeft" is not attached/],
    [copy=>{copy.fold.hinges.push({child:'topLeft',parent:'front',drive:'closing',from:0,to:1});},/more than one panel/],
    [copy=>{copy.fold.hinges.find(h=>h.child==='right').parent='back';},/loop back/],
    [copy=>{copy.fold.hinges[0].parent='lid';},/unknown panel "lid"/],
    [copy=>{copy.derived.push(['oops','wdth + 1']);},/Unknown value "wdth"/],
    [copy=>{copy.panels[1].rect[2]='long +';},/ends too early/],
    [copy=>{copy.validations[0].message='at least {jiont} mm';},/Unknown value "jiont"/],
    [copy=>{copy.fold.offset[0]='-(lid.x)';},/Unknown value "lid.x".*side_a/],
    [copy=>{copy.panels[1]={...copy.panels[1],rect:undefined,outline:[[0,0],{arc:{center:[0,0],radius:5,from:0,to:90}},[0,5]]};delete copy.panels[1].rect;},/"front" needs a four-corner fold shape/],
    [copy=>{copy.panels[2].fold=[[0,0],[1,0],[1,1]];},/"topFront" needs a four-corner fold shape/],
  ];
  for(const [change,error] of cases){
    assert.throws(broken(change),error);
    assert.throws(broken(change),TemplateDefinitionError);
  }
});

// The tuck end cartons, against their hand-written versions.
const {baseBoxDefinition}=require('../src/lib/packaging/parametric/definitions/base-box.ts');
const {reverseTuckDefinition}=require('../src/lib/packaging/parametric/definitions/reverse-tuck.ts');
// The hand-written versions these definitions replaced, frozen for comparison.
const tuckReference={
  base:require('./reference/tuck-end/base-box-runtime.ts').baseBoxRuntime,
  reverse:require('./reference/tuck-end/reverse-tuck-runtime.ts').reverseTuckRuntime,
};
const tuckFixtures=[
  {width:65,height:160,depth:65,thickness:0.5},
  {width:120,height:180,depth:55,thickness:0.5},
  {width:240,height:100,depth:160,thickness:0.4},
  {width:20,height:24,depth:10,thickness:0.3},
  {width:300,height:40,depth:30,thickness:2},
  {width:15,height:20,depth:8,thickness:5},
];
const OPENING_MODES=['closed','lid_from_back','lid_from_front','lid_from_left','lid_from_right','top_split_meet_center','door_left','door_right','double_doors'];
const STAGES=[[0,0],[30,0],[50,0],[60,0],[64,0],[70,0],[80,0],[85,0],[89,0],[92,0],[94.5,0],[96,0],[98,0],[100,0],[95,60],[100,40],[100,100]];

function assertSameTemplate(parametric,reference,modes){
  for(const input of [...tuckFixtures,{width:NaN,height:-5,depth:Infinity,thickness:99}]){
    assert.deepEqual(parametric.sanitizeParameters(input),reference.sanitizeParameters(input));
  }
  for(const dimensions of tuckFixtures)for(const openingMode of modes){
    const options={openingMode};
    const label=`${JSON.stringify(dimensions)} ${openingMode}`;
    assertClose(parametric.getDielinePanels(dimensions,options),reference.getDielinePanels(dimensions,options),`${label} panels`);
    assertClose(parametric.getDielineBounds(dimensions,options),reference.getDielineBounds(dimensions,options),`${label} bounds`);
    let expected,expectedError;
    try{expected=reference.getExportGeometry(dimensions,options);}catch(error){expectedError=error.message;}
    if(expectedError)assert.throws(()=>parametric.getExportGeometry(dimensions,options),{message:expectedError});
    else assertClose(parametric.getExportGeometry(dimensions,options),expected,`${label} export`);
    for(const [formation,opening] of STAGES){
      const input={dimensions,formation,opening,openingMode,splitTopHingeSide:'side_a',color:[0.8,0.7,0.6],interiorColor:[0.9,0.9,0.9]};
      assertClose(parametric.buildMeshes(input),reference.buildMeshes(input),`${label} ${formation}/${opening}`);
    }
  }
  const {hasOpeningStage,...assembly}=parametric.assembly;
  const {hasOpeningStage:expectedStage,...expected}=reference.assembly;
  assert.deepEqual(JSON.parse(JSON.stringify(assembly)),JSON.parse(JSON.stringify(expected)));
  for(const mode of OPENING_MODES)assert.equal(hasOpeningStage(mode),expectedStage(mode),mode);
  for(const key of ['templateId','structureKey','rendererKey','exportSummary','exportArtworkNote'])assert.equal(parametric[key],reference[key]);
}

test('the parametric straight tuck end (base box) matches the hand-written one in every opening mode',()=>{
  assertSameTemplate(compileParametricTemplate(baseBoxDefinition),tuckReference.base,OPENING_MODES);
});

test('the parametric reverse tuck end matches the hand-written one',()=>{
  assertSameTemplate(compileParametricTemplate(reverseTuckDefinition),tuckReference.reverse,['closed']);
});

test('the studio, layout migrations and template pages build the tuck end cartons from their definitions',()=>{
  const {baseBoxSheet:liveBaseSheet}=require('../src/lib/packaging/templates/base-box/geometry.ts');
  const {reverseTuckSheet,reverseTuckExportGeometry}=require('../src/lib/packaging/templates/reverse-tuck/export.ts');
  const {templatePreviewGeometry}=require('../src/lib/packaging/template-preview.ts');
  const dimensions=tuckFixtures[2];
  for(const [id,reference] of [['base-box',tuckReference.base],['reverse-tuck-carton',tuckReference.reverse]]){
    const live=getTemplateRuntime(id);
    assertClose(live.getExportGeometry(dimensions,{openingMode:'lid_from_left'}),reference.getExportGeometry(dimensions,{openingMode:'lid_from_left'}),id);
    const input={dimensions,formation:95,opening:30,openingMode:'door_left',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]};
    assertClose(live.buildMeshes(input),reference.buildMeshes(input),id);
  }
  assert.equal(getTemplateRuntime('reverse-tuck-carton').getFoldState,tuckReference.reverse.getFoldState);
  assertClose(liveBaseSheet(dimensions,'lid_from_right'),tuckReference.base.getExportGeometry(dimensions,{openingMode:'lid_from_right'}));
  assertClose(reverseTuckSheet(dimensions),tuckReference.reverse.getExportGeometry(dimensions));
  assertClose(reverseTuckExportGeometry(dimensions),tuckReference.reverse.getExportGeometry(dimensions));
  assertClose(templatePreviewGeometry('reverse-tuck-carton',dimensions),tuckReference.reverse.getExportGeometry(dimensions));
});

test('variant mistakes are refused when the definition is compiled',()=>{
  const broken=change=>{const copy=structuredClone(baseBoxDefinition);change(copy);return ()=>compileParametricTemplate(copy);};
  const cases=[
    // Both the plain and the notched back apply when the lid is on the front.
    [copy=>{copy.panels.find(p=>p.id==='back'&&p.when.startsWith('!')).when='1';},/more than one variant of a panel applies/],
    [copy=>{copy.panels.push({...copy.panels.find(p=>p.id==='glue')});},/"glue" is defined twice; give every copy a "when"/],
    // No hinge holds the lid when it is on the right.
    [copy=>{copy.fold.hinges=copy.fold.hinges.filter(h=>h.when!=='topOnRight');},/"top" has no hinge here.*lid_from_right/],
    [copy=>{copy.fold.hinges.find(h=>h.when==='topOnLeft').when='topOnLeft || topOnFront';},/"top" hinges on more than one panel here/],
    [copy=>{copy.fold.hinges.push({child:'bottom-tuck',parent:'top-left-dust',when:'topOnLeft',angle:0});copy.fold.hinges.find(h=>h.child==='bottom-tuck'&&!h.when).when='!topOnLeft';},/hinges on "top-left-dust", which is left out here/],
    [copy=>{copy.fold.hinges.push({child:'top',parent:'glue',angle:0});},/"top" hinges on more than one panel; give every hinge/],
    [copy=>{copy.fold.motions.push(['oops','turnTp * 2']);},/Unknown value "turnTp"/],
  ];
  for(const [change,error] of cases){
    assert.throws(broken(change),error);
    assert.throws(broken(change),TemplateDefinitionError);
  }
});

test('the tuck end definitions survive a JSON round trip unchanged',()=>{
  for(const definition of [baseBoxDefinition,reverseTuckDefinition]){
    const fromJson=compileParametricTemplate(JSON.parse(JSON.stringify(definition)));
    const original=compileParametricTemplate(definition);
    const input={dimensions:tuckFixtures[0],formation:97,opening:50,openingMode:'lid_from_back',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]};
    assertClose(fromJson.getExportGeometry(tuckFixtures[0],{openingMode:'lid_from_back'}),original.getExportGeometry(tuckFixtures[0],{openingMode:'lid_from_back'}));
    assertClose(fromJson.buildMeshes(input),original.buildMeshes(input));
  }
});

// The pizza box, against its hand-written version.
const {pizzaBoxDefinition}=require('../src/lib/packaging/parametric/definitions/pizza-box.ts');
const {sleeveBoxDefinition}=require('../src/lib/packaging/parametric/definitions/sleeve-box.ts');
const {mailerBoxDefinition}=require('../src/lib/packaging/parametric/definitions/mailer-box.ts');
const {autoLockBottomDefinition}=require('../src/lib/packaging/parametric/definitions/auto-lock-bottom.ts');
const {snapLockBottomDefinition}=require('../src/lib/packaging/parametric/definitions/snap-lock-bottom.ts');
const {pillowBoxDefinition}=require('../src/lib/packaging/parametric/definitions/pillow-box.ts');
const {gableBoxDefinition}=require('../src/lib/packaging/parametric/definitions/gable-box.ts');
const {drawerBoxDefinition}=require('../src/lib/packaging/parametric/definitions/drawer-box.ts');
const {rigidLidBaseDefinition}=require('../src/lib/packaging/parametric/definitions/rigid-lid-base.ts');
// The hand-written version this definition replaced, frozen for comparison.
const pizzaReference=require('./reference/pizza-box/runtime.ts').pizzaBoxRuntime;

test('the parametric pizza box matches the hand-written one at every stage',()=>{
  const parametric=compileParametricTemplate(pizzaBoxDefinition);
  const sizes=[
    {width:305,height:45,depth:305,thickness:1.5},
    {width:240,height:35,depth:180,thickness:1},
    {width:460,height:60,depth:460,thickness:5},
    {width:90,height:15,depth:120,thickness:3},
  ];
  for(const input of [...sizes,{width:NaN,height:-5,depth:Infinity,thickness:99}]){
    assert.deepEqual(parametric.sanitizeParameters(input),pizzaReference.sanitizeParameters(input));
  }
  for(const dimensions of sizes){
    const label=JSON.stringify(dimensions);
    assertClose(parametric.getDielinePanels(dimensions),pizzaReference.getDielinePanels(dimensions),`${label} panels`);
    assertClose(parametric.getDielineBounds(dimensions),pizzaReference.getDielineBounds(dimensions),`${label} bounds`);
    let expected,expectedError;
    try{expected=pizzaReference.getExportGeometry(dimensions);}catch(error){expectedError=error.message;}
    if(expectedError)assert.throws(()=>parametric.getExportGeometry(dimensions),{message:expectedError});
    else assertClose(parametric.getExportGeometry(dimensions),expected,`${label} export`);
    for(const [formation,opening] of [[0,100],[25,100],[50,100],[65,100],[78,100],[90,100],[100,100],[100,60],[100,0]]){
      const input={dimensions,formation,opening,openingMode:'lid_from_back',splitTopHingeSide:'side_a',color:[0.8,0.7,0.6],interiorColor:[0.9,0.9,0.9]};
      assertClose(parametric.buildMeshes(input),pizzaReference.buildMeshes(input),`${label} ${formation}/${opening}`);
    }
  }
  const {hasOpeningStage,...assembly}=parametric.assembly;
  const {hasOpeningStage:expectedStage,...expected}=pizzaReference.assembly;
  assert.deepEqual(JSON.parse(JSON.stringify(assembly)),JSON.parse(JSON.stringify(expected)));
  for(const mode of OPENING_MODES)assert.equal(hasOpeningStage(mode),expectedStage(mode),mode);
  for(const key of ['templateId','structureKey','rendererKey','exportSummary','exportArtworkNote'])assert.equal(parametric[key],pizzaReference[key]);
});

test('the studio, layout migrations and template pages build the pizza box from its definition',()=>{
  const {pizzaBoxSheet,pizzaBoxExportGeometry}=require('../src/lib/packaging/templates/pizza-box/geometry.ts');
  const {templatePreviewGeometry}=require('../src/lib/packaging/template-preview.ts');
  const dimensions={width:305,height:45,depth:305,thickness:1.5};
  const expected=pizzaReference.getExportGeometry(dimensions);
  assertClose(getTemplateRuntime('pizza-box').getExportGeometry(dimensions),expected);
  assertClose(pizzaBoxSheet(dimensions),expected);
  assertClose(pizzaBoxExportGeometry(dimensions),expected);
  assertClose(templatePreviewGeometry('pizza-box',dimensions),expected);
  const input={dimensions,formation:88,opening:40,openingMode:'lid_from_back',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]};
  assertClose(getTemplateRuntime('pizza-box').buildMeshes(input),pizzaReference.buildMeshes(input));
});

test('every ready template is built from a parametric definition',()=>{
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const source=fs.readFileSync(path.resolve(__dirname,'../src/lib/packaging/templates',{'split-top-box':'split-top','base-box':'base-box','reverse-tuck-carton':'reverse-tuck','pizza-box':'pizza-box','sleeve-box':'sleeve-box','mailer-box':'mailer-box','rigid-lid-base':'rigid-lid-base','auto-lock-bottom-box':'auto-lock-bottom','snap-lock-bottom-box':'snap-lock-bottom','pillow-box':'pillow-box','gable-box':'gable-box','drawer-box':'drawer-box','tray-box':'tray-box','telescope-box':'telescope-box','cake-box':'cake-box'}[template.id],'runtime.ts'),'utf8');
    assert.match(source,/compileParametricTemplate\(/,`${template.id} is not built from a definition`);
  }
});

test('repeat blocks expand in order, keep value types, nest, and refuse unfilled placeholders',()=>{
  const fail=message=>{throw new Error(message);};
  const definition=structuredClone(splitTopDefinition);
  definition.notes=[{repeat:[{n:1},{n:2}],each:[{text:'note {{n}}',when:'{{n}}'},{repeat:[{m:'a'},{m:'b'}],each:[{text:'{{n}}{{m}}'}]}]}];
  const expanded=expandRepeats(definition,fail);
  assert.deepEqual(expanded.notes,[{text:'note 1',when:1},{text:'1a'},{text:'1b'},{text:'note 2',when:2},{text:'2a'},{text:'2b'}]);
  // Twelve flaps and four walls from one block, in the order the hand-written die listed them.
  assert.deepEqual(expandRepeats(splitTopDefinition,fail).panels.map(panel=>panel.id),['glue','front','topFront','bottomFront','right','topRight','bottomRight','back','topBack','bottomBack','left','topLeft','bottomLeft']);
  const panels=expandRepeats(splitTopDefinition,fail).panels;
  assert.deepEqual(panels.find(panel=>panel.id==='bottomBack').artworkFallback,{name:'Bottom',uv:[0,0,1,0.5]});
  assert.equal('artworkFallback' in panels.find(panel=>panel.id==='bottomLeft'),false);
  assert.equal(panels.find(panel=>panel.id==='bottomFront').layer,3);
  definition.notes=[{repeat:[{n:1}],each:[{text:'{{missing}}'}]}];
  assert.throws(()=>compileParametricTemplate(definition),/Template split-top-box: "\{\{missing\}\}" has no value/);
});

test('every catalog entry agrees with its definition',()=>{
  const {panelName}=require('../src/lib/packaging/templates/folded-box.ts');
  const {getPackagingTemplate}=require('../src/lib/packaging/template-registry.ts');
  const definitions=[splitTopDefinition,baseBoxDefinition,reverseTuckDefinition,pizzaBoxDefinition,sleeveBoxDefinition,mailerBoxDefinition,rigidLidBaseDefinition,autoLockBottomDefinition,snapLockBottomDefinition,pillowBoxDefinition,gableBoxDefinition,drawerBoxDefinition];
  for(const definition of definitions){
    const catalog=definition.catalog;
    assert.ok(catalog,`${definition.templateId} has no catalog entry`);
    const template=getPackagingTemplate(definition.templateId);
    assert.equal(template.status,'ready');
    assert.equal(template.name,catalog.name);
    // Every artwork region names a panel this template has, in any of its variants.
    const names=new Set(expandRepeats(definition,message=>{throw new Error(message);}).panels.map(panel=>panel.name??panelName(panel.label)));
    for(const region of catalog.artworkRegions){
      const panel=region.surface==='inside'?region.panelId.replace(/^Interior /,''):region.panelId;
      assert.ok(names.has(panel),`${definition.templateId} region ${region.id} names no panel ("${region.panelId}")`);
      assert.equal(region.surface==='inside',region.panelId.startsWith('Interior '),`${definition.templateId} region ${region.id} surface`);
    }
    assert.equal(new Set(catalog.artworkRegions.map(region=>region.id)).size,catalog.artworkRegions.length,`${definition.templateId} repeats a region id`);
    // The size controls start at the default box, which the definition accepts as is.
    for(const parameter of catalog.parameters)assert.equal(parameter.defaultValue,catalog.defaultDimensions[parameter.key],`${definition.templateId} ${parameter.key} default`);
    const runtime=compileParametricTemplate(definition);
    assert.deepEqual(runtime.sanitizeParameters(catalog.defaultDimensions),catalog.defaultDimensions,`${definition.templateId} default size is clamped`);
    if(catalog.fixedOpeningMode)assert.equal(catalog.fixedOpeningMode,definition.assembly.defaultOpeningMode,`${definition.templateId} opening mode`);
  }
});

test('the sleeve folds into an open tube of the entered size',()=>{
  const within=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} differs from ${b} by more than ${tol}`);
  const sleeve=getTemplateRuntime('sleeve-box');
  for(const dimensions of [{width:180,height:120,depth:60,thickness:0.5},{width:40,height:300,depth:25,thickness:1.2}]){
    const bounds=meshes=>{
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for(const mesh of meshes)for(let i=0;i<mesh.vertices.length;i+=8)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],mesh.vertices[i+k]);hi[k]=Math.max(hi[k],mesh.vertices[i+k]);}
      return hi.map((v,k)=>v-lo[k]);
    };
    const input=formation=>({dimensions,formation,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    const [x,y,z]=bounds(sleeve.buildMeshes(input(100)));
    const t=dimensions.thickness;
    // Outside of the folded tube: the inside opening plus the board on each side.
    within(x,dimensions.width+2*t,3*t,'folded width');
    within(z,dimensions.depth+2*t,3*t,'folded depth');
    within(y,dimensions.height,0.01,'sleeve length');
    // Flat before forming: the whole strip lies in one plane.
    assert.ok(bounds(sleeve.buildMeshes(input(0)))[2]<2*t,'flat sheet');
    // Open ends: no panel crosses the top or bottom of the walls.
    const sheet=sleeve.getExportGeometry(dimensions);
    assert.deepEqual(sheet.panels.map(panel=>panel.id),['glue','left','front','right','back']);
    assert.ok(sheet.panels.every(panel=>panel.y>=0&&panel.y+panel.height<=dimensions.height+1e-9));
  }
  assert.throws(()=>sleeve.getExportGeometry({width:15,height:120,depth:60,thickness:0.5}),/at least 20 mm/);
});

test('the auto-lock bottom creases its glue tabs at 45° and folds its bottom in layers',()=>{
  const within=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} differs from ${b} by more than ${tol}`);
  const box=getTemplateRuntime('auto-lock-bottom-box');
  for(const dimensions of [{width:100,height:140,depth:70,thickness:0.5},{width:90,height:320,depth:90,thickness:0.6},{width:30,height:40,depth:20,thickness:0.3},{width:300,height:200,depth:200,thickness:2}]){
    const t=dimensions.thickness;
    const sheet=box.getExportGeometry(dimensions);
    // Each side flap's glue tab folds on a 45° crease from the corner, which is a crease and never a cut.
    const diagonal=line=>Math.abs(Math.abs(line.end.x-line.start.x)-Math.abs(line.end.y-line.start.y))<1e-6&&Math.abs(line.end.x-line.start.x)>5; // longer than the tabs' 45° corner chamfers
    assert.equal(sheet.crease.filter(diagonal).length,2,'two 45° glue tab creases');
    assert.equal(sheet.cut.filter(diagonal).length,0,'no cut along a glue tab crease');
    for(const wall of ['left','right']){
      const flap=sheet.panels.find(panel=>panel.id===`bottom-${wall}`),tab=sheet.panels.find(panel=>panel.id===`bottom-${wall}-tab`);
      assert.ok(flap&&tab,`${wall} flap and tab`);
      // The tab sits at the corner by the next wall, where the flat carton folds.
      const wallPanel=sheet.panels.find(panel=>panel.id===wall);
      within(Math.max(...tab.outline.map(point=>point.x)),wallPanel.x+wallPanel.width,1e-6,`${wall} tab at the corner`);
    }
    // The front and back flaps reach past the middle, so the bottom is closed.
    const reach=id=>{const panel=sheet.panels.find(p=>p.id===id);return Math.max(...panel.outline.map(point=>point.y))-panel.y;};
    for(const id of ['bottom-front','bottom-back'])assert.ok(reach(id)>dimensions.depth/2,`${id} reaches past the middle`);
    // Folded: from the outside in, the front and back flaps, the glue tabs, then the side flaps, without crossing.
    const levels={};
    for(const mesh of box.buildMeshes({dimensions,formation:100,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]})){
      if(typeof mesh.panel!=='string'||!/Bottom|(Left|Right) Glue$/.test(mesh.panel))continue;
      const id=mesh.panel.replace(/^Interior /,'');
      const level=levels[id]??=[Infinity,-Infinity];
      for(let i=1;i<mesh.vertices.length;i+=8){level[0]=Math.min(level[0],mesh.vertices[i]);level[1]=Math.max(level[1],mesh.vertices[i]);}
    }
    const below=(a,b)=>assert.ok(levels[a][1]<=levels[b][0]+1e-3,`${a} (${levels[a]}) under ${b} (${levels[b]})`);
    below('Bottom Back','Bottom Front');
    below('Bottom Front','Left Glue');
    below('Bottom Front','Right Glue');
    below('Left Glue','Bottom Left');
    below('Right Glue','Bottom Right');
    for(const id of Object.keys(levels))assert.ok(levels[id][1]-levels[id][0]<=t+1e-3,`${id} lies flat`);
  }
  assert.throws(()=>box.getExportGeometry({width:100,height:140,depth:15,thickness:0.5}),/at least 20 mm/);
  // On the design grid the glue tab's name sits inside its triangle, clear of the side flap's.
  const {panelLabelAnchor}=require('../src/lib/packaging/panel-label.ts');
  const sheet=box.getExportGeometry({width:100,height:140,depth:70,thickness:0.5});
  const anchor=panelLabelAnchor(sheet.panels.find(panel=>panel.id==='bottom-left-tab').outline,sheet.panels.find(panel=>panel.id==='bottom-left-tab'));
  assert.ok(anchor&&anchor.x>0.6&&anchor.y>0.6,'tab name toward its corner');
  for(const id of ['top-left-dust','glue','top'])assert.equal(panelLabelAnchor(sheet.panels.find(panel=>panel.id===id).outline,sheet.panels.find(panel=>panel.id===id)),null,`${id} name stays centred`);
});

test('the snap-lock bottom folds closed 1-2-3: side flaps inside, then the back flap, then the front',()=>{
  const box=getTemplateRuntime('snap-lock-bottom-box');
  for(const dimensions of [{width:90,height:130,depth:60,thickness:0.5},{width:30,height:40,depth:20,thickness:0.3},{width:300,height:200,depth:200,thickness:2}]){
    const t=dimensions.thickness;
    const sheet=box.getExportGeometry(dimensions);
    const panel=id=>sheet.panels.find(p=>p.id===id);
    const reach=id=>Math.max(...panel(id).outline.map(point=>point.y))-panel(id).y;
    // The front flap's tongue reaches past the back flap's edge but stops short of the back wall.
    const front=reach('bottom-front'),back=reach('bottom-back');
    assert.ok(front+back>dimensions.depth+t,'the tongue tucks under the back flap');
    assert.ok(front<dimensions.depth,'the tongue stops short of the back wall');
    // The back flap has a notch cut into its edge for the tongue.
    assert.ok(panel('bottom-back').outline.some(point=>point.y<panel('bottom-back').y+back-1),'half-moon notch');
    // Folded, from the outside in: the front flap, the back flap, the side flaps, without crossing.
    const levels={};
    for(const mesh of box.buildMeshes({dimensions,formation:100,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]})){
      if(typeof mesh.panel!=='string'||!/Bottom/.test(mesh.panel))continue;
      const id=mesh.panel.replace(/^Interior /,'');
      const level=levels[id]??=[Infinity,-Infinity];
      for(let i=1;i<mesh.vertices.length;i+=8){level[0]=Math.min(level[0],mesh.vertices[i]);level[1]=Math.max(level[1],mesh.vertices[i]);}
    }
    const below=(a,b)=>assert.ok(levels[a][1]<=levels[b][0]+1e-3,`${a} (${levels[a]}) under ${b} (${levels[b]})`);
    below('Bottom Front','Bottom Back');
    below('Bottom Back','Bottom Left');
    below('Bottom Back','Bottom Right');
    for(const id of Object.keys(levels))assert.ok(levels[id][1]-levels[id][0]<=t+1e-3,`${id} lies flat`);
  }
  assert.throws(()=>box.getExportGeometry({width:20,height:140,depth:60,thickness:0.5}),/at least 30 mm/);
});

test('the pillow box bows to its outside size and closes its ends to a pinch, from one sheet',()=>{
  const box=getTemplateRuntime('pillow-box');
  const within=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} differs from ${b} by more than ${tol}`);
  for(const dimensions of [{width:160,height:40,depth:90,thickness:0.4},{width:60,height:8,depth:30,thickness:0.3},{width:400,height:150,depth:300,thickness:1}]){
    const sheet=box.getExportGeometry(dimensions);
    // One piece: two faces, four end flaps and the glue flap, each face and flap whole on the sheet.
    assert.deepEqual(sheet.panels.map(panel=>panel.id).sort(),['back','back-left','back-right','front','front-left','front-right','glue']);
    // The curved creases are shared, so they export as creases, not cuts.
    const panel=id=>sheet.panels.find(item=>item.id===id);
    const creaseOn=(a,b)=>sheet.crease.filter(line=>[line.start,line.end].every(point=>[a,b].every(id=>onOutline(panel(id).outline,point)))).length;
    for(const end of ['front-left','front-right','back-left','back-right'])assert.ok(creaseOn(end,end.split('-')[0])>=8,`${end} crease`);
    // The glue flap stays inside the front's curved ends, where it is stuck.
    const front=panel('front');
    for(const point of panel('glue').outline){
      const across=point.y-panel('glue').y;
      const xs=front.outline.filter(q=>Math.abs(q.y-front.y-across)<front.height/18+1e-6).map(q=>q.x);
      assert.ok(point.x>=Math.min(...xs.filter(x=>x<front.x+front.width/2))-1e-6&&point.x<=Math.max(...xs.filter(x=>x>front.x+front.width/2))+1e-6,`glue at ${point.x},${point.y} stays inside the front`);
    }
    // Closed, the model is the size entered: tip to tip, through the middle, across.
    const extent=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
    const ends={};
    for(const mesh of box.buildMeshes({dimensions,formation:100,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]})){
      for(let i=0;i<mesh.vertices.length;i+=8)for(let k=0;k<3;k++){extent[k][0]=Math.min(extent[k][0],mesh.vertices[i+k]);extent[k][1]=Math.max(extent[k][1],mesh.vertices[i+k]);}
      if(/^(Front|Back) (Left|Right) End$/.test(mesh.panel??''))for(let i=0;i<mesh.vertices.length;i+=8)(ends[mesh.panel]??=[]).push([mesh.vertices[i],mesh.vertices[i+1]]);
    }
    const t=dimensions.thickness;
    within(extent[0][1]-extent[0][0],dimensions.width,2*t+0.5,'closed width');
    within(extent[1][1]-extent[1][0],dimensions.height,2*t+0.02*dimensions.height,'closed height');
    within(extent[2][1]-extent[2][0],dimensions.depth,2*t+0.5,'closed depth');
    // The glue flap stays inside the bowed front, however wide it is set.
    const triangles=meshes=>meshes.flatMap(mesh=>{const v=mesh.vertices,out=[];for(let i=0;i<v.length;i+=24)out.push([0,1,2].map(k=>[v[i+k*8],v[i+k*8+1],v[i+k*8+2]]));return out;});
    const wide=box.buildMeshes({dimensions:{...dimensions,adjustments:{glue:1e9}},formation:100,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    const faces=triangles(wide.filter(mesh=>mesh.panel==='Front'));
    for(const point of triangles(wide.filter(mesh=>/Glue$/.test(mesh.panel??''))).flat()){
      const centre=f=>f[0].map((_,k)=>(f[0][k]+f[1][k]+f[2][k])/3);
      const near=faces.reduce((best,f)=>Math.hypot(...centre(f).map((x,k)=>x-point[k]))<Math.hypot(...centre(best).map((x,k)=>x-point[k]))?f:best);
      const a=near[1].map((x,k)=>x-near[0][k]),b=near[2].map((x,k)=>x-near[0][k]);
      const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n);
      assert.ok(point.reduce((sum,x,k)=>sum+(x-near[0][k])*n[k]/length,0)<1e-3,`glue at ${point.map(x=>x.toFixed(1))} stays inside the front`);
    }
    // Each end flap reaches the pinch: the middle of the box's end.
    for(const [name,points] of Object.entries(ends)){
      const tipX=(name.includes('Right')?1:-1)*dimensions.width/2;
      assert.ok(points.some(([x,y])=>Math.abs(x-tipX)<1e-3&&Math.abs(y)<1e-3),`${name} reaches the pinch`);
    }
  }
  assert.throws(()=>box.getExportGeometry({width:160,height:80,depth:90,thickness:0.4}),/height of at most 63 mm/);
  // Model pieces and surfaces must stand in for real panels and sit on folded ones.
  const broken=change=>{const copy=structuredClone(pillowBoxDefinition);change(copy);return ()=>compileParametricTemplate(copy);};
  assert.throws(broken(copy=>{copy.fold.modelPanels[0].of='nope';}),/stands in for unknown panel "nope"/);
  assert.throws(broken(copy=>{copy.fold.surfaces[0].rows[1].pop();}),/two or more rows of the same length/);
  assert.throws(broken(copy=>{copy.fold.surfaces[0].rows[0][0].place={on:'front',at:[0,0]};}),/placed on "front", which the model doesn't fold/);
});

test('the gable box closes its roof over gusseted ends, handles back to back with a finger hole',()=>{
  const box=getTemplateRuntime('gable-box');
  const within=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} differs from ${b} by more than ${tol}`);
  for(const dimensions of [{width:120,height:90,depth:70,thickness:0.5},{width:30,height:30,depth:20,thickness:0.3},{width:400,height:400,depth:250,thickness:2}]){
    const t=dimensions.thickness;
    const sheet=box.getExportGeometry(dimensions);
    const panel=id=>sheet.panels.find(item=>item.id===id);
    for(const id of ['front-roof','back-roof','front-handle','back-handle','left-gable','right-gable','left-gusset-a','left-gusset-b','right-gusset-a','right-gusset-b'])assert.ok(panel(id),`${id} is on the sheet`);
    // Each gusset creases onto its gable, and is cut free from the roof beside it.
    const along=(line,a,b)=>[line.start,line.end].every(point=>[a,b].every(id=>onOutline(panel(id).outline,point)));
    for(const end of ['left','right'])for(const side of ['a','b'])assert.ok(sheet.crease.some(line=>along(line,`${end}-gable`,`${end}-gusset-${side}`)),`${end} gusset ${side} creases onto its gable`);
    for(const [gusset,roof] of [['left-gusset-b','front-roof'],['right-gusset-a','front-roof'],['right-gusset-b','back-roof']]){
      assert.ok(!sheet.crease.some(line=>along(line,gusset,roof)),`${gusset} is not creased to ${roof}`);
      assert.ok(sheet.cut.some(line=>along(line,gusset,roof)),`${gusset} is cut from ${roof}`);
    }
    // The finger hole is cut inside each handle.
    for(const id of ['front-handle','back-handle']){
      const handle=panel(id);
      assert.ok(sheet.cut.filter(line=>[line.start,line.end].every(point=>point.x>handle.x&&point.x<handle.x+handle.width&&point.y>handle.y&&point.y<handle.y+handle.height)).length>=20,`${id} has a finger hole`);
    }
    // Closed: the body is the size entered, the roof leans in until the
    // handles meet over the middle, and the gables and gussets stay under it.
    const meshes=box.buildMeshes({dimensions,formation:100,opening:0,openingMode:'closed',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    const points=name=>meshes.filter(mesh=>mesh.panel===name).flatMap(mesh=>{const out=[];for(let i=0;i<mesh.vertices.length;i+=8)out.push([mesh.vertices[i],mesh.vertices[i+1],mesh.vertices[i+2]]);return out;});
    const span=(name,k)=>{const values=points(name).map(point=>point[k]);return [Math.min(...values),Math.max(...values)];};
    within(span('Right',0)[0]-span('Left',0)[1],dimensions.width,2*t,'inside width');
    within(span('Front',2)[0]-span('Back',2)[1],dimensions.depth,2*t,'inside depth');
    const [front,back]=[span('Front Handle',2),span('Back Handle',2)];
    assert.ok(front[0]-back[1]>=-1e-6&&front[0]-back[1]<=2*t+0.5,`the handles meet back to back: ${back[1]} to ${front[0]}`);
    within(span('Front Handle',1)[0],span('Front Roof',1)[1],2*t+0.5,'the handle stands on the ridge');
    for(const end of ['Left','Right']){
      assert.ok(span(`${end} Gable`,1)[1]<span('Front Roof',1)[1],`${end} gable stays under the ridge`);
      // Each gusset lies on the inside of the roof panel over it.
      for(const side of ['A','B']){
        const gusset=points(`${end} Gusset ${side}`);
        const roof=points(gusset.reduce((sum,point)=>sum+point[2],0)>0?'Front Roof':'Back Roof');
        const [lo,hi]=[0,1].map(k=>k?roof.reduce((best,point)=>point[1]>best[1]?point:best):roof.reduce((best,point)=>point[1]<best[1]?point:best));
        const slope=(hi[1]-lo[1])/(hi[2]-lo[2]);
        // Height of the roof's outside over each point; the gusset stays below it, and within the walls.
        for(const point of gusset){
          assert.ok(point[1]<=lo[1]+slope*(point[2]-lo[2])+1e-3,`${end} gusset ${side} at ${point.map(x=>x.toFixed(1))} stays under the roof`);
          assert.ok(Math.abs(point[0])<=span('Right',0)[1]+1e-3,`${end} gusset ${side} stays within the walls`);
        }
      }
    }
    // The model shows the finger hole: nothing covers the middle of it.
    const handle=panel('front-handle'),middle=handle.x+handle.width/2-sheet.panels.find(item=>item.id==='front').x-panel('front').width/2;
    const covered=meshes.filter(mesh=>mesh.panel==='Front Handle').some(mesh=>{
      const v=mesh.vertices,[y0,y1]=span('Front Handle',1),y=y1-0.45*(y1-y0);
      for(let i=0;i<v.length;i+=24){
        const [a,b,c]=[0,1,2].map(k=>[v[i+k*8],v[i+k*8+1]]);
        const sign=(p,q,r)=>(p[0]-r[0])*(q[1]-r[1])-(q[0]-r[0])*(p[1]-r[1]);
        const d=[sign([middle,y],a,b),sign([middle,y],b,c),sign([middle,y],c,a)];
        if(!(d.some(x=>x<0)&&d.some(x=>x>0))&&d.some(x=>Math.abs(x)>1e-9))return true;
      }
      return false;
    });
    assert.ok(!covered,'the finger hole is open in 3D');
  }
  assert.throws(()=>box.getExportGeometry({width:120,height:90,depth:15,thickness:0.5}),/at least 20 mm/);
});

test('the drawer box tray fits inside its sleeve, slides out of the front, and the thumb notches show',()=>{
  const box=getTemplateRuntime('drawer-box');
  for(const dimensions of [{width:120,height:40,depth:80,thickness:0.5},{width:30,height:15,depth:30,thickness:0.3},{width:400,height:200,depth:400,thickness:2}]){
    const t=dimensions.thickness;
    const sheet=box.getExportGeometry(dimensions);
    const panel=id=>sheet.panels.find(item=>item.id===id);
    for(const id of ['bottom','front','back','left','right','sleeveTop','sleeveBottom','sleeveLeft','sleeveRight','sleeveGlue'])assert.ok(panel(id),`${id} is on the sheet`);
    // The sleeve's walls crease to each other, and the top is notched at both ends.
    const along=(line,a,b)=>[line.start,line.end].every(point=>[a,b].every(id=>onOutline(panel(id).outline,point)));
    for(const [a,b] of [['sleeveGlue','sleeveLeft'],['sleeveLeft','sleeveBottom'],['sleeveBottom','sleeveRight'],['sleeveRight','sleeveTop']])assert.ok(sheet.crease.some(line=>along(line,a,b)),`${a} creases to ${b}`);
    const top=panel('sleeveTop'),ys=top.outline.map(point=>point.y);
    const dips=top.outline.filter(point=>point.y>Math.min(...ys)+1e-6&&point.y<Math.max(...ys)-1e-6);
    assert.ok(dips.some(point=>point.y<top.y+top.height/2)&&dips.some(point=>point.y>top.y+top.height/2),'the top has a notch at each end');
    const meshes=opening=>box.buildMeshes({dimensions,formation:100,opening,openingMode:'lid_from_back',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    const span=(list,pattern,k)=>{const values=list.filter(mesh=>pattern.test(mesh.panel??'')).flatMap(mesh=>{const out=[];for(let i=k;i<mesh.vertices.length;i+=8)out.push(mesh.vertices[i]);return out;});return [Math.min(...values),Math.max(...values)];};
    const tray=/^(Interior )?(Front|Back|Left|Right|Bottom)( Turn-In| (Left|Right) Ear)?$/,sleeve=/^(Interior )?Sleeve /;
    // Closed: the tray lies within the sleeve on every side, and the sleeve is the inside size and a little more.
    const closed=meshes(0);
    for(const k of [0,1]){
      const [a,b]=[span(closed,tray,k),span(closed,sleeve,k)];
      assert.ok(a[0]>b[0]+t*0.5&&a[1]<b[1]-t*0.5,`the tray stays inside the sleeve along ${'xy'[k]}: ${a} in ${b}`);
    }
    const [a,b]=[span(closed,tray,2),span(closed,sleeve,2)];
    assert.ok(Math.abs(a[0]-b[0])<=2*t+0.5&&Math.abs(a[1]-b[1])<=2*t+0.5,`the tray's ends meet the sleeve's: ${a} and ${b}`);
    // Open: the drawer has slid forward, out of the front, and is still held by the sleeve.
    const open=span(meshes(100),tray,2);
    assert.ok(open[1]-a[1]>dimensions.depth*0.5,`the drawer slides out: ${open[1]-a[1]}`);
    assert.ok(open[0]<b[1],'the drawer stays in the sleeve');
    // The thumb notches show in 3D: nothing covers the sleeve top just inside each end.
    const topMeshes=closed.filter(mesh=>mesh.panel==='Sleeve Top');
    const [x0,x1]=span(closed,/^Sleeve Top$/,0),[z0,z1]=span(closed,/^Sleeve Top$/,2);
    for(const z of [z0+1,z1-1]){
      const p=[(x0+x1)/2,z];
      const covered=topMeshes.some(mesh=>{const v=mesh.vertices;for(let i=0;i<v.length;i+=24){const tri=[0,1,2].map(n=>[v[i+n*8],v[i+n*8+2]]);const s=(u,w,q)=>(u[0]-q[0])*(w[1]-q[1])-(w[0]-q[0])*(u[1]-q[1]);const d=[s(p,tri[0],tri[1]),s(p,tri[1],tri[2]),s(p,tri[2],tri[0])];if(!(d.some(x=>x<-1e-9)&&d.some(x=>x>1e-9)))return true;}return false;});
      assert.ok(!covered,`the thumb notch at z=${z.toFixed(1)} is open in 3D`);
    }
  }
  assert.throws(()=>box.getExportGeometry({width:120,height:10,depth:80,thickness:0.5}),/at least 15 mm/);
});

function onOutline(outline,point){
  return outline.some((a,i)=>{
    const b=outline[(i+1)%outline.length],length=Math.hypot(b.x-a.x,b.y-a.y);
    if(length<1e-9)return false;
    const along=((point.x-a.x)*(b.x-a.x)+(point.y-a.y)*(b.y-a.y))/length,off=Math.abs((point.x-a.x)*(b.y-a.y)-(point.y-a.y)*(b.x-a.x))/length;
    return off<1e-6&&along>=-1e-6&&along<=length+1e-6;
  });
}

test('the mailer folds into a box of the entered inside size, every layer in its place',()=>{
  const within=(a,b,tol,label)=>assert.ok(Math.abs(a-b)<=tol,`${label}: ${a} differs from ${b} by more than ${tol}`);
  const mailer=getTemplateRuntime('mailer-box');
  for(const dimensions of [{width:220,height:80,depth:160,thickness:1.5},{width:400,height:120,depth:300,thickness:3},{width:80,height:30,depth:70,thickness:0.8}]){
    const t=dimensions.thickness;
    const input=(formation,opening=0)=>({dimensions,formation,opening,openingMode:'lid_from_back',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
    // Each panel's extent along each axis, both of its faces together.
    const extents=meshes=>{
      const out={};
      for(const mesh of meshes){
        if(typeof mesh.panel!=='string')continue;
        const id=mesh.panel.replace(/^Interior /,'');
        const box=out[id]??=[[Infinity,-Infinity],[Infinity,-Infinity],[Infinity,-Infinity]];
        for(let i=0;i<mesh.vertices.length;i+=8)for(let k=0;k<3;k++){box[k][0]=Math.min(box[k][0],mesh.vertices[i+k]);box[k][1]=Math.max(box[k][1],mesh.vertices[i+k]);}
      }
      return out;
    };
    const closed=extents(mailer.buildMeshes(input(100)));
    // Distance from the centre to a side panel's nearer or farther face.
    const near=(id,k)=>Math.min(...closed[id][k].map(Math.abs));
    const far=(id,k)=>Math.max(...closed[id][k].map(Math.abs));
    within(near('Left Inner',0)+near('Right Inner',0),dimensions.width,t,'inside width');
    within(near('Front',2)+near('Back',2),dimensions.depth,t,'inside depth');
    within(closed.Top[1][0]-closed.Bottom[1][1],dimensions.height,t,'inside height');
    for(const side of ['Left','Right']){
      // The ears are trapped between the side wall's two layers…
      for(const wall of ['Front','Back']){
        const ear=`${wall} ${side} Ear`;
        assert.ok(near(ear,0)>far(`${side} Inner`,0)&&far(ear,0)<near(side,0),`${ear} between the layers`);
      }
      // …and the lid's flap tucks inside the inner layer.
      assert.ok(far(`Lid ${side}`,0)<near(`${side} Inner`,0),`lid ${side} flap inside the wall`);
    }
    assert.ok(far('Lid Front',2)<near('Front',2),'lid tuck inside the front');
    // Flat before forming.
    const flat=extents(mailer.buildMeshes(input(0)));
    assert.ok(Object.values(flat).every(box=>box[1][1]-box[1][0]<2*t),'flat sheet');
    // The inner walls' locking tabs have their slots in the base.
    const sheet=mailer.getExportGeometry(dimensions);
    assert.equal(sheet.panels.length,17);
    assert.equal(sheet.crease.length,16,'creases: 4 walls, 4 ears, 2 per roll strip, lid and its 3 flaps');
    const base=sheet.panels.find(panel=>panel.id==='bottom');
    const inside=point=>point.x>base.x&&point.x<base.x+base.width&&point.y>base.y&&point.y<base.y+base.height;
    assert.equal(sheet.cut.filter(line=>inside(line.start)&&inside(line.end)).length,16,'four slots of four cuts');
  }
  assert.throws(()=>mailer.getExportGeometry({width:50,height:80,depth:160,thickness:1.5}),/at least 60 mm/);
});

// Whether two cut outlines overlap: sharing an edge or a corner is fine, but
// no edges may cross and no corner may lie inside the other panel.
function outlinesOverlap(a,b){
  const eps=1e-6;
  const cross=(o,p,q)=>(p.x-o.x)*(q.y-o.y)-(p.y-o.y)*(q.x-o.x);
  const edges=poly=>poly.map((point,i)=>[point,poly[(i+1)%poly.length]]);
  for(const [p1,p2] of edges(a))for(const [q1,q2] of edges(b)){
    const d1=cross(q1,q2,p1),d2=cross(q1,q2,p2),d3=cross(p1,p2,q1),d4=cross(p1,p2,q2);
    if(((d1>eps&&d2<-eps)||(d1<-eps&&d2>eps))&&((d3>eps&&d4<-eps)||(d3<-eps&&d4>eps)))return true;
  }
  const strictlyInside=(point,poly)=>{
    let inside=false;
    for(const [p,q] of edges(poly)){
      // On an edge counts as outside.
      const length=Math.hypot(q.x-p.x,q.y-p.y);
      const along=((point.x-p.x)*(q.x-p.x)+(point.y-p.y)*(q.y-p.y))/(length*length);
      if(Math.abs(cross(p,q,point))/length<1e-4&&along>=-eps&&along<=1+eps)return false;
      if((p.y>point.y)!==(q.y>point.y)&&point.x<p.x+(point.y-p.y)/(q.y-p.y)*(q.x-p.x))inside=!inside;
    }
    return inside;
  };
  // Corners, edge midpoints and the centre, for panels whose corners all sit on the other's edges.
  const centre=poly=>({x:poly.reduce((sum,point)=>sum+point.x,0)/poly.length,y:poly.reduce((sum,point)=>sum+point.y,0)/poly.length});
  const probes=poly=>[...poly,...edges(poly).map(([p,q])=>({x:(p.x+q.x)/2,y:(p.y+q.y)/2})),centre(poly)];
  return probes(a).some(point=>strictlyInside(point,b))||probes(b).some(point=>strictlyInside(point,a));
}

test('adjustable sizes replace the template’s own, within their limits, and every sheet stays whole',()=>{
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const options={openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'};
    const dimensions=template.defaultDimensions;
    const sizes=runtime.getAdjustableSizes(dimensions,options);
    assert.ok(sizes.length>0,`${template.id} offers no adjustable sizes`);
    // Nothing set: the template's own sizes.
    for(const size of sizes){
      assert.equal(size.adjusted,false);
      assert.equal(size.value,size.defaultValue,`${template.id} ${size.key}`);
      assert.ok(size.min<=size.defaultValue+1e-9&&size.defaultValue<=size.max+1e-9,`${template.id} ${size.key} default ${size.defaultValue} outside ${size.min}–${size.max}`);
    }
    // Only known keys survive sanitising, so a template switch drops the rest.
    const kept=runtime.sanitizeParameters({...dimensions,adjustments:{[sizes[0].key]:sizes[0].min,unknownSize:5}});
    assert.deepEqual(kept.adjustments,{[sizes[0].key]:sizes[0].min});
    const sheets=[
      ['min',Object.fromEntries(sizes.map(size=>[size.key,-1e6]))],
      ['max',Object.fromEntries(sizes.map(size=>[size.key,1e6]))],
      ...sizes.map(size=>[`${size.key} max`,{[size.key]:1e6}]),
    ];
    for(const [label,adjustments] of sheets){
      const adjusted={...dimensions,adjustments};
      const after=runtime.getAdjustableSizes(adjusted,options);
      for(const size of after)if(size.key in adjustments){
        assert.ok(size.adjusted);
        assert.equal(size.value,adjustments[size.key]<0?size.min:size.max,`${template.id} ${size.key} clamped (${label})`);
      }
      const sheet=runtime.getExportGeometry(adjusted,options);
      for(let i=0;i<sheet.panels.length;i++)for(let j=i+1;j<sheet.panels.length;j++){
        const a=sheet.panels[i],b=sheet.panels[j];
        assert.ok(!outlinesOverlap(a.outline,b.outline),`${template.id} (${label}): ${a.id} overlaps ${b.id}`);
      }
      // And the box still folds.
      for(const formation of [50,100]){
        const meshes=runtime.buildMeshes({dimensions:adjusted,formation,opening:0,openingMode:options.openingMode,splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]});
        assert.ok(meshes.every(mesh=>mesh.vertices.every(Number.isFinite)),`${template.id} (${label}) folds at ${formation}%`);
      }
    }
    // A changed size changes the sheet.
    const size=sizes.find(item=>item.max-item.min>2);
    const changed=runtime.getExportGeometry({...dimensions,adjustments:{[size.key]:(size.min+size.defaultValue)/2===size.defaultValue?size.max:(size.min+size.defaultValue)/2}},options);
    assert.notDeepEqual(changed.panels,runtime.getExportGeometry(dimensions,options).panels,`${template.id} ${size.key} changes nothing`);
  }
});

test('every split top flap pair is a size of its own, and the outer pairs close in 3D',()=>{
  const split=getTemplateRuntime('split-top-box');
  const d={width:400,height:300,depth:300,thickness:3};
  for(const side of ['side_a','side_b']){
    const options={openingMode:'top_split_meet_center',splitTopHingeSide:side};
    const keys=split.getAdjustableSizes(d,options).map(size=>size.key);
    assert.deepEqual(keys,['joint','topLongFlap','topEndFlap','bottomLongFlap','bottomEndFlap']);
    assert.deepEqual(split.getAdjustedPanels(d,'topLongFlap',options).sort(),['topBack','topFront']);
    assert.deepEqual(split.getAdjustedPanels(d,'topEndFlap',options).sort(),['topLeft','topRight']);
    assert.deepEqual(split.getAdjustedPanels(d,'bottomLongFlap',options).sort(),['bottomBack','bottomFront']);
    assert.deepEqual(split.getAdjustedPanels(d,'bottomEndFlap',options).sort(),['bottomLeft','bottomRight']);
    // The pairs that meet in the middle, cut a board longer, folded closed:
    // they can grow no further, so their tips never run into each other.
    const outerTop=side==='side_a'?['Top Left','Top Right',0]:['Top Front','Top Back',2];
    for(const key of ['topLongFlap','topEndFlap','bottomLongFlap']){
      const size=split.getAdjustableSizes(d,options).find(item=>item.key===key);
      if(key==='bottomLongFlap'||(side==='side_a')===(key==='topEndFlap'))assert.equal(size.max,size.defaultValue,`${side} ${key}`);
    }
    const meshes=split.buildMeshes({dimensions:d,formation:100,opening:0,openingMode:'top_split_meet_center',splitTopHingeSide:side,color:[1,1,1],interiorColor:[1,1,1]});
    const span=(name,axis)=>{
      const mesh=meshes.find(item=>item.panel===name),m=mesh.model,values=[];
      for(const i of [0,1,2,5]){
        const [x,y,z]=[mesh.vertices[i*8],mesh.vertices[i*8+1],mesh.vertices[i*8+2]];
        values.push(m?[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]][axis]:[x,y,z][axis]);
      }
      return [Math.min(...values),Math.max(...values)];
    };
    for(const [a,b,axis] of [outerTop,['Bottom Front','Bottom Back',2]]){
      const [sa,sb]=[span(a,axis),span(b,axis)];
      const gap=Math.max(sa[0],sb[0])-Math.min(sa[1],sb[1]);
      assert.ok(gap>=0&&gap<1,`${side}: ${a} and ${b} meet (gap ${gap.toFixed(2)} mm)`);
    }
  }
});

test('the unadjusted sheets have no overlapping panels either',()=>{
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const sheet=runtime.getExportGeometry(template.defaultDimensions,{openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'});
    for(let i=0;i<sheet.panels.length;i++)for(let j=i+1;j<sheet.panels.length;j++){
      assert.ok(!outlinesOverlap(sheet.panels[i].outline,sheet.panels[j].outline),`${template.id}: ${sheet.panels[i].id} overlaps ${sheet.panels[j].id}`);
    }
  }
});

test('each adjustable size names the panels it reshapes, and only those',()=>{
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const options={openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'};
    for(const size of runtime.getAdjustableSizes(template.defaultDimensions,options)){
      const panels=runtime.getAdjustedPanels(template.defaultDimensions,size.key,options);
      assert.ok(panels.length>0,`${template.id} ${size.key} reshapes nothing`);
      // The box's own front keeps its shape: flap sizes (and a rigid box's
      // lid height, which reshapes only the lid) leave it alone.
      const labels=new Map(runtime.getExportGeometry(template.defaultDimensions,options).panels.map(panel=>[panel.id,panel.label]));
      assert.ok(panels.every(id=>labels.get(id)!=='FRONT'),`${template.id} ${size.key} reshapes the front: ${panels}`);
    }
  }
  const tuck=getTemplateRuntime('reverse-tuck-carton');
  const d={width:120,height:180,depth:55,thickness:0.5};
  assert.deepEqual(tuck.getAdjustedPanels(d,'glue'),['glue']);
  assert.deepEqual(tuck.getAdjustedPanels(d,'topDustFlap'),['top-left-dust','top-right-dust']);
  // At its limit, the size is nudged back inside it.
  assert.deepEqual(tuck.getAdjustedPanels({...d,adjustments:{glue:1e6}},'glue'),['glue']);
  assert.deepEqual(tuck.getAdjustedPanels(d,'noSuchSize'),[]);
});

test('"Show sizes" puts each box and flap size on the panels that follow it one for one',()=>{
  const sizesOf=(id,dimensions,options)=>{
    const runtime=getTemplateRuntime(id);
    return new Map(runtime.getPanelSizes(dimensions,options).map(entry=>[entry.panel,[entry.x?.key,entry.y?.key]]));
  };
  const tuck=sizesOf('reverse-tuck-carton',{width:120,height:180,depth:55,thickness:0.5});
  assert.deepEqual(tuck.get('front'),['width','height']);
  assert.deepEqual(tuck.get('left'),['depth','height']);
  // A flap shows its own size before the box's.
  assert.deepEqual(tuck.get('glue'),['glue','height']);
  assert.deepEqual(tuck.get('top-tuck'),['width','tuck']);
  assert.deepEqual(tuck.get('top-left-dust'),['depth','topDustFlap']);
  const mailer=sizesOf('mailer-box',{width:220,height:80,depth:160,thickness:1.5});
  assert.deepEqual(mailer.get('frontLeftEar')?.[0],'ear');
  assert.deepEqual(mailer.get('lidFront'),['width','lidTuck']);
  // Every ready template shows its three box sizes somewhere, with their values.
  // A pillow box's faces bow, so no flat panel grows one for one with its
  // height or width across; the 3D box still shows them.
  const notFlat={'pillow-box':['height','depth']};
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const entries=runtime.getPanelSizes(template.defaultDimensions,{openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'});
    const shown=entries.flatMap(entry=>[entry.x,entry.y]).filter(Boolean);
    for(const key of ['width','height','depth'].filter(key=>!notFlat[template.id]?.includes(key))){
      const size=shown.find(item=>item.key===key);
      assert.ok(size,`${template.id} never shows its ${key}`);
      assert.equal(size.value,template.defaultDimensions[key]);
      assert.equal(size.kind,'dimension');
    }
    for(const size of shown.filter(item=>item.kind==='adjustment'))assert.ok(size.min<=size.value&&size.value<=size.max,`${template.id} ${size.key} within its limits`);
  }
});

test('the SVG can carry the artwork on a layer under the lines, with the bleed kept',()=>{
  const {dielineSvg}=require('../src/lib/packaging/dieline-vector.ts');
  const runtime=getTemplateRuntime('reverse-tuck-carton');
  const geometry=runtime.getExportGeometry({width:60,height:120,depth:40,thickness:0.5},{openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'});
  const {width,height}=geometry.bounds;
  const panel=geometry.panels[1];
  const image={href:'data:image/png;base64,AAAA',x:panel.x-3,y:panel.y-3,width:panel.width+6,height:panel.height+6};
  const svg=dielineSvg(geometry,'With artwork',{bleedMm:3,images:[image]});
  // The page grows by the bleed on every side; the lines keep their millimetre coordinates.
  const r=value=>Number(value.toFixed(3));
  assert.match(svg,new RegExp(`width="${r(width+6)}mm" height="${r(height+6)}mm" viewBox="-3 -3 ${r(width+6)} ${r(height+6)}"`));
  // Artwork first (underneath), then the cut and crease layers.
  assert.ok(svg.indexOf('<g id="ARTWORK"')<svg.indexOf('<g id="CUT"')&&svg.indexOf('<g id="CUT"')<svg.indexOf('<g id="CREASE"'));
  assert.match(svg,new RegExp(`<image x="${r(image.x)}" y="${r(image.y)}" width="${r(image.width)}" height="${r(image.height)}" preserveAspectRatio="none" href="data:image/png;base64,AAAA"/>`));
  assert.match(svg,/printed artwork at 1:1 in millimetres, with 3 mm bleed/);
  // Without artwork nothing changes: no artwork layer, the page is the sheet.
  const plain=dielineSvg(geometry,'Plain');
  assert.ok(!plain.includes('ARTWORK'));
  assert.match(plain,new RegExp(`viewBox="0 0 ${r(width)} ${r(height)}"`));
});

test('the dieline exports as SVG and DXF at 1:1, cut and crease on their own layers',()=>{
  const {dielineSvg,dielineDxf}=require('../src/lib/packaging/dieline-vector.ts');
  const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
  for(const template of getReadyPackagingTemplates()){
    const runtime=getTemplateRuntime(template.id);
    const geometry=runtime.getExportGeometry(template.defaultDimensions,{openingMode:runtime.assembly.defaultOpeningMode,splitTopHingeSide:'side_a'});
    const {width,height}=geometry.bounds;
    // SVG: millimetre page size, one <line> per edge in each layer.
    const svg=dielineSvg(geometry,'Test & "quotes"');
    assert.match(svg,new RegExp(`width="${Number(width.toFixed(3))}mm" height="${Number(height.toFixed(3))}mm"`));
    const layer=name=>svg.slice(svg.indexOf(`<g id="${name}"`),svg.indexOf('</g>',svg.indexOf(`<g id="${name}"`)));
    assert.equal((layer('CUT').match(/<line /g)??[]).length,geometry.cut.length,`${template.id} SVG cut lines`);
    assert.equal((layer('CREASE').match(/<line /g)??[]).length,geometry.crease.length,`${template.id} SVG crease lines`);
    assert.ok(svg.includes('Test &amp; &quot;quotes&quot;'),'title is escaped');
    assert.equal((svg.match(/<text /g)??[]).length,geometry.panels.length);
    // DXF: code/value pairs, R12, millimetres, a LINE per edge on its layer, y turned up.
    const dxf=dielineDxf(geometry).trimEnd().split('\n');
    assert.equal(dxf.length%2,0,`${template.id} DXF is code/value pairs`);
    const pairs=[];for(let i=0;i<dxf.length;i+=2)pairs.push([Number(dxf[i]),dxf[i+1]]);
    assert.ok(pairs.every(([code])=>Number.isInteger(code)),'group codes are integers');
    assert.deepEqual(pairs.at(-1),[0,'EOF']);
    const after=name=>pairs[pairs.findIndex(([c,v])=>c===9&&v===name)+1];
    assert.deepEqual(after('$ACADVER'),[1,'AC1009']);
    assert.deepEqual(after('$INSUNITS'),[70,'4']);
    const lines=[];
    pairs.forEach(([code,value],i)=>{if(code===0&&value==='LINE')lines.push(Object.fromEntries(pairs.slice(i+1,i+8).map(([c,v])=>[c,v])));});
    assert.equal(lines.filter(line=>line[8]==='CUT').length,geometry.cut.length,`${template.id} DXF cut lines`);
    assert.equal(lines.filter(line=>line[8]==='CREASE').length,geometry.crease.length,`${template.id} DXF crease lines`);
    // Coordinates are written to three decimals.
    for(const line of lines)for(const [x,y] of [[10,20],[11,21]]){
      assert.ok(Number(line[x])>=-5e-4&&Number(line[x])<=width+5e-4&&Number(line[y])>=-5e-4&&Number(line[y])<=height+5e-4,`${template.id} DXF point inside the sheet`);
    }
    // The first cut line, turned the right way up.
    const first=geometry.cut[0],mapped=lines.find(line=>line[8]==='CUT');
    assert.ok(Math.abs(Number(mapped[20])-(height-first.start.y))<1e-3&&Math.abs(Number(mapped[10])-first.start.x)<1e-3);
  }
});
