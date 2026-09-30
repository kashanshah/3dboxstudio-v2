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
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);

const {legacyDesignToStudioProject}=require('../src/lib/legacy-design-converter.ts');

test('legacy converter preserves split structure, physical size, crop, rotation and copied media ids',()=>{
 const payload={
  name:'Split legacy',
  created_at:'2026-01-01T00:00:00Z',
  config:{
   unit:'in',dims:{width:10,height:4,length:6},materialId:'silver_foil',
   opening:'top_split_meet_center',splitTopHingeSide:'side_b',openT:.42,
   textureRotationDeg:{front:90},
   faceImagePlacements:{front:{sourceImageId:'src-1',crop:{x:10,y:20,width:70,height:60,unit:'percent'},zoom:1,aspectRatio:2}},
  },
  images:{front:{s3Key:'shares/d/front.png',name:'front.png',mime:'image/png'},topLeft:{s3Key:'shares/d/a.png',name:'a.png',mime:'image/png'}},
 };
 const mediaByFace={
  front:{id:'legacy-front',name:'front.png',url:'/api/media/legacy-front',mimeType:'image/png',byteSize:100,width:1000,height:500,fingerprint:'x',createdAt:1},
  topLeft:{id:'legacy-a',name:'a.png',url:'/api/media/legacy-a',mimeType:'image/png',byteSize:100,width:500,height:500,fingerprint:'y',createdAt:1},
 };
 const result=legacyDesignToStudioProject({source:'v1',sourceId:'d',payload,mediaByFace});
 assert.equal(result.state.templateId,'split-top-box');
 assert.equal(result.state.openingMode,'top_split_meet_center');
 assert.equal(result.state.splitTopHingeSide,'side_b');
 assert.equal(result.state.opening,42);
 assert.ok(Math.abs(result.state.dimensions.width-254)<1e-9);
 assert.ok(Math.abs(result.state.dimensions.height-101.6)<1e-9);
 assert.ok(Math.abs(result.state.dimensions.depth-152.4)<1e-9);
 assert.equal(result.state.material,'Foil');
 assert.equal(result.state.outsideCustomColor,'#cbcdd2');
 assert.equal(result.state.artworkByPanel.Front.assetId,'legacy-front');
 assert.equal(result.state.artworkByPanel.Front.rotation,90);
 assert.deepEqual(result.state.artworkByPanel.Front.crop,{x:.1,y:.2,width:.7,height:.6});
 assert.equal(result.state.mediaAssets.length,2);
 assert.equal(result.state.legacySourceId,'v1:d');
});

test('all non-split legacy opening variants stay on the reusable base-box template',()=>{
 for(const opening of ['closed','lid_from_back','lid_from_front','lid_from_left','lid_from_right','door_left','door_right','double_doors']){
  const result=legacyDesignToStudioProject({source:'v1',sourceId:opening,payload:{config:{opening,dims:{width:24,height:10,length:16},unit:'cm'},images:{}},assetBaseUrl:'https://legacy.example/'});
  assert.equal(result.state.templateId,'base-box',opening);
  assert.equal(result.state.openingMode,opening);
 }
});
