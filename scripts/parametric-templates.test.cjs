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
const {splitTopDefinition}=require('../src/lib/packaging/parametric/definitions/split-top.ts');
const {splitTopRuntime}=require('../src/lib/packaging/templates/split-top/runtime.ts');

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

test('a definition survives a JSON round trip unchanged',()=>{
  const fromJson=compileParametricTemplate(JSON.parse(JSON.stringify(splitTopDefinition)));
  const dimensions=fixtures[0];
  assertClose(fromJson.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}),parametric.getExportGeometry(dimensions,{splitTopHingeSide:'side_b'}));
});

test('authoring mistakes are refused when the definition is compiled',()=>{
  const broken=change=>{const copy=structuredClone(splitTopDefinition);change(copy);return ()=>compileParametricTemplate(copy);};
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
  ];
  for(const [change,error] of cases){
    assert.throws(broken(change),error);
    assert.throws(broken(change),TemplateDefinitionError);
  }
});
