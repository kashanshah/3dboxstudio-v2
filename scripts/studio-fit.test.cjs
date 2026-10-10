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
const {buildMeshes,meshReach,studioFitZoom,studioViewProjection,cameraForPreset}=require('../src/components/studio/carton-scene.ts');
const {templateAssemblyValuesForProgress,requireTemplateRuntime}=require('../src/lib/packaging/template-runtime.ts');
const {getReadyPackagingTemplates}=require('../src/lib/packaging/template-registry.ts');
const {svgNumber,svgPoints,svgLine,cssPercent}=require('../src/lib/svg-number.ts');

test('the fitted zoom keeps every stage of every template inside the preview frame',()=>{
  const {yaw,pitch}=cameraForPreset('Perspective');
  for(const template of getReadyPackagingTemplates()){
    const d=template.defaultDimensions;
    const runtime=requireTemplateRuntime(template.id);
    const mode=runtime.assembly.defaultOpeningMode;
    const from=runtime.assembly.hasOpeningStage(mode)?70:0;
    const maxDimension=Math.max(d.width,d.height,d.depth);
    for(const aspect of [437/320,0.75]){
      let clippedWithoutFit=false;
      for(let progress=from;progress<=100;progress+=2){
        const values=templateAssemblyValuesForProgress(template.id,progress,mode);
        const meshes=buildMeshes(d,values.opening,[1,1,1],[1,1,1],{templateId:template.id,formation:values.formation,openingMode:mode,splitTopHingeSide:'side_a'});
        const fit=studioFitZoom(maxDimension,meshReach(meshes),aspect);
        assert.ok(fit>0&&fit<=1);
        const inside=zoom=>{
          const m=studioViewProjection(maxDimension,aspect,yaw,pitch,zoom);
          return meshes.every(mesh=>{
            for(let i=0;i<mesh.vertices.length;i+=8){
              const [x,y,z]=[mesh.vertices[i],mesh.vertices[i+1],mesh.vertices[i+2]];
              const w=m[3]*x+m[7]*y+m[11]*z+m[15];
              if(Math.abs((m[0]*x+m[4]*y+m[8]*z+m[12])/w)>1||Math.abs((m[1]*x+m[5]*y+m[9]*z+m[13])/w)>1)return false;
            }
            return true;
          });
        };
        assert.ok(inside(82*fit),`${template.id} at ${progress}% (aspect ${aspect.toFixed(2)}) leaves the frame`);
        if(!inside(82))clippedWithoutFit=true;
      }
      // The case this guards: without the fit, some stage of the loop clips.
      if(aspect>1)assert.ok(clippedWithoutFit,`${template.id} never clipped, so the test no longer covers the fit`);
    }
  }
});

test('the fitted zoom leaves a closed box at the default framing',()=>{
  assert.equal(studioFitZoom(160,0.58*160,437/320),1);
  assert.ok(studioFitZoom(160,1.6*160,437/320)<0.6);
  assert.ok(studioFitZoom(160,160,0.5)<studioFitZoom(160,160,1));
});

test('die drawings round to the same markup whatever the last digit of the maths',()=>{
  assert.equal(svgNumber(2.5279558154618176),svgNumber(2.5279558154618194));
  assert.equal(svgNumber(-7.3355),-7.335);
  assert.equal(svgPoints([{x:0.1+0.2,y:1/3}]),'0.3,0.333');
  assert.deepEqual(svgLine({start:{x:244.98076211353316,y:0},end:{x:1e-17,y:96.51923788646684}}),{x1:244.981,y1:0,x2:0,y2:96.519});
  assert.equal(cssPercent(7.320644216691069),'7.3206%');
});
