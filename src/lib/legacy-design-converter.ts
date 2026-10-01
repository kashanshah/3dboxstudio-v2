import type { ArtworkByPanel,ArtworkPlacement,LocalMediaAsset } from '@/lib/packaging/artwork';
import type { SavedStudioProject,StudioProjectState,LegacyOpeningMode } from '@/lib/studio-project';

type JsonRecord=Record<string,unknown>;
const OPENINGS=new Set<LegacyOpeningMode>(['closed','lid_from_back','lid_from_front','lid_from_left','lid_from_right','top_split_meet_center','door_left','door_right','double_doors']);
const FACE_LABELS:Record<string,string>={
 front:'Front',back:'Back',left:'Left',right:'Right',top:'Top',bottom:'Bottom',topLeft:'Top Left',topRight:'Top Right',
};
const MATERIALS:Record<string,{material:string;color:string}>={
 kraft:{material:'Kraft',color:'#c4a574'},
 white_card:{material:'White board',color:'#f2f0ea'},
 gloss_plastic:{material:'Gloss coated',color:'#ffffff'},
 matte_plastic:{material:'Matte coated',color:'#eaeaea'},
 corrugated:{material:'Kraft',color:'#a08060'},
 metallic_foil:{material:'Foil',color:'#d4af37'},
 soft_touch_black:{material:'Soft touch',color:'#1c1d21'},
 gloss_black:{material:'Gloss coated',color:'#111114'},
 recycled_kraft_dark:{material:'Kraft',color:'#8a6b48'},
 pearl_white:{material:'Gloss coated',color:'#f4f1ea'},
 silver_foil:{material:'Foil',color:'#cbcdd2'},
 rose_gold_foil:{material:'Foil',color:'#e0a899'},
 copper_foil:{material:'Foil',color:'#b87333'},
 frosted_plastic:{material:'Matte coated',color:'#dfe6ea'},
};
function record(value:unknown):JsonRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as JsonRecord:{};}
function numeric(value:unknown,fallback:number){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)&&n>0?n:fallback;}
function clamp(value:number,min:number,max:number){return Math.min(max,Math.max(min,value));}
function assetUrl(base:string,key:string){
 const root=new URL(base);if(root.protocol!=='https:')throw new Error('LEGACY_ASSET_BASE_URL must use https');
 return root.toString().replace(/\/$/,'')+'/'+key.split('/').map(encodeURIComponent).join('/');
}
function toMm(value:number,unit:string){return unit==='in'?value*25.4:unit==='cm'?value*10:value;}
function cropOf(value:unknown){
 const placement=record(value),crop=record(placement.crop);
 const x=Number(crop.x),y=Number(crop.y),width=Number(crop.width),height=Number(crop.height);
 if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return undefined;
 return {x:clamp(x/100,0,1),y:clamp(y/100,0,1),width:clamp(width/100,0.0001,1),height:clamp(height/100,0.0001,1)};
}
function imageKey(entry:unknown){const item=record(entry);return typeof item.s3Key==='string'?item.s3Key:typeof item.s3_key==='string'?item.s3_key:'';}
function imageName(entry:unknown,fallback:string){const item=record(entry);return typeof item.name==='string'&&item.name?item.name:fallback;}
function normalizedOpening(value:unknown):LegacyOpeningMode{
 return typeof value==='string'&&OPENINGS.has(value as LegacyOpeningMode)?value as LegacyOpeningMode:'closed';
}
export function legacyDesignToStudioProject(args:{source:string;sourceId:string;payload:unknown;assetBaseUrl?:string;mediaByFace?:Record<string,LocalMediaAsset>}):SavedStudioProject|null{
 const payload=record(args.payload),config=record(payload.config),images=record(payload.images);
 const dims=record(config.dims),unit=typeof config.unit==='string'?config.unit:'cm';
 const openingMode=normalizedOpening(config.opening);
 const templateId=openingMode==='top_split_meet_center'?'split-top-box':'base-box';
 const materialId=typeof config.materialId==='string'?config.materialId:'kraft';
 const finish=MATERIALS[materialId]??MATERIALS.kraft;
 const placements=record(config.faceImagePlacements),rotations=record(config.textureRotationDeg);
 const artworkByPanel:ArtworkByPanel={};
 for(const [faceId,label] of Object.entries(FACE_LABELS)){
   const entry=images[faceId];const key=imageKey(entry);if(!key)continue;
   const media=args.mediaByFace?.[faceId];
   if(!media&&!args.assetBaseUrl)continue;
   const placement=record(placements[faceId]);
   // V1's 3D renderer applies config.textureRotationDeg to the face texture.
   // placement.rotation belongs to the crop-editor state and is not the
   // rotation used by PackagingBox when rendering the saved/shared design.
   // Prefer the renderer-facing value so migrated designs match V1 exactly.
   const textureRotation=Number(rotations[faceId]);
   const rotation=Number.isFinite(textureRotation)?textureRotation:0;
   const crop=cropOf(placement);
   const artwork:ArtworkPlacement={
     ...(media?{assetId:media.id}:{}),
     name:media?.name??imageName(entry,`${label} artwork`),
     url:media?.url??assetUrl(args.assetBaseUrl!,key),
     // V1 maps the full image to the face when no crop exists, too.
     // Never apply V2 cover/fit before the final legacy UV rectangle.
     panelTexture:true,
     ...(crop?{crop}:{}),
     mode:'fill',scale:100,rotation,alignX:0,alignY:0,
   };
   artworkByPanel[label]=artwork;
 }
 // Older split-top records can carry one whole top image instead of explicit
 // topLeft/topRight entries. Reuse it on both split panels so no artwork is lost.
 if(templateId==='split-top-box'&&artworkByPanel.Top){
   artworkByPanel['Top Left']={...artworkByPanel.Top,name:artworkByPanel.Top.name};
   artworkByPanel['Top Right']={...artworkByPanel.Top,name:artworkByPanel.Top.name};
   delete artworkByPanel.Top;
 }
 const openT=typeof config.openT==='number'&&Number.isFinite(config.openT)?config.openT:Number(config.openT);
 const state:StudioProjectState={
   version:1,
   templateId,
   dimensions:{
     width:toMm(numeric(dims.width,24),unit),
     height:toMm(numeric(dims.height,10),unit),
     depth:toMm(numeric(dims.length,16),unit),
     thickness:0.5,
   },
   material:finish.material,
   opening:openingMode==='closed'?0:clamp(Number.isFinite(openT)?openT*100:35,0,100),
   openingMode,
   splitTopHingeSide:openingMode==='top_split_meet_center'&&config.splitTopHingeSide==='side_b'?'side_b':'side_a',
   legacySourceId:`${args.source}:${args.sourceId}`,
   measurementUnit:unit==='in'?'in':'mm',
   artworkByPanel,
   outsideArtworkLayers:[],
   insideArtworkLayers:[],
   mediaAssets:Array.from(new Map(Object.values(args.mediaByFace??{}).map(asset=>[asset.id,asset])).values()),
   outsideColorMode:'custom',
   insideColorMode:'material',
   outsideCustomColor:finish.color,
   insideCustomColor:'#D7E0E7',
 };
 const updated=typeof payload.updated_at==='string'?payload.updated_at:typeof payload.created_at==='string'?payload.created_at:new Date(0).toISOString();
 return {
   id:`${args.source}:${args.sourceId}`,
   name:typeof payload.name==='string'&&payload.name.trim()?payload.name.trim():'Untitled legacy design',
   state,
   updatedAt:updated,
   favorite:false,
   revision:1,
   workspaceProjectId:null,
   legacyImport:true,
 };
}
