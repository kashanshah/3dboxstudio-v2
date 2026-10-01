import { neon } from '@neondatabase/serverless';

const databaseUrl=process.env.DATABASE_URL?.trim();
if(!databaseUrl)throw new Error('DATABASE_URL is required');
const apply=process.argv.includes('--apply');
if(process.argv.slice(2).some(arg=>!['--apply','--dry-run'].includes(arg)))throw new Error('Supported options: --dry-run or --apply');
if(apply&&process.argv.includes('--dry-run'))throw new Error('Choose --apply or --dry-run');

const sql=neon(databaseUrl);
import { legacyArtworkPatch } from './legacy-artwork-repair-plan.mjs';
const record=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};

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
    const {next,changes}=legacyArtworkPatch(payload,record(share.studio_state),{shareId:share.id});
    if(!changes.length)continue;
    repairedShares++;faceChanges+=changes.length;
    details.push({kind:'share',id:share.id,legacySourceId,changes});
    if(apply)await sql`UPDATE design_shares SET studio_state=${JSON.stringify(next)}::jsonb,updated_at=NOW() WHERE id=${share.id} AND studio_state=${JSON.stringify(share.studio_state)}::jsonb`;
  }

  const projects=await sql`
    SELECT id,user_id,name,revision,studio_state
    FROM projects
    WHERE studio_state->>'legacySourceId'=${legacySourceId}
  `;
  for(const project of projects){
    scannedProjects++;
    const {next,changes}=legacyArtworkPatch(payload,record(project.studio_state),{userId:project.user_id});
    if(!changes.length)continue;
    repairedProjects++;faceChanges+=changes.length;
    details.push({kind:'project',id:project.id,name:project.name,revision:project.revision,legacySourceId,changes});
    if(apply)await sql`UPDATE projects SET studio_state=${JSON.stringify(next)}::jsonb,revision=revision+1,updated_at=NOW() WHERE id=${project.id} AND revision=${project.revision} AND studio_state=${JSON.stringify(project.studio_state)}::jsonb`;
  }
}

const summary={mode:apply?'apply':'dry-run',legacyRecords:legacyRows.length,scannedShares,repairedShares,scannedProjects,repairedProjects,faceChanges};
console.log('\nLegacy face artwork repair');
console.table(summary);
if(details.length){
  console.log('\nAffected records');
  console.dir(details,{depth:6});
}
if(!apply)console.log('\nDry run only. Re-run with --apply after reviewing the affected records.');
