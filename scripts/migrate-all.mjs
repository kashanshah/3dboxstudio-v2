import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { databaseIdentity } from './legacy-migration-preflight.mjs';
import { assetSyncConfig } from './legacy-asset-sync.mjs';

export function migrationMode(args) {
  if (args.some(arg => !['--apply', '--dry-run'].includes(arg))) throw new Error('Supported options: --dry-run or --apply');
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --apply or --dry-run');
  return args.includes('--apply') ? '--apply' : '--dry-run';
}

function runScript(script, mode) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), mode], {
      stdio: 'inherit', env: process.env,
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} stopped (${signal || `exit ${code}`}). Fix the reported issue and rerun the same command; completed migrations will be reused.`));
    });
  });
}

export async function runAllMigrations({ args = [], env = process.env, run = runScript, log = console.log }) {
  const mode = migrationMode(args);
  // Validate both stages before an apply can commit database changes.
  const source = env.LEGACY_DATABASE_URL?.trim(), target = env.DATABASE_URL?.trim();
  if (!source || !target) throw new Error('LEGACY_DATABASE_URL and DATABASE_URL are required');
  if (databaseIdentity(source) === databaseIdentity(target)) throw new Error('Source and target databases must be different');
  if (env.MIGRATE_LEGACY_SESSIONS === 'true') throw new Error('Sessions and reset tokens cannot be imported');
  assetSyncConfig(env);
  log(`Legacy migration: ${mode === '--apply' ? 'APPLY' : 'DRY RUN (no writes)'}`);
  const steps = [
    ['Users, Google identities, designs, contacts and replies', './migrate-legacy-users.mjs'],
    ['Legacy S3 assets', './legacy-asset-sync.mjs'],
    ['Legacy share links and V2 storage references', './migrate-legacy-shares.mjs'],
    ['Legacy face artwork fidelity repair', './repair-legacy-orientations.mjs'],
  ];
  for (const [index, [label, script]] of steps.entries()) {
    const started = Date.now();
    log(`[${index + 1}/${steps.length}] Starting: ${label}`);
    const heartbeat = setInterval(() => log(`[${index + 1}/${steps.length}] ${label}: still running (${Math.round((Date.now() - started) / 1000)}s)`), 10000);
    try { await run(script, mode); }
    finally { clearInterval(heartbeat); }
    log(`[${index + 1}/${steps.length}] Finished: ${label} (${Math.round((Date.now() - started) / 1000)}s)`);
  }
  log('All migration stages completed. Legacy users, records, assets, share links and face orientations are now represented faithfully in V2-owned storage/data.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runAllMigrations({ args: process.argv.slice(2) }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
