import { ensureV2Schema, getSql } from '@/server/db';
import { adminUserHref } from '@/lib/admin-media';
import { adminEmailAddress } from '@/lib/admin-email-address';

export async function emailUserHrefs(addresses: string[]): Promise<Record<string, string>> {
  const emails = [...new Set(addresses.map(adminEmailAddress).filter(Boolean))];
  if (!emails.length) return {};
  await ensureV2Schema();
  const rows = await getSql().query(
    'SELECT id, email FROM users WHERE lower(trim(email)) = ANY($1::text[])',
    [emails],
  ) as { id: string; email: string }[];
  return Object.fromEntries(rows.map((user) => [adminEmailAddress(user.email), adminUserHref(user.id)]));
}
