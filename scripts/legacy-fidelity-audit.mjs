import { neon } from '@neondatabase/serverless';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required');
const sql=neon(databaseUrl);

function record(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
function countImageEntries(payload){
  return Object.values(record(record(payload).images)).filter(value=>{
    const item=record(value);
    return typeof item.s3Key==='string'||typeof item.s3_key==='string';
  }).length;
}
function countMigratedImageEntries(payload){
  return Object.values(record(record(payload).images)).filter(value=>typeof record(value).v2StorageKey==='string').length;
}

const legacy=await sql`
  SELECT source,source_id,payload
  FROM legacy_records
  WHERE entity_type='shared_designs' AND deleted_at IS NULL
  ORDER BY source_id
`;

const shares=await sql`
  SELECT id,preview_token,legacy_assets,legacy_source,studio_state
  FROM design_shares
  WHERE legacy_source=TRUE
`;

const byId=new Map(shares.map(row=>[row.id,row]));
const byPreview=new Map(shares.filter(row=>row.preview_token).map(row=>[row.preview_token,row]));
const issues=[];
let withArtwork=0,completeAssets=0,thumbnailMapped=0,shareMatched=0;

for(const row of legacy){
  const payload=record(row.payload);
  const preview=typeof payload.preview_token==='string'?payload.preview_token:null;
  const imageCount=countImageEntries(payload);
  const migratedImageCount=countMigratedImageEntries(payload);
  if(imageCount)withArtwork++;
  if(imageCount===migratedImageCount)completeAssets++;

  if(typeof payload.og_image_key==='string'&&payload.og_image_key){
    if(typeof payload.v2_og_image_key==='string'&&payload.v2_og_image_key)thumbnailMapped++;
    else issues.push({id:row.source_id,type:'thumbnail_not_mapped'});
  }

  const share=byId.get(row.source_id)||(preview?byPreview.get(preview):null);
  if(!share){
    issues.push({id:row.source_id,type:'missing_design_share'});
    continue;
  }
  shareMatched++;
  if(share.legacy_source!==true)issues.push({id:row.source_id,type:'share_not_marked_legacy'});
  if(preview&&share.preview_token!==preview)issues.push({id:row.source_id,type:'preview_token_mismatch',expected:preview,actual:share.preview_token});

  const assets=record(share.legacy_assets);
  const assetCount=Object.values(assets).filter(value=>typeof record(value).storageKey==='string').length;
  if(assetCount!==imageCount)issues.push({id:row.source_id,type:'legacy_asset_count_mismatch',legacy:imageCount,migrated:assetCount});
  if(migratedImageCount!==imageCount)issues.push({id:row.source_id,type:'payload_asset_mapping_incomplete',legacy:imageCount,migrated:migratedImageCount});

  const state=record(share.studio_state);
  const artwork=record(state.artworkByPanel);
  if(imageCount&&Object.keys(artwork).length===0)issues.push({id:row.source_id,type:'converted_state_missing_artwork'});
  if(typeof state.legacySourceId!=='string')issues.push({id:row.source_id,type:'missing_legacy_source_id'});
}

const summary={
  legacyRecords:legacy.length,
  migratedShares:shares.length,
  matchedShares:shareMatched,
  designsWithArtwork:withArtwork,
  completePayloadAssetMappings:completeAssets,
  migratedThumbnailKeys:thumbnailMapped,
  issues:issues.length,
};

console.log('\nLegacy migration fidelity audit');
console.table(summary);
if(issues.length){
  console.log('\nIssues');
  console.table(issues.slice(0,200));
}
if(process.argv.includes('--json'))console.log('\nJSON\n'+JSON.stringify({summary,issues},null,2));
if(issues.length)process.exitCode=1;
