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

test('the parametric split top draws the same design grid and cutting template',()=>{
  for(const dimensions of fixtures)for(const side of sides){
    const options={splitTopHingeSide:side};
    const label=`${JSON.stringify(dimensions)} ${side}`;
    assertClose(parametric.getDielinePanels(dimensions,options),splitTopRuntime.getDielinePanels(dimensions,options),`${label} panels`);
    assertClose(parametric.getDielineBounds(dimensions,options),splitTopRuntime.getDielineBounds(dimensions,options),`${label} bounds`);
    let expected,expectedError;
    try{expected=splitTopRuntime.getExportGeometry(dimensions,options);}catch(error){expectedError=error.message;}
    if(expectedError)assert.throws(()=>parametric.getExportGeometry(dimensions,options),{message:expectedError});
    else assertClose(parametric.getExportGeometry(dimensions,options),expected,`${label} export`);
  }
});

test('the parametric split top refuses the same undersized boxes with the same messages',()=>{
  for(const dimensions of [{width:30,height:300,depth:300,thickness:3},{width:300,height:300,depth:20,thickness:3},{width:300,height:10,depth:300,thickness:3}]){
    assert.throws(()=>splitTopRuntime.getExportGeometry(dimensions));
    const message=(()=>{try{splitTopRuntime.getExportGeometry(dimensions);}catch(error){return error.message;}})();
    assert.throws(()=>parametric.getExportGeometry(dimensions),{message});
  }
});

test('the parametric split top folds into the same 3D model at every stage',()=>{
  for(const dimensions of fixtures)for(const side of sides)for(const [formation,opening] of [[0,100],[35,100],[85,100],[100,100],[100,70],[100,30],[100,0]]){
    const input={dimensions,formation,opening,openingMode:'top_split_meet_center',splitTopHingeSide:side,color:[0.8,0.7,0.6],interiorColor:[0.9,0.9,0.9]};
    assertClose(parametric.buildMeshes(input),splitTopRuntime.buildMeshes(input),`${JSON.stringify(dimensions)} ${side} ${formation}/${opening}`);
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
  assertClose(live.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}),splitTopRuntime.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
  const input={dimensions,formation:60,opening:100,openingMode:'top_split_meet_center',splitTopHingeSide:'side_a',color:[1,1,1],interiorColor:[1,1,1]};
  assertClose(live.buildMeshes(input),splitTopRuntime.buildMeshes(input));
  assertClose(splitTopSheet(dimensions,'side_b'),splitTopRuntime.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
  assertClose(splitTopExportGeometry(dimensions),splitTopRuntime.getExportGeometry(dimensions));
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
    const source=fs.readFileSync(path.resolve(__dirname,'../src/lib/packaging/templates',{'split-top-box':'split-top','base-box':'base-box','reverse-tuck-carton':'reverse-tuck','pizza-box':'pizza-box'}[template.id],'runtime.ts'),'utf8');
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
  const definitions=[splitTopDefinition,baseBoxDefinition,reverseTuckDefinition,pizzaBoxDefinition];
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
