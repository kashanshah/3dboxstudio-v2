import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLegacyDesignRows,designFacts } from './legacy-design-audit-lib.mjs';

test('legacy design audit groups only structural options while keeping material and size as dimensions',()=>{
 const rows=[
  {source_id:'a',payload:{id:'a',config:{opening:'closed',unit:'cm',dims:{width:24,height:10,length:16},materialId:'kraft'},images:{front:{s3Key:'a'}}}},
  {source_id:'b',payload:{id:'b',config:{opening:'closed',unit:'cm',dims:{width:30,height:12,length:20},materialId:'white_card'},images:{}}},
  {source_id:'c',payload:{id:'c',config:{opening:'top_split_meet_center',splitTopHingeSide:'side_b',unit:'cm',dims:{width:18,height:18,length:18},materialId:'kraft',faceImagePlacements:{top:{sourceImageId:'x',crop:{x:0,y:0,width:100,height:100,unit:'percent'},zoom:1,aspectRatio:1}},textureRotationDeg:{front:90}},images:{top:{s3Key:'c'}}}},
 ];
 const report=auditLegacyDesignRows(rows);
 assert.equal(report.total,3);
 assert.equal(report.withArtwork,2);
 assert.equal(report.structuralGroups.length,2);
 assert.deepEqual(report.structuralGroups.map(g=>[g.signature,g.designs,g.uniqueSizeCount]),[['closed',2,2],['top_split_meet_center|side_b',1,1]]);
 assert.deepEqual(report.materials,[{value:'kraft',count:2},{value:'white_card',count:1}]);
 assert.equal(report.featureUsage.crops,1);
 assert.equal(report.featureUsage.rotations,1);
});
test('non-split openings ignore split hinge and missing values fall back to V1 defaults',()=>{
 const facts=designFacts({source_id:'x',payload:{config:{opening:'lid_from_back',splitTopHingeSide:'side_b'},images:{}}});
 assert.equal(facts.structuralSignature,'lid_from_back');
 assert.equal(facts.splitTopHingeSide,null);
 assert.equal(facts.materialId,'kraft');
 assert.equal(facts.openT,0.35);
});
