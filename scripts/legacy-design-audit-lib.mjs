function asRecord(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function finite(value){const n=typeof value==='number'?value:Number(value);return Number.isFinite(n)?n:null;}
function countKeys(value){return Object.keys(asRecord(value)).length;}
function normalizedConfig(row){const payload=asRecord(row?.payload??row);return {payload,config:asRecord(payload.config)};}
export function designFacts(row){
  const {payload,config}=normalizedConfig(row);
  const opening=typeof config.opening==='string'&&config.opening?config.opening:'closed';
  const splitTopHingeSide=opening==='top_split_meet_center'
    ? (typeof config.splitTopHingeSide==='string'&&config.splitTopHingeSide?config.splitTopHingeSide:'side_a')
    : null;
  const dims=asRecord(config.dims);
  const width=finite(dims.width),height=finite(dims.height),length=finite(dims.length);
  const unit=typeof config.unit==='string'?config.unit:'cm';
  const images=asRecord(payload.images);
  const facePlacements=asRecord(config.faceImagePlacements);
  const textureRotationDeg=asRecord(config.textureRotationDeg);
  const sourceImageMeta=asRecord(config.sourceImageMeta);
  const imageCount=countKeys(images);
  const hasCrop=Object.values(facePlacements).some(v=>{const x=asRecord(v);const c=asRecord(x.crop);return ['x','y','width','height'].every(k=>finite(c[k])!==null);});
  const hasRotation=Object.values(textureRotationDeg).some(v=>(finite(v)??0)!==0)
    || Object.values(facePlacements).some(v=>(finite(asRecord(v).rotation)??0)!==0);
  const materialId=typeof config.materialId==='string'&&config.materialId?config.materialId:'kraft';
  const openT=finite(config.openT);
  return {
    id:String(payload.id??row?.source_id??''),
    name:typeof payload.name==='string'?payload.name:null,
    opening,splitTopHingeSide,
    structuralSignature:opening==='top_split_meet_center'?opening+'|'+splitTopHingeSide:opening,
    unit,width,height,length,
    materialId,
    imageCount,
    hasArtwork:imageCount>0,
    sourceImageCount:countKeys(sourceImageMeta),
    usesCrop:hasCrop,
    usesRotation:hasRotation,
    openT:openT===null?0.35:openT,
  };
}
function bump(map,key,amount=1){map.set(key,(map.get(key)??0)+amount);}
function sortedCounts(map){return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([value,count])=>({value,count}));}
export function auditLegacyDesignRows(rows){
  const facts=rows.map(designFacts);
  const signatures=new Map(),materials=new Map(),units=new Map();
  const groups=new Map();
  let withArtwork=0,crops=0,rotations=0,nonDefaultOpenAmount=0;
  for(const f of facts){
    bump(signatures,f.structuralSignature);bump(materials,f.materialId);bump(units,f.unit);
    if(f.hasArtwork)withArtwork++;if(f.usesCrop)crops++;if(f.usesRotation)rotations++;
    if(Math.abs(f.openT-0.35)>1e-9)nonDefaultOpenAmount++;
    const current=groups.get(f.structuralSignature)??{signature:f.structuralSignature,opening:f.opening,splitTopHingeSide:f.splitTopHingeSide,designs:0,withArtwork:0,uniqueSizes:new Set(),materials:new Map()};
    current.designs++;if(f.hasArtwork)current.withArtwork++;
    if(f.width!==null&&f.height!==null&&f.length!==null)current.uniqueSizes.add(`${f.width}×${f.height}×${f.length} ${f.unit}`);
    bump(current.materials,f.materialId);
    groups.set(f.structuralSignature,current);
  }
  return {
    total:facts.length,
    withArtwork,
    blank:facts.length-withArtwork,
    featureUsage:{crops,rotations,nonDefaultOpenAmount},
    structuralGroups:[...groups.values()].sort((a,b)=>b.designs-a.designs||a.signature.localeCompare(b.signature)).map(g=>({
      signature:g.signature,opening:g.opening,splitTopHingeSide:g.splitTopHingeSide,designs:g.designs,withArtwork:g.withArtwork,
      uniqueSizeCount:g.uniqueSizes.size,exampleSizes:[...g.uniqueSizes].slice(0,8),materials:sortedCounts(g.materials),
    })),
    materials:sortedCounts(materials),
    units:sortedCounts(units),
    signatures:sortedCounts(signatures),
  };
}
