export function databaseIdentity(value) {
  const url = new URL(value);
  // Neon pooled and direct endpoints address the same database.
  return `${url.hostname.replace(/-pooler(?=\.)/, '')}:${url.port || '5432'}${url.pathname}`;
}

export function preflightMigration({ users, oauth, targetUsers, targetOAuth, ledger }) {
  const email = value => String(value).trim().toLowerCase();
  const imported = new Set(ledger.map(row => row.source_id));
  const ids = new Set();
  const emails = new Set();
  for (const user of users) {
    if (!user.id || typeof user.email !== 'string' || !email(user.email) || ids.has(user.id) || emails.has(email(user.email))) {
      throw new Error('Source contains missing or duplicate user identities; reconcile before importing.');
    }
    ids.add(user.id);
    emails.add(email(user.email));
    for (const row of targetUsers) {
      if (row.id === user.id) {
        if (email(row.email) !== email(user.email) || !imported.has(user.id)) {
          throw new Error('Target ID collision or changed email; reconcile before importing.');
        }
      } else if (email(row.email) === email(user.email)) {
        throw new Error('Target email belongs to a different user; reconcile before importing.');
      }
    }
  }
  const keys = new Set();
  for (const account of oauth) {
    const key = JSON.stringify([account.provider, account.provider_account_id]);
    if (!ids.has(account.user_id) || keys.has(key)) {
      throw new Error('Source contains an orphaned or duplicate OAuth identity.');
    }
    keys.add(key);
    if (targetOAuth.some(row => row.provider === account.provider &&
      row.provider_account_id === account.provider_account_id && row.user_id !== account.user_id)) {
      throw new Error('OAuth identity belongs to a different target user; reconcile before importing.');
    }
  }
}
