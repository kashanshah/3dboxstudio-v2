import { createHash } from 'node:crypto';

const FACE_LABELS={front:'Front',back:'Back',left:'Left',right:'Right',top:'Top',bottom:'Bottom',topLeft:'Top Left',topRight:'Top Right'};
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const normalize=value=>((Number(value)%360)+360)%360;

export function legacyArtworkPatch(payload,state,{shareId,userId}={}){
  const config=record(payload.config);
  const rotations=record(config.textureRotationDeg);
  const placements=record(config.faceImagePlacements);
  const images=record(payload.images);
  const artwork=record(state.artworkByPanel);
  const next={...state,artworkByPanel:{...artwork}};
  const changes=[];

  for(const [faceId,label] of Object.entries(FACE_LABELS)){
    if(!images[faceId])continue;
    const art=record(artwork[label]);
    if(!Object.keys(art).length)continue;

    const textureValue=Number(rotations[faceId]);
    const correct=Number.isFinite(textureValue)?normalize(textureValue):0;
    const placementValue=Number(record(placements[faceId]).rotation);
    const oldBuggy=Number.isFinite(placementValue)?normalize(placementValue):correct;
    const current=Number(art.rotation);
    if(!Number.isFinite(current))continue;

    const sourceImage=record(images[faceId]);
    const sourceKey=sourceImage.v2StorageKey;
    const assetId=userId&&typeof sourceKey==='string'
      ? 'legacy-'+createHash('sha256').update(userId+'\0'+sourceKey).digest('hex').slice(0,24) : null;
    const sameSource=shareId
      ? art.url===`/api/shares/${encodeURIComponent(shareId)}/legacy-media/${encodeURIComponent(faceId)}`
      : assetId&&art.assetId===assetId&&art.url===`/api/media/${assetId}`;
    // Repair only unchanged legacy placements; leave replaced or transformed images alone.
    if(normalize(current)!==oldBuggy&&normalize(current)!==correct)continue;
    if(!sameSource||art.transform||art.mode!=='fill'||art.scale!==100||art.alignX!==0||art.alignY!==0)continue;
    if(normalize(current)===oldBuggy && oldBuggy!==correct){
      next.artworkByPanel[label]={...art,rotation:correct};
      changes.push({faceId,label,kind:'rotation',from:current,to:correct});
    }
    if(!record(placements[faceId]).crop&&!art.crop&&art.panelTexture!==true){
      next.artworkByPanel[label]={...next.artworkByPanel[label],panelTexture:true};
      changes.push({faceId,label,kind:'full-image-uv',from:false,to:true});
    }
  }
  return {next,changes};
}

