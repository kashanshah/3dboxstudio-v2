import { createHash } from 'node:crypto';
export const USER_FIELDS = ['name','password_hash','email_verified_at','signup_method','utm_source','utm_medium','utm_campaign','utm_term','utm_content','signup_landing_page','signup_landing_type','signup_conversion_page','signup_referrer','signup_meta'];
export const MIRROR_TABLES = ['shared_designs','contact_submissions','contact_submission_replies'];
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value ?? null;
}
export function fingerprint(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
export function userSnapshot(user) { return Object.fromEntries(USER_FIELDS.map(key => [key, user[key] ?? null])); }
export function planUserUpdate(source, target, previous) {
  const updates = {}, conflicts = [];
  if (!previous) return { updates, conflicts }; // Older imports have no merge baseline.
  for (const field of USER_FIELDS) {
    const next = source[field] ?? null, before = previous[field] ?? null, current = target[field] ?? null;
    if (fingerprint(next) === fingerprint(before)) continue;
    if (fingerprint(current) === fingerprint(next)) continue;
    if (fingerprint(current) === fingerprint(before)) updates[field] = next;
    else conflicts.push(field);
  }
  return { updates, conflicts };
}
export function planMirror(rows, existing) {
  const byId = new Map(existing.map(row => [row.source_id, row]));
  const seen = new Set(), changed = [];
  let inserted = 0, updated = 0, unchanged = 0;
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) throw new Error('Missing or duplicate source record ID');
    seen.add(row.id);
    const hash = fingerprint(row), old = byId.get(row.id);
    if (!old) inserted++;
    else if (old.source_hash !== hash || old.deleted_at) updated++;
    else { unchanged++; continue; }
    changed.push({ id: row.id, payload: row, hash });
  }
  const deleted = existing.filter(row => !seen.has(row.source_id) && !row.deleted_at).map(row => row.source_id);
  return { changed, deleted, inserted, updated, unchanged };
}
