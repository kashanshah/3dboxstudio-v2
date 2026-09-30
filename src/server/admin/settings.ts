import { ensureV2Schema, getSql } from '@/server/db';

export type AdminNotificationPreferenceKey = 'signup'|'export'|'contactMessage'|'newsletterSubmission';
export type AdminNotificationPreferences = Record<AdminNotificationPreferenceKey, boolean>;
export type AdminSettings = { notificationEmail: string; notificationPreferences: AdminNotificationPreferences };

export const DEFAULT_ADMIN_NOTIFICATION_PREFERENCES: AdminNotificationPreferences = {
  signup:true, export:true, contactMessage:true, newsletterSubmission:true,
};

function sanitize(value: unknown): AdminNotificationPreferences {
  const raw = value && typeof value === 'object' ? value as Record<string,unknown> : {};
  return {
    signup: typeof raw.signup === 'boolean' ? raw.signup : true,
    export: typeof raw.export === 'boolean' ? raw.export : true,
    contactMessage: typeof raw.contactMessage === 'boolean' ? raw.contactMessage : true,
    newsletterSubmission: typeof raw.newsletterSubmission === 'boolean' ? raw.newsletterSubmission : true,
  };
}
export async function getAdminSettings(): Promise<AdminSettings> {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`SELECT key,value FROM admin_settings WHERE key IN ('notification_email','notification_preferences')` as {key:string;value:unknown}[];
  const n=rows.find(r=>r.key==='notification_email')?.value as {email?:unknown}|undefined;
  return {
    notificationEmail: typeof n?.email==='string' && n.email.trim() ? n.email.trim() : (process.env.ADMIN_EMAIL?.trim() || ''),
    notificationPreferences: sanitize(rows.find(r=>r.key==='notification_preferences')?.value),
  };
}
export async function setAdminSettings(settings: AdminSettings) {
  await ensureV2Schema();
  const db=getSql();
  await db`INSERT INTO admin_settings (key,value,updated_at) VALUES ('notification_email', ${JSON.stringify({email:settings.notificationEmail})}::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`;
  await db`INSERT INTO admin_settings (key,value,updated_at) VALUES ('notification_preferences', ${JSON.stringify(settings.notificationPreferences)}::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`;
}
