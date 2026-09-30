import { neon } from '@neondatabase/serverless';

const sourceUrl=process.env.LEGACY_DATABASE_URL?.trim();
const targetUrl=process.env.DATABASE_URL?.trim();
if(!sourceUrl) throw new Error('LEGACY_DATABASE_URL is required');
if(!targetUrl) throw new Error('DATABASE_URL is required');
if(sourceUrl===targetUrl) throw new Error('LEGACY_DATABASE_URL and DATABASE_URL must be different');

const source=neon(sourceUrl);
const target=neon(targetUrl);
const sourceName=process.env.LEGACY_SOURCE_NAME?.trim()||'3dboxstudio-v1';
const migrateSessions=process.env.MIGRATE_LEGACY_SESSIONS==='true';

await target`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT,password_hash TEXT,
    email_verified_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signup_method TEXT,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,utm_term TEXT,utm_content TEXT,
    signup_landing_page TEXT,signup_landing_type TEXT,signup_conversion_page TEXT,signup_referrer TEXT,
    signup_meta JSONB,migrated_from TEXT,migrated_at TIMESTAMPTZ
  )
`;
await target`
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    provider TEXT NOT NULL,provider_account_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY(provider,provider_account_id)
  )
`;
await target`
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL
  )
`;
await target`
  CREATE TABLE IF NOT EXISTS legacy_migrations (
    source TEXT NOT NULL,entity_type TEXT NOT NULL,source_id TEXT NOT NULL,target_id TEXT NOT NULL,
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY(source,entity_type,source_id)
  )
`;

const users=await source`
  SELECT id,email,name,password_hash,email_verified_at,created_at,signup_method,
         utm_source,utm_medium,utm_campaign,utm_term,utm_content,
         signup_landing_page,signup_landing_type,signup_conversion_page,signup_referrer,signup_meta
  FROM users ORDER BY created_at ASC
`;

const conflicts=[];
for(const user of users){
  const existing=await target`SELECT id,email FROM users WHERE id=${user.id} OR lower(email)=lower(${user.email})`;
  for(const row of existing){
    if(row.id!==user.id){
      conflicts.push({legacyId:user.id,legacyEmail:user.email,targetId:row.id,targetEmail:row.email});
    }
  }
}
if(conflicts.length){
  console.error(JSON.stringify({status:'conflict',conflicts},null,2));
  throw new Error(`Migration stopped: ${conflicts.length} email/ID conflict(s) require review`);
}

let migratedUsers=0;
for(const user of users){
  await target`
    INSERT INTO users(
      id,email,name,password_hash,email_verified_at,created_at,signup_method,
      utm_source,utm_medium,utm_campaign,utm_term,utm_content,
      signup_landing_page,signup_landing_type,signup_conversion_page,signup_referrer,signup_meta,
      migrated_from,migrated_at
    ) VALUES(
      ${user.id},${String(user.email).trim().toLowerCase()},${user.name},${user.password_hash},
      ${user.email_verified_at},${user.created_at},${user.signup_method},
      ${user.utm_source},${user.utm_medium},${user.utm_campaign},${user.utm_term},${user.utm_content},
      ${user.signup_landing_page},${user.signup_landing_type},${user.signup_conversion_page},
      ${user.signup_referrer},${user.signup_meta},${sourceName},NOW()
    )
    ON CONFLICT(id) DO UPDATE SET
      email=EXCLUDED.email,
      name=COALESCE(EXCLUDED.name,users.name),
      password_hash=COALESCE(EXCLUDED.password_hash,users.password_hash),
      email_verified_at=COALESCE(EXCLUDED.email_verified_at,users.email_verified_at),
      signup_method=COALESCE(users.signup_method,EXCLUDED.signup_method),
      migrated_from=EXCLUDED.migrated_from,
      migrated_at=NOW()
  `;
  await target`
    INSERT INTO legacy_migrations(source,entity_type,source_id,target_id,metadata)
    VALUES(${sourceName},'user',${user.id},${user.id},${JSON.stringify({email:user.email})}::jsonb)
    ON CONFLICT(source,entity_type,source_id)
    DO UPDATE SET target_id=EXCLUDED.target_id,migrated_at=NOW(),metadata=EXCLUDED.metadata
  `;
  migratedUsers++;
}

const oauth=await source`
  SELECT provider,provider_account_id,user_id,created_at
  FROM oauth_accounts ORDER BY created_at ASC
`;
for(const account of oauth){
  await target`
    INSERT INTO oauth_accounts(provider,provider_account_id,user_id,created_at)
    VALUES(${account.provider},${account.provider_account_id},${account.user_id},${account.created_at})
    ON CONFLICT(provider,provider_account_id)
    DO UPDATE SET user_id=EXCLUDED.user_id
  `;
  await target`
    INSERT INTO legacy_migrations(source,entity_type,source_id,target_id,metadata)
    VALUES(
      ${sourceName},'oauth_account',
      ${account.provider+':'+account.provider_account_id},
      ${account.user_id},
      ${JSON.stringify({provider:account.provider})}::jsonb
    )
    ON CONFLICT(source,entity_type,source_id)
    DO UPDATE SET target_id=EXCLUDED.target_id,migrated_at=NOW()
  `;
}

let migratedSessionCount=0;
if(migrateSessions){
  const sessions=await source`SELECT token,user_id,created_at,expires_at FROM sessions WHERE expires_at>NOW()`;
  for(const session of sessions){
    await target`
      INSERT INTO sessions(token,user_id,created_at,expires_at)
      VALUES(${session.token},${session.user_id},${session.created_at},${session.expires_at})
      ON CONFLICT(token) DO NOTHING
    `;
    migratedSessionCount++;
  }
}

const verified=await target`
  SELECT COUNT(*)::int AS count
  FROM legacy_migrations
  WHERE source=${sourceName} AND entity_type='user'
`;
const targetMigratedCount=Number(verified[0]?.count||0);
if(targetMigratedCount!==users.length){
  throw new Error(`Verification failed: source has ${users.length} users but migration ledger has ${targetMigratedCount}`);
}

console.log(JSON.stringify({
  status:'ok',
  source:sourceName,
  sourceUsers:users.length,
  migratedUsers,
  oauthAccounts:oauth.length,
  sessionsMigrated:migratedSessionCount,
  sessionsPolicy:migrateSessions?'migrated':'fresh V2 sessions required',
  verifiedUsers:targetMigratedCount,
},null,2));
