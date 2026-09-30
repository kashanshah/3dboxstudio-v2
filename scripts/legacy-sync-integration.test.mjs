import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { runLegacySync } from './legacy-sync-run.mjs';
const schema=`CREATE TABLE users(id text primary key,email text unique,name text,password_hash text,email_verified_at timestamptz,created_at timestamptz default now(),signup_method text,utm_source text,utm_medium text,utm_campaign text,utm_term text,utm_content text,signup_landing_page text,signup_landing_type text,signup_conversion_page text,signup_referrer text,signup_meta jsonb);CREATE TABLE oauth_accounts(provider text,provider_account_id text,user_id text references users(id),created_at timestamptz default now(),primary key(provider,provider_account_id));CREATE TABLE shared_designs(id text primary key,user_id text,created_at timestamptz default now(),images jsonb,view_count int,config jsonb);`;
function client(db){return {query:async(sql,params)=>{if(sql==='SELECT pg_advisory_xact_lock(hashtext($1))')return {rows:[]};if(!params&&sql.includes(';')){const results=await db.exec(sql);return results.at(-1)??{rows:[]};}return db.query(sql,params);}};}
test('PostgreSQL: initial import, week-later changes, repeat sync, and rollback on collision',async()=>{
 const sourceDb=new PGlite(),targetDb=new PGlite();
 const source=client(sourceDb),target=client(targetDb);
 try{
 await sourceDb.exec(schema);
 await source.query("INSERT INTO users(id,email,name,password_hash) VALUES('u1','OLD@example.com','Old','password1')");
 await source.query("INSERT INTO oauth_accounts(provider,provider_account_id,user_id) VALUES('google','g1','u1')");
 await source.query("INSERT INTO shared_designs(id,user_id,images,view_count,config) VALUES('d1','u1','{\"front\":\"key\"}',1,'{\"width\":120}')");
 const dry=await runLegacySync({source,target});assert.equal(dry.users.inserted,1);
 assert.equal((await target.query("SELECT COUNT(*)::int count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count,0);
 const progress=[];
 const first=await runLegacySync({source,target,apply:true,onProgress:message=>progress.push(message)});
 assert.ok(progress.some(message=>message.includes('Read users: 1')));
 assert.ok(progress.some(message=>message.includes('shared_designs: 1')));
 assert.equal(progress.at(-1),'Database sync complete');assert.equal(first.users.inserted,1);
 await target.query("UPDATE users SET password_hash='V2-new-password' WHERE id='u1'");
 await source.query("UPDATE users SET name='Updated',password_hash='V1-new-password',email_verified_at=NOW() WHERE id='u1'");
 await source.query("UPDATE shared_designs SET view_count=20 WHERE id='d1'");
 await source.query("INSERT INTO users(id,email,name) VALUES('u2','new@example.com','New')");
 await source.query("INSERT INTO shared_designs(id,user_id,images,view_count,config) VALUES('d2','u2','{}',0,'{}')");
 const second=await runLegacySync({source,target,apply:true});assert.equal(second.users.inserted,1);assert.equal(second.users.updated,1);assert.equal(second.users.conflictingFields,1);assert.equal(second.records.shared_designs.updated,1);
 const migrated=(await target.query("SELECT * FROM users WHERE id='u1'")).rows[0];assert.equal(migrated.name,'Updated');assert.equal(migrated.password_hash,'V2-new-password');assert.ok(migrated.email_verified_at);
 const rerun=await runLegacySync({source,target,apply:true});assert.equal(rerun.users.inserted,0);assert.equal(rerun.records.shared_designs.unchanged,2);
 await source.query("DELETE FROM shared_designs WHERE id='d2'");
 assert.equal((await runLegacySync({source,target,apply:true})).records.shared_designs.deleted,1);
 assert.equal((await target.query("SELECT COUNT(*)::int count FROM legacy_records WHERE deleted_at IS NULL")).rows[0].count,1);
 await source.query("INSERT INTO users(id,email) VALUES('u3','collision@example.com')");
 await target.query("INSERT INTO users(id,email) VALUES('v2-user','collision@example.com')");
 const before=(await target.query('SELECT COUNT(*)::int count FROM legacy_sync_runs')).rows[0].count;
 await assert.rejects(runLegacySync({source,target,apply:true}),/different user/);
 await target.query('ROLLBACK');await source.query('ROLLBACK');
 assert.equal((await target.query('SELECT COUNT(*)::int count FROM legacy_sync_runs')).rows[0].count,before);
 assert.equal((await target.query("SELECT COUNT(*)::int count FROM users WHERE id='u3'")).rows[0].count,0);
 }finally{await sourceDb.close();await targetDb.close();}
});
