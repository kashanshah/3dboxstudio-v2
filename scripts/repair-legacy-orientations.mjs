import { neon } from '@neondatabase/serverless';

const databaseUrl=process.env.DATABASE_URL?.trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required');
const apply=process.argv.includes('--apply');
if(process.argv.slice(2).some(arg=>!['--apply','--dry-run'].includes(arg)))throw new Error('Supported options: --dry-run or --apply');
if(apply&&process.argv.includes('--dry-run'))throw new Error('Choose --apply or --dry-run');

const sql=neon(databaseUrl);
const FACE_LABELS={front:'Front',back:'Back',left:'Left',right:'Right',top:'Top',bottom:'Bottom',topLeft:'Top Left',topRight:'Top Right'};
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const normalize=value=>((Number(value)%360)+360)%360;

function rotationPatch(payload,state){
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

    if(normalize(current)!==oldBuggy || oldBuggy===correct)continue;
    next.artworkByPanel[label]={...art,rotation:correct};
    changes.push({faceId,label,from:current,to:correct});
  }
  return {next,changes};
}

const legacyRows=await sql`
  SELECT source,source_id,payload
  FROM legacy_records
  WHERE entity_type='shared_designs' AND deleted_at IS NULL
  ORDER BY source,source_id
`;

let scannedShares=0,repairedShares=0,scannedProjects=0,repairedProjects=0,faceChanges=0;
const details=[];

for(const row of legacyRows){
  const legacySourceId=`${row.source}:${row.source_id}`;
  const payload=record(row.payload);

  const shares=await sql`
    SELECT id,studio_state
    FROM design_shares
    WHERE legacy_source=TRUE
      AND (id=${row.source_id} OR studio_state->>'legacySourceId'=${legacySourceId})
  `;
  for(const share of shares){
    scannedShares++;
    const {next,changes}=rotationPatch(payload,record(share.studio_state));
    if(!changes.length)continue;
    repairedShares++;faceChanges+=changes.length;
    details.push({kind:'share',id:share.id,legacySourceId,changes});
    if(apply)await sql`UPDATE design_shares SET studio_state=${JSON.stringify(next)}::jsonb,updated_at=NOW() WHERE id=${share.id}`;
  }

  const projects=await sql`
    SELECT id,name,revision,studio_state
    FROM projects
    WHERE studio_state->>'legacySourceId'=${legacySourceId}
  `;
  for(const project of projects){
    scannedProjects++;
    const {next,changes}=rotationPatch(payload,record(project.studio_state));
    if(!changes.length)continue;
    repairedProjects++;faceChanges+=changes.length;
    details.push({kind:'project',id:project.id,name:project.name,revision:project.revision,legacySourceId,changes});
    if(apply)await sql`UPDATE projects SET studio_state=${JSON.stringify(next)}::jsonb,revision=revision+1,updated_at=NOW() WHERE id=${project.id}`;
  }
}

const summary={mode:apply?'apply':'dry-run',legacyRecords:legacyRows.length,scannedShares,repairedShares,scannedProjects,repairedProjects,faceChanges};
console.log('\nLegacy face orientation repair');
console.table(summary);
if(details.length){
  console.log('\nAffected records');
  console.dir(details,{depth:6});
}
if(!apply)console.log('\nDry run only. Re-run with --apply after reviewing the affected records.');
