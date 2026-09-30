import type { CartonDimensions } from './packaging/reverse-tuck';
import type { ArtworkByPanel,LocalMediaAsset } from './packaging/artwork';
import type { FullDielineArtworkLayer } from './packaging/full-dieline-artwork';

export type LegacyOpeningMode =
 | 'closed'
 | 'lid_from_back'
 | 'lid_from_front'
 | 'lid_from_left'
 | 'lid_from_right'
 | 'top_split_meet_center'
 | 'door_left'
 | 'door_right'
 | 'double_doors';

export type StudioProjectState={
 version:1;
 templateId:string;
 dimensions:CartonDimensions;
 material:string;
 opening:number;
 formation?:number;
 openingMode?:LegacyOpeningMode;
 splitTopHingeSide?:'side_a'|'side_b';
 legacySourceId?:string;
 measurementUnit:'mm'|'in';
 artworkByPanel:ArtworkByPanel;
 outsideArtworkLayers:FullDielineArtworkLayer[];
 insideArtworkLayers:FullDielineArtworkLayer[];
 mediaAssets:LocalMediaAsset[];
 outsideColorMode:'material'|'custom';
 insideColorMode:'material'|'custom';
 outsideCustomColor:string;
 insideCustomColor:string;
};

export type SavedStudioProject={
 id:string;
 name:string;
 state:StudioProjectState;
 updatedAt:string;
 favorite:boolean;
 revision:number;
 workspaceProjectId:string|null;
 legacyImport?:boolean;
};

const TEMPLATE_IDS=new Set(['reverse-tuck-carton','base-box','split-top-box']);
const OPENING_MODES=new Set<LegacyOpeningMode>(['closed','lid_from_back','lid_from_front','lid_from_left','lid_from_right','top_split_meet_center','door_left','door_right','double_doors']);

export function validProjectState(value:unknown):value is StudioProjectState{
 if(!value||typeof value!=='object')return false;const s=value as StudioProjectState;
 if(s.version!==1||!TEMPLATE_IDS.has(s.templateId)||!s.dimensions||!['width','height','depth','thickness'].every(key=>typeof s.dimensions[key as keyof CartonDimensions]==='number'&&Number.isFinite(s.dimensions[key as keyof CartonDimensions])&&s.dimensions[key as keyof CartonDimensions]>0))return false;
 if(typeof s.material!=='string'||!['mm','in'].includes(s.measurementUnit)||!Number.isFinite(s.opening)||s.opening<0||s.opening>100)return false;
 if(s.formation!==undefined&&(!Number.isFinite(s.formation)||s.formation<0||s.formation>100))return false;
 if(s.openingMode!==undefined&&!OPENING_MODES.has(s.openingMode))return false;
 if(s.splitTopHingeSide!==undefined&&!['side_a','side_b'].includes(s.splitTopHingeSide))return false;
 if(s.legacySourceId!==undefined&&(typeof s.legacySourceId!=='string'||s.legacySourceId.length>300))return false;
 if(s.templateId==='split-top-box'&&s.openingMode!==undefined&&s.openingMode!=='top_split_meet_center')return false;
 if(!s.artworkByPanel||typeof s.artworkByPanel!=='object'||Array.isArray(s.artworkByPanel)||![s.outsideArtworkLayers,s.insideArtworkLayers,s.mediaAssets].every(list=>Array.isArray(list)&&list.length<=100))return false;
 const images=[...Object.values(s.artworkByPanel),...s.outsideArtworkLayers,...s.insideArtworkLayers,...s.mediaAssets];
 if(!images.every(item=>item&&typeof item.name==='string'&&typeof item.url==='string'&&(
  /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(item.url) ||
  /^\/api\/media\/[A-Za-z0-9-]+$/.test(item.url) ||
  /^\/api\/shares\/[0-9A-Za-z]{10,24}\/legacy-media\/[A-Za-z][A-Za-z0-9]*$/.test(item.url) ||
  /^https:\/\//.test(item.url)
 )))return false;
 return ['material','custom'].includes(s.outsideColorMode)&&['material','custom'].includes(s.insideColorMode)&&[s.outsideCustomColor,s.insideCustomColor].every(color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color));
}
