import { Pool, neonConfig } from '@neondatabase/serverless';
import { databaseIdentity } from './legacy-migration-preflight.mjs';
import { runLegacySync } from './legacy-sync-run.mjs';

// WebSocket transactions allow cursor pagination without the HTTP response-size limit.
neonConfig.webSocketConstructor = WebSocket;
const sourceUrl = process.env.LEGACY_DATABASE_URL?.trim();
const targetUrl = process.env.DATABASE_URL?.trim();
if (!sourceUrl || !targetUrl) throw new Error('LEGACY_DATABASE_URL and DATABASE_URL are required');
if (databaseIdentity(sourceUrl) === databaseIdentity(targetUrl)) throw new Error('Source and target databases must be different');
if (process.env.MIGRATE_LEGACY_SESSIONS === 'true') throw new Error('Sessions and reset tokens cannot be imported');
const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some(arg => !['--apply','--dry-run'].includes(arg))) throw new Error('Supported options: --dry-run or --apply');
if (apply && process.argv.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
const sourceName = process.env.LEGACY_SOURCE_NAME?.trim() || '3dboxstudio-v1';
const pools = [new Pool({connectionString: sourceUrl}),new Pool({connectionString: targetUrl})];
let source, target;
try {
  source = await pools[0].connect(); target = await pools[1].connect();
  console.log(JSON.stringify(await runLegacySync({source,target,sourceName,apply}),null,2));
} catch (error) {
  if (source) await source.query('ROLLBACK').catch(()=>{});
  if (target) await target.query('ROLLBACK').catch(()=>{});
  // Do not print driver errors that may contain rows, credentials, or password hashes.
  console.error(error.code ? `Sync failed (${error.code}); target transaction rolled back.` : error.message);
  process.exitCode = 1;
} finally {
  source?.release(); target?.release(); await Promise.all(pools.map(pool=>pool.end()));
}
