import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyArtworkPatch } from './legacy-artwork-repair-plan.mjs';

const payload={config:{},images:{right:{s3Key:'shares/right.png'}}};
const art={url:'/api/shares/example/legacy-media/right',mode:'fill',scale:100,rotation:0,alignX:0,alignY:0};
const state={artworkByPanel:{Right:art}};
test('repairs existing uncropped migrated faces and is idempotent',()=>{
 const result=legacyArtworkPatch(payload,state,{shareId:'example'});
 assert.equal(result.next.artworkByPanel.Right.panelTexture,true);
 assert.equal(result.changes.length,1);
 assert.equal(state.artworkByPanel.Right.panelTexture,undefined);
 assert.deepEqual(legacyArtworkPatch(payload,result.next,{shareId:'example'}).changes,[]);
});
test('leaves manually replaced, resized, moved and cropped artwork unchanged',()=>{
 for(const change of [{url:'/api/media/new-image'},{transform:{x:25,y:60,width:50,height:80,rotation:0}},{scale:120},{alignX:1},{mode:'fit'},{crop:{x:0,y:0,width:.5,height:1}}]){
  const edited={artworkByPanel:{Right:{...art,...change}}};
  assert.deepEqual(legacyArtworkPatch(payload,edited,{shareId:'example'}).changes,[]);
 }
});
test('repairs saved orientation only when it still equals old converter output',()=>{
 const rotated={...payload,config:{textureRotationDeg:{right:90},faceImagePlacements:{right:{rotation:0}}}};
 const result=legacyArtworkPatch(rotated,state,{shareId:'example'});
 assert.equal(result.next.artworkByPanel.Right.rotation,90);
 const edited={artworkByPanel:{Right:{...art,rotation:45,panelTexture:true}}};
 assert.deepEqual(legacyArtworkPatch(rotated,edited,{shareId:'example'}).changes,[]);
});
