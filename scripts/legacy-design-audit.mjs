import { neon } from '@neondatabase/serverless';
import { auditLegacyDesignRows } from './legacy-design-audit-lib.mjs';

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required');
const source=process.env.LEGACY_SOURCE_NAME||'3dboxstudio-v1';
const sql=neon(databaseUrl);
const rows=await sql`SELECT source_id,payload FROM legacy_records WHERE source=${source} AND entity_type='shared_designs' AND deleted_at IS NULL ORDER BY source_id`;
const report=auditLegacyDesignRows(rows);
const pct=(n,d)=>d?((n/d)*100).toFixed(1)+'%':'0.0%';
console.log('\nLegacy design usage audit');
console.log('Source:',source);
console.log('Designs:',report.total,'| with artwork:',report.withArtwork,`(${pct(report.withArtwork,report.total)})`,'| blank:',report.blank);
console.log('\nStructural configurations');
console.table(report.structuralGroups.map(g=>({
  signature:g.signature,
  designs:g.designs,
  artwork:g.withArtwork,
  artworkPct:pct(g.withArtwork,g.designs),
  sizes:g.uniqueSizeCount,
  topMaterials:g.materials.slice(0,3).map(x=>x.value+': '+x.count).join(', '),
  examples:g.exampleSizes.slice(0,3).join('; '),
})));
console.log('\nFeature usage');
console.table([
  {feature:'Cropped artwork',designs:report.featureUsage.crops},
  {feature:'Rotated artwork',designs:report.featureUsage.rotations},
  {feature:'Non-default open amount',designs:report.featureUsage.nonDefaultOpenAmount},
]);
console.log('\nMaterials (does not imply a template)');
console.table(report.materials.map(x=>({material:x.value,designs:x.count})));
console.log('\nUnits');
console.table(report.units.map(x=>({unit:x.value,designs:x.count})));
if(process.argv.includes('--json'))console.log('\nJSON\n'+JSON.stringify(report,null,2));
