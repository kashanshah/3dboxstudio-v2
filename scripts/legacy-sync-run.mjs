import { randomUUID } from 'node:crypto';
import { LEGACY_SYNC_SCHEMA } from '../src/server/legacy-schema.ts';
import { preflightMigration } from './legacy-migration-preflight.mjs';
import { MIRROR_TABLES, USER_FIELDS, planMirror, planUserUpdate, userSnapshot } from './legacy-sync-plan.mjs';
const identitySchema = `
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,password_hash TEXT,
 email_verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 signup_method TEXT,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,utm_term TEXT,utm_content TEXT,
 signup_landing_page TEXT,signup_landing_type TEXT,signup_conversion_page TEXT,signup_referrer TEXT,
 signup_meta JSONB,migrated_from TEXT,migrated_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
 provider TEXT NOT NULL,provider_account_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY(provider,provider_account_id)
);
CREATE TABLE IF NOT EXISTS legacy_migrations (
 source TEXT NOT NULL,entity_type TEXT NOT NULL,source_id TEXT NOT NULL,target_id TEXT NOT NULL,
 migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(source,entity_type,source_id)
);`;
async function readTable(source, table) {
  // table names come exclusively from constants, never from CLI or environment.
  await source.query(`DECLARE sync_cursor NO SCROLL CURSOR FOR SELECT to_jsonb(t) AS data FROM ${table} t ORDER BY id`);
  const rows = [];
  while (true) {
    const page = await source.query('FETCH 250 FROM sync_cursor');
    rows.push(...page.rows.map(row => row.data));
    if (page.rows.length < 250) break;
  }
  await source.query('CLOSE sync_cursor');
  return rows;
}
export async function runLegacySync({source,target,sourceName='3dboxstudio-v1',apply=false}) {
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const {rows:[{snapshot_at}]} = await source.query('SELECT transaction_timestamp() AS snapshot_at');
  const sourceTables = new Set((await source.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(row => row.table_name));
  if (!sourceTables.has('users') || !sourceTables.has('oauth_accounts')) throw new Error('Source identity tables are missing');
  const users = await readTable(source, 'users');
  const oauth = (await source.query('SELECT to_jsonb(o) AS data FROM oauth_accounts o ORDER BY provider,provider_account_id')).rows.map(row => row.data);
  const snapshots = {};
  for (const table of MIRROR_TABLES) if (sourceTables.has(table)) snapshots[table] = await readTable(source, table);
  await source.query('COMMIT');
  await target.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  if (apply) {
    await target.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['3dboxstudio-legacy-sync']);
    await target.query(identitySchema);
    await target.query(LEGACY_SYNC_SCHEMA);
    await target.query('LOCK TABLE users,oauth_accounts,legacy_migrations,legacy_records IN SHARE ROW EXCLUSIVE MODE');
  }
  const tables = new Set((await target.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")).rows.map(row => row.table_name));
  const targetUsers = tables.has('users') ? (await target.query('SELECT to_jsonb(u) AS data FROM users u')).rows.map(row => row.data) : [];
  const targetOAuth = tables.has('oauth_accounts') ? (await target.query('SELECT * FROM oauth_accounts')).rows : [];
  const ledger = tables.has('legacy_migrations') ? (await target.query("SELECT source_id,metadata FROM legacy_migrations WHERE source=$1 AND entity_type='user'",[sourceName])).rows : [];
  preflightMigration({users,oauth,targetUsers,targetOAuth,ledger});
  const byUser = new Map(targetUsers.map(user => [user.id,user]));
  const baselines = new Map(ledger.map(row => [row.source_id,row.metadata?.snapshot]));
  const report = {users:{inserted:0,updated:0,unchanged:0,conflictingFields:0,missingFromSource:ledger.filter(row=>!users.some(user=>user.id===row.source_id)).length},oauth:{inserted:0,unchanged:0},records:{},sessionsMigrated:0};
  for (const user of users) {
    const old = byUser.get(user.id);
    const plan = old ? planUserUpdate(user,old,baselines.get(user.id)) : {updates:{},conflicts:[]};
    report.users[!old?'inserted':Object.keys(plan.updates).length?'updated':'unchanged']++;
    report.users.conflictingFields += plan.conflicts.length;
    if (!apply) continue;
    if (!old) {
      const fields = ['id','email','created_at',...USER_FIELDS];
      await target.query(`INSERT INTO users(${fields.join(',')},migrated_from,migrated_at) VALUES(${fields.map((_,i)=>'$'+(i+1)).join(',')},$${fields.length+1},NOW())`,fields.map(field=>field==='email'?user.email.trim().toLowerCase():field==='signup_meta'?JSON.stringify(user[field]??null):user[field]??null).concat(sourceName));
    } else if (Object.keys(plan.updates).length) {
      const entries = Object.entries(plan.updates);
      await target.query(`UPDATE users SET ${entries.map(([field],i)=>`${field}=$${i+2}`).join(',')} WHERE id=$1`,[user.id,...entries.map(([field,value])=>field==='signup_meta'?JSON.stringify(value):value)]);
    }
    await target.query(`INSERT INTO legacy_migrations(source,entity_type,source_id,target_id,metadata) VALUES($1,'user',$2,$2,$3::jsonb) ON CONFLICT(source,entity_type,source_id) DO UPDATE SET migrated_at=NOW(),metadata=EXCLUDED.metadata`,[sourceName,user.id,JSON.stringify({snapshot:userSnapshot(user)})]);
  }
  for (const account of oauth) {
    const exists = targetOAuth.some(row=>row.provider===account.provider && row.provider_account_id===account.provider_account_id);
    report.oauth[exists?'unchanged':'inserted']++;
    if (apply) await target.query('INSERT INTO oauth_accounts(provider,provider_account_id,user_id,created_at) VALUES($1,$2,$3,$4) ON CONFLICT(provider,provider_account_id) DO NOTHING',[account.provider,account.provider_account_id,account.user_id,account.created_at]);
  }
  for (const [table,rows] of Object.entries(snapshots)) {
    const existing = tables.has('legacy_records') ? (await target.query('SELECT source_id,source_hash,deleted_at FROM legacy_records WHERE source=$1 AND entity_type=$2',[sourceName,table])).rows : [];
    const plan = planMirror(rows,existing);
    report.records[table] = {inserted:plan.inserted,updated:plan.updated,unchanged:plan.unchanged,deleted:plan.deleted.length};
    if (!apply) continue;
    for (let offset=0;offset<plan.changed.length;offset+=250) {
      await target.query(`INSERT INTO legacy_records(source,entity_type,source_id,payload,source_hash)
        SELECT $1,$2,item->>'id',item->'payload',item->>'hash' FROM jsonb_array_elements($3::jsonb) item
        ON CONFLICT(source,entity_type,source_id) DO UPDATE SET payload=EXCLUDED.payload,source_hash=EXCLUDED.source_hash,synced_at=NOW(),deleted_at=NULL`,[sourceName,table,JSON.stringify(plan.changed.slice(offset,offset+250))]);
    }
    if (plan.deleted.length) await target.query('UPDATE legacy_records SET deleted_at=NOW() WHERE source=$1 AND entity_type=$2 AND source_id=ANY($3::text[])',[sourceName,table,plan.deleted]);
    const count = (await target.query('SELECT COUNT(*)::int AS count FROM legacy_records WHERE source=$1 AND entity_type=$2 AND deleted_at IS NULL',[sourceName,table])).rows[0].count;
    if (count !== rows.length) throw new Error('Mirror verification failed');
  }
  if (apply) {
    const identities = (await target.query('SELECT id,email FROM users')).rows;
    const accounts = (await target.query('SELECT * FROM oauth_accounts')).rows;
    preflightMigration({users,oauth,targetUsers:identities,targetOAuth:accounts,ledger:users.map(user=>({source_id:user.id}))});
    if (users.some(user=>!identities.some(row=>row.id===user.id)) || oauth.some(account=>!accounts.some(row=>row.provider===account.provider && row.provider_account_id===account.provider_account_id && row.user_id===account.user_id))) throw new Error('Identity verification failed');
    await target.query('INSERT INTO legacy_sync_runs(id,source,snapshot_at,counts) VALUES($1,$2,$3,$4::jsonb)',[randomUUID(),sourceName,snapshot_at,JSON.stringify(report)]);
  }
  await target.query('COMMIT');
  return {status:apply?'completed':'dry-run',snapshotAt:snapshot_at,source:sourceName,...report,skippedTables:MIRROR_TABLES.filter(table=>!sourceTables.has(table))};
}
