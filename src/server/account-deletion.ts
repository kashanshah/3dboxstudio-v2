import { getSql } from '@/server/db';
import { DeletionError, executeDeletion, previewDeletion } from '@/server/admin/deletions';
import { resendCampaignRequest, ResendCampaignError } from '@/server/email/campaign-resend';

export type AccountDeletionResult = { pendingFiles: number };

/**
 * Permanently deletes an account and everything it owns, using the same
 * cascade the admin deletion runs: designs, projects, scenes, share links,
 * uploaded images (database rows and stored files) and migrated V1 records.
 * Sessions, Google links and email tokens go with the users row.
 */
export async function deleteAccount(userId: string, email: string): Promise<AccountDeletionResult> {
  let result;
  // The confirmation token pins a snapshot of the records; a save landing
  // between preview and delete changes it, so take a fresh one and retry.
  for (let attempt = 0; ; attempt++) {
    const preview = await previewDeletion('user', userId);
    try { result = await executeDeletion('user', userId, preview.token); break; }
    catch (error) { if (!(error instanceof DeletionError && error.status === 409) || attempt >= 2) throw error; }
  }
  // Export ratings are kept for product stats, without the link to the person.
  await getSql().query('UPDATE export_feedback SET user_id=NULL,project_id=NULL WHERE user_id=$1', [userId]);
  await removeMailingContact(email);
  return { pendingFiles: result.pendingFiles };
}

/** Drop the person from the product-update mailing list, if they were imported into it. */
async function removeMailingContact(email: string) {
  if (!process.env.RESEND_API_KEY?.trim()) return;
  try { await resendCampaignRequest(`/contacts/${encodeURIComponent(email)}`, 'DELETE'); }
  catch (error) {
    if (error instanceof ResendCampaignError && error.providerStatus === 404) return;
    console.error('account deletion: mailing contact removal failed', { error });
  }
}
