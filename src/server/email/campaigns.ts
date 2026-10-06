import { createHash, randomUUID } from 'node:crypto';
import { CampaignError, EMAIL, requireId, renderCampaign, senderEmail, validateContent, validateSendContent, campaignScheduleIso, type Campaign, type CampaignContent, type CampaignReview, type ImportJob, type Segment } from '@/lib/email-campaigns';
import { ensureCampaignSchema, campaignSql } from './campaign-schema';
import { allResendRows, resendCampaignRequest, ResendCampaignError, type ProviderBroadcast, type ProviderContact, type ProviderDomain, type ProviderPage } from './campaign-resend';
import { webhookConfiguration } from './campaign-webhook';

type Row = Record<string, unknown>;
function iso(value: unknown): string | null { return value ? new Date(String(value)).toISOString() : null; }
function mapCampaign(row: Row): Campaign {
  return { ...(row.content as CampaignContent), html:String((row.content as Partial<CampaignContent>).html || ''),text:String((row.content as Partial<CampaignContent>).text || ''), id: String(row.id), revision: Number(row.revision), status: String(row.status), broadcastId: row.broadcast_id as string | null, scheduledAt: iso(row.scheduled_at), timeZone: String(row.time_zone), testedRevision: row.tested_revision == null ? null : Number(row.tested_revision), testEmailId: row.test_email_id as string | null, testRecipient: row.test_recipient as string | null, testedAt: iso(row.tested_at), metrics: row.metrics as Record<string, number>, metricsAt: iso(row.metrics_at), lastError: row.last_error as string | null, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!, busy: Boolean(row.lock_until && new Date(String(row.lock_until)).getTime() > Date.now()) };
}
export async function campaignAudit(id: string | null, action: string, detail: unknown = {}) {
  await campaignSql()`INSERT INTO email_campaign_audit(id,campaign_id,action,detail) VALUES (${randomUUID()},${id},${action},${JSON.stringify(detail)}::jsonb)`;
}
export async function listCampaigns(page = 1) {
  await ensureCampaignSchema();
  const db = campaignSql();
  const [rows, counts, jobs, aggregate] = await Promise.all([
    db`SELECT id,content - 'html' - 'text' AS content,revision,status,broadcast_id,scheduled_at,time_zone,tested_revision,test_email_id,test_recipient,tested_at,metrics,metrics_at,last_error,created_at,updated_at,lock_until FROM email_campaigns ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`,
    db`SELECT COUNT(*)::int AS total FROM email_campaigns`,
    db`SELECT * FROM email_campaign_imports ORDER BY created_at DESC LIMIT 10`,
    db`SELECT COALESCE(SUM((metrics->>'sent')::numeric),0) AS sent, COALESCE(SUM((metrics->>'delivered')::numeric),0) AS delivered, COALESCE(SUM((metrics->>'unique_opened')::numeric),0) AS unique_opened, COALESCE(SUM((metrics->>'unique_clicked')::numeric),0) AS unique_clicked, COALESCE(SUM((metrics->>'bounced')::numeric),0) AS bounced, COALESCE(SUM((metrics->>'complained')::numeric),0) AS complained, COALESCE(SUM((metrics->>'unsubscribed')::numeric),0) AS unsubscribed, COALESCE(SUM((metrics->>'suppressed')::numeric),0) AS suppressed, MIN(metrics_at) AS oldest_refresh FROM email_campaigns WHERE metrics_at IS NOT NULL`,
  ]);
  return { campaigns: rows.map(mapCampaign), total: Number(counts[0].total), jobs: jobs.map(mapImport), totals: Object.fromEntries(Object.entries(aggregate[0]).map(([key,value]) => [key, key === 'oldest_refresh' ? iso(value) : Number(value)])), webhook: await webhookConfiguration(), defaultFrom: process.env.EMAIL_CAMPAIGN_FROM?.trim() || process.env.EMAIL_FROM?.trim() || '' };
}
export async function getCampaign(id: string) {
  requireId(id); await ensureCampaignSchema();
  const rows = await campaignSql()`SELECT * FROM email_campaigns WHERE id=${id}`;
  if (!rows.length) throw new CampaignError('Campaign not found.', 404);
  return mapCampaign(rows[0]);
}
export async function createCampaign(input: unknown) {
  const content = validateContent(input);
  await ensureCampaignSchema();
  const id = randomUUID();
  await campaignSql()`INSERT INTO email_campaigns(id,content) VALUES (${id},${JSON.stringify(content)}::jsonb)`;
  await campaignAudit(id, 'created');
  return getCampaign(id);
}
export async function saveCampaign(id: string, revision: number, input: unknown) {
  const content = validateContent(input); requireId(id); await ensureCampaignSchema();
  const rows = await campaignSql()`UPDATE email_campaigns SET content=${JSON.stringify(content)}::jsonb,revision=revision+1,updated_at=NOW(),last_error=NULL WHERE id=${id} AND revision=${revision} AND status='draft' AND (lock_until IS NULL OR lock_until<NOW()) RETURNING id`;
  if (!rows.length) throw new CampaignError('This campaign changed or is locked. Refresh before editing.', 409);
  await campaignAudit(id, 'saved', { revision: revision + 1 });
  return getCampaign(id);
}
async function lockCampaign(id: string, revision?: number): Promise<string> {
  const token = randomUUID();
  const rows = await campaignSql()`UPDATE email_campaigns SET lock_token=${token},lock_until=NOW()+INTERVAL '300 seconds' WHERE id=${id} AND (${revision ?? null}::int IS NULL OR revision=${revision ?? null}) AND (lock_until IS NULL OR lock_until<NOW()) RETURNING id`;
  if (!rows.length) throw new CampaignError('Another operation is running or this campaign changed. Refresh and try again.', 409);
  return token;
}
async function unlockCampaign(id: string, token: string) {
  await campaignSql()`UPDATE email_campaigns SET lock_token=NULL,lock_until=NULL WHERE id=${id} AND lock_token=${token}`;
}
async function lockSegment(id: string) {
  const token = randomUUID();
  const rows = await campaignSql()`INSERT INTO email_campaign_segment_locks(id,lock_token,lock_until) VALUES (${id},${token},NOW()+INTERVAL '300 seconds') ON CONFLICT(id) DO UPDATE SET lock_token=EXCLUDED.lock_token,lock_until=EXCLUDED.lock_until WHERE email_campaign_segment_locks.lock_until<NOW() RETURNING id`;
  if (!rows.length) throw new CampaignError('Another operation is updating this segment. Try again shortly.',409);
  return token;
}
async function unlockSegment(id: string, token: string) {
  await campaignSql()`DELETE FROM email_campaign_segment_locks WHERE id=${id} AND lock_token=${token}`;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 700) : 'Campaign operation failed.'; }
async function recordFailure(id: string, error: unknown) {
  await campaignSql()`UPDATE email_campaigns SET last_error=${errorMessage(error)},updated_at=NOW() WHERE id=${id}`;
  await campaignAudit(id,'operation_failed',{error:errorMessage(error)});
}

export async function listSegments() { return allResendRows<Segment>('/segments'); }
export async function createSegment(name: unknown) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new CampaignError('Enter a segment name (up to 100 characters).');
  const existing = (await listSegments()).find(s => s.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) throw new CampaignError('A segment with that name already exists.', 409);
  const segment = await resendCampaignRequest<{ id: string }>('/segments', 'POST', { name: name.trim() });
  requireId(segment.id);
  await ensureCampaignSchema(); await campaignAudit(null, 'segment_created', { segmentId: segment.id, name: name.trim() });
  return { id: segment.id, name: name.trim() };
}
export async function segmentContacts(segmentId: string, after = '') {
  requireId(segmentId);
  return resendCampaignRequest<ProviderPage<ProviderContact>>(`/segments/${segmentId}/contacts?limit=25${after ? `&after=${encodeURIComponent(after)}` : ''}`);
}
async function recipientReview(segmentId: string) {
  const segment = await resendCampaignRequest<Segment>(`/segments/${requireId(segmentId)}`);
  const contacts = await allResendRows<ProviderContact>(`/segments/${segmentId}/contacts`);
  const eligible = contacts.filter(c => !c.unsubscribed);
  return { segmentName: segment.name, eligible: eligible.length, unsubscribed: contacts.length - eligible.length, fingerprint: createHash('sha256').update(eligible.map(c => `${c.id}:${c.email.toLowerCase()}`).sort().join('\n')).digest('hex') };
}
export async function senderDomain(from: string) {
  const host = senderEmail(from).split('@')[1];
  const domains = await allResendRows<ProviderDomain>('/domains');
  // Sending from a child host of a verified domain is supported by Resend.
  const domain = domains.filter(d => host === d.name.toLowerCase() || host.endsWith(`.${d.name.toLowerCase()}`)).sort((a,b) => b.name.length - a.name.length)[0];
  if (!domain) throw new CampaignError('Add and verify the sender domain in Resend before sending.');
  return resendCampaignRequest<ProviderDomain>(`/domains/${domain.id}`);
}
export async function enableCampaignTracking(from: string) {
  const domain = await senderDomain(from);
  await resendCampaignRequest(`/domains/${domain.id}`, 'PATCH', { open_tracking: true, click_tracking: true });
  await ensureCampaignSchema(); await campaignAudit(null, 'tracking_enabled', { domain: domain.name });
  return senderDomain(from);
}
export async function reviewCampaign(id: string): Promise<CampaignReview> {
  const campaign = await getCampaign(id);
  validateSendContent(campaign);
  const recipients = await recipientReview(campaign.segmentId);
  const domain = await senderDomain(campaign.from);
  const usage = await resendCampaignRequest<Record<string, unknown>>('/usage');
  return { ...recipients, revision: campaign.revision, domain, usage, webhookReady: (await webhookConfiguration()).ready };
}
export async function testCampaign(id: string, revision: number, recipient: unknown, requestId: unknown) {
  if (typeof recipient !== 'string' || !EMAIL.test(recipient.trim()) || recipient.length > 254) throw new CampaignError('Enter one valid test email address.');
  requireId(requestId);
  let campaign = await getCampaign(id);
  const token = await lockCampaign(id, revision);
  try {
    campaign = await getCampaign(id);
    if (campaign.status !== 'draft') throw new CampaignError('Only drafts can be tested. Duplicate this campaign to make a new draft.', 409);
    const rendered = renderCampaign(campaign, true);
    const result = await resendCampaignRequest<{ id: string }>('/emails', 'POST', { from: campaign.from, to: [recipient.trim()], subject: `[TEST] ${campaign.subject}`, ...rendered, ...(campaign.replyTo ? { reply_to: [campaign.replyTo] } : {}), tags: [{ name: 'campaign_id', value: id }, { name: 'campaign_test', value: 'true' }] }, `campaign-test/${id}/${revision}/${requestId}`);
    requireId(result.id);
    await campaignSql()`UPDATE email_campaigns SET tested_revision=${revision},test_email_id=${result.id},test_recipient=${recipient.trim()},tested_at=NOW(),last_error=NULL WHERE id=${id} AND lock_token=${token}`;
    await campaignAudit(id, 'test_accepted', { recipient: recipient.trim(), emailId: result.id, revision });
  } catch (error) { await recordFailure(id, error); throw error; }
  finally { await unlockCampaign(id, token); }
  return getCampaign(id);
}

/** Once a create request was attempted, recovery adopts the uniquely named remote draft.
 * A missing draft after an ambiguous response is never automatically recreated. */
async function remoteBroadcast(campaign: Campaign): Promise<ProviderBroadcast> {
  if (campaign.broadcastId) return resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${campaign.broadcastId}`);
  const name = `${campaign.name.slice(0,100)} [${campaign.id}]`;
  const rows = await campaignSql()`SELECT create_attempted FROM email_campaigns WHERE id=${campaign.id}`;
  if (rows[0].create_attempted) {
    const matches = (await allResendRows<ProviderBroadcast>('/broadcasts')).filter(b => b.name.endsWith(`[${campaign.id}]`));
    if (matches.length !== 1) throw new CampaignError('The previous draft creation has an uncertain result. Check Resend for a broadcast whose name ends with this campaign ID. Duplicate this campaign only after confirming no broadcast was created or scheduled.', 409);
    await campaignSql()`UPDATE email_campaigns SET broadcast_id=${matches[0].id} WHERE id=${campaign.id}`;
    return resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${matches[0].id}`);
  }
  await campaignSql()`UPDATE email_campaigns SET create_attempted=TRUE WHERE id=${campaign.id}`;
  let result: { id: string };
  try {
    result = await resendCampaignRequest<{ id: string }>('/broadcasts', 'POST', { name, segment_id: campaign.segmentId, from: campaign.from, subject: campaign.subject, preview_text: campaign.previewText, ...renderCampaign(campaign), ...(campaign.replyTo ? { reply_to: [campaign.replyTo] } : {}), send: false });
  } catch (error) {
    // An explicit rejected create cannot have created a draft. Transport/5xx errors remain uncertain.
    if (error instanceof ResendCampaignError && error.providerStatus >= 400 && error.providerStatus < 500) await campaignSql()`UPDATE email_campaigns SET create_attempted=FALSE WHERE id=${campaign.id}`;
    throw error;
  }
  requireId(result.id);
  await campaignSql()`UPDATE email_campaigns SET broadcast_id=${result.id} WHERE id=${campaign.id}`;
  return resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${result.id}`);
}
async function persistRemote(id: string, remote: ProviderBroadcast) {
  if (!['draft','scheduled','queued','sending','sent','canceled','cancelled','failed'].includes(remote.status)) throw new CampaignError('Resend returned an unknown campaign status.', 502);
  await campaignSql()`UPDATE email_campaigns SET status=${remote.status === 'cancelled' ? 'canceled' : remote.status},scheduled_at=${remote.scheduled_at || null}::timestamptz,updated_at=NOW(),last_error=NULL WHERE id=${id}`;
}
export async function scheduleCampaign(id: string, input: { revision: number; fingerprint: string; wallTime: string; timeZone: string; confirmed: boolean }) {
  if (input.confirmed !== true) throw new CampaignError('Review the campaign and confirm scheduling.');
  let campaign = await getCampaign(id);
  const token = await lockCampaign(id, input.revision);
  let segmentToken: string | null = null;
  try {
    campaign = await getCampaign(id);
    segmentToken = await lockSegment(campaign.segmentId);
    if (campaign.status !== 'draft') throw new CampaignError('Only a draft can be scheduled.', 409);
    if (campaign.testedRevision !== campaign.revision) throw new CampaignError('Send a test of the current saved revision first.');
    const scheduledAt = campaignScheduleIso(input.wallTime, input.timeZone);
    const review = await reviewCampaign(id);
    if (review.fingerprint !== input.fingerprint) throw new CampaignError('Recipients changed. Review the campaign again.', 409);
    if (!review.eligible) throw new CampaignError('The segment has no subscribed contacts.');
    if (review.domain.status !== 'verified') throw new CampaignError('The sender domain must be verified.');
    if (!review.domain.open_tracking || !review.domain.click_tracking) throw new CampaignError('Enable open and click tracking before scheduling.');
    if (!review.webhookReady) throw new CampaignError('Configure campaign webhooks before scheduling.');
    const jobs = await campaignSql()`SELECT id FROM email_campaign_imports WHERE segment_id=${campaign.segmentId} AND status IN ('pending','running','failed') LIMIT 1`;
    if (jobs.length) throw new CampaignError('Finish the segment import before scheduling.');
    const remote = await remoteBroadcast(campaign);
    if (remote.status !== 'draft') { await persistRemote(id, remote); throw new CampaignError('Resend already scheduled or sent this broadcast. Status has been refreshed.', 409); }
    await resendCampaignRequest(`/broadcasts/${remote.id}`, 'PATCH', { segment_id: campaign.segmentId, from: campaign.from, subject: campaign.subject, preview_text: campaign.previewText, ...renderCampaign(campaign), reply_to: campaign.replyTo ? [campaign.replyTo] : [] });
    // Persist intent before the external call so a process crash is visible and recoverable.
    await campaignSql()`UPDATE email_campaigns SET status='scheduling',scheduled_at=${scheduledAt}::timestamptz,time_zone=${input.timeZone},updated_at=NOW() WHERE id=${id}`;
    await campaignAudit(id, 'schedule_requested', { scheduledAt, timeZone: input.timeZone, revision: campaign.revision, eligible: review.eligible, fingerprint: review.fingerprint });
    await resendCampaignRequest(`/broadcasts/${remote.id}/send`, 'POST', { scheduled_at: scheduledAt });
    await persistRemote(id, await resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${remote.id}`));
    await campaignAudit(id, 'scheduled', { broadcastId: remote.id, scheduledAt });
  } catch (error) { await recordFailure(id, error); throw error; }
  finally { if (segmentToken) await unlockSegment(campaign.segmentId,segmentToken); await unlockCampaign(id, token); }
  return getCampaign(id);
}
export async function cancelCampaign(id: string) {
  const campaign = await getCampaign(id);
  const token = await lockCampaign(id);
  try {
    if (!campaign.broadcastId) throw new CampaignError('This campaign has no Resend broadcast.');
    const remote = await resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${campaign.broadcastId}`);
    if (!['scheduled','queued'].includes(remote.status)) { await persistRemote(id,remote); throw new CampaignError('Only a scheduled or queued broadcast can be canceled. Emails already sent cannot be recalled.',409); }
    await resendCampaignRequest(`/broadcasts/${campaign.broadcastId}/cancel`, 'POST');
    await persistRemote(id, await resendCampaignRequest<ProviderBroadcast>(`/broadcasts/${campaign.broadcastId}`));
    await campaignAudit(id, 'canceled');
  } catch (error) { await recordFailure(id,error); throw error; }
  finally { await unlockCampaign(id,token); }
  return getCampaign(id);
}
export async function refreshCampaign(id: string) {
  const campaign = await getCampaign(id);
  const token = await lockCampaign(id);
  try {
    const attempted = await campaignSql()`SELECT create_attempted FROM email_campaigns WHERE id=${id}`;
    if (!campaign.broadcastId && !attempted[0].create_attempted) return campaign;
    const remote = await remoteBroadcast(campaign);
    await persistRemote(id,remote);
    const params = new URLSearchParams({ start_date: campaign.createdAt, end_date: new Date().toISOString(), broadcast_id: remote.id, dimensions: 'period', timezone: campaign.timeZone });
    const report = await resendCampaignRequest<{ totals: Record<string, number>; data?: Row[] }>(`/emails/metrics?${params}`);
    if (!report.totals || Object.values(report.totals).some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new CampaignError('Resend returned invalid metrics.',502);
    await campaignSql()`UPDATE email_campaigns SET metrics=${JSON.stringify(report.totals)}::jsonb,metrics_at=NOW() WHERE id=${id}`;
    return { ...(await getCampaign(id)), trend: report.data || [] };
  } catch(error) { await recordFailure(id,error); throw error; }
  finally { await unlockCampaign(id,token); }
}
/** One provider request refreshes up to 100 recent broadcasts for dashboard totals. */
export async function refreshCampaignTotals() {
  await ensureCampaignSchema();
  const rows = await campaignSql()`SELECT broadcast_id,created_at FROM email_campaigns WHERE broadcast_id IS NOT NULL ORDER BY created_at DESC LIMIT 100`;
  if (!rows.length) return;
  const start = rows.reduce((first,row)=>new Date(String(row.created_at)).getTime()<new Date(String(first)).getTime()?String(row.created_at):first,String(rows[0].created_at));
  const params = new URLSearchParams({ start_date:new Date(start).toISOString(),end_date:new Date().toISOString(),broadcast_id:rows.map(r=>String(r.broadcast_id)).join(','),dimensions:'broadcast' });
  const report = await resendCampaignRequest<{data:Row[]}>(`/emails/metrics?${params}`);
  if (!Array.isArray(report.data)) throw new CampaignError('Resend returned invalid dashboard metrics.',502);
  const metrics = report.data.filter(row=>rows.some(c=>c.broadcast_id===row.broadcast_id)).map(row=>({ broadcast_id:row.broadcast_id,...Object.fromEntries(Object.entries(row).filter(([,value])=>typeof value==='number' && Number.isFinite(value))) }));
  await campaignSql()`UPDATE email_campaigns c SET metrics=(d.value - 'broadcast_id'),metrics_at=NOW() FROM jsonb_array_elements(${JSON.stringify(metrics)}::jsonb) d WHERE c.broadcast_id=d.value->>'broadcast_id'`;
}
export async function campaignActivity(id: string) {
  const campaign = await getCampaign(id);
  const db = campaignSql();
  const [events,audit,recorded] = await Promise.all([
    db`SELECT event_type,recipient,link,occurred_at,detail FROM email_campaign_events WHERE (broadcast_id IS NOT NULL AND broadcast_id=${campaign.broadcastId}) OR (email_id IS NOT NULL AND email_id=${campaign.testEmailId}) ORDER BY occurred_at DESC LIMIT 50`,
    db`SELECT action,detail,created_at FROM email_campaign_audit WHERE campaign_id=${id} ORDER BY created_at DESC LIMIT 30`,
    db`SELECT event_type,COUNT(*)::int AS events,COUNT(DISTINCT email_id)::int AS emails FROM email_campaign_events WHERE broadcast_id IS NOT NULL AND broadcast_id=${campaign.broadcastId} GROUP BY event_type`,
  ]);
  return { campaign, events, audit, recorded };
}

type ImportRecipient = { email: string; name: string | null };
function mapImport(row: Row): ImportJob { return { id: String(row.id), segmentId: String(row.segment_id), filter: String(row.source_filter), total: (row.recipients as ImportRecipient[]).length, processed: Number(row.processed), skipped: Number(row.skipped), status: String(row.status), error: row.last_error as string | null }; }
const FILTERS: Record<string,string> = { verified: 'email_verified_at IS NOT NULL', migrated: 'migrated_from IS NOT NULL', all: 'TRUE' };
export async function importCandidates(filter: string) {
  if (!FILTERS[filter]) throw new CampaignError('Invalid recipient filter.');
  await ensureCampaignSchema();
  const rows = await campaignSql().query(`SELECT LOWER(TRIM(email)) AS email,MAX(name) AS name FROM users WHERE ${FILTERS[filter]} GROUP BY LOWER(TRIM(email)) ORDER BY LOWER(TRIM(email))`);
  return rows.map(row=>({email:String(row.email),name:row.name == null ? null : String(row.name)})).filter(row=>EMAIL.test(row.email));
}
export async function startSegmentImport(segmentId: string, filter: string, confirmed: boolean) {
  requireId(segmentId);
  if (!confirmed) throw new CampaignError('Confirm that these contacts are eligible to receive product updates.');
  await resendCampaignRequest(`/segments/${segmentId}`);
  await ensureCampaignSchema();
  const segmentToken = await lockSegment(segmentId);
  try {
  const recipients = (await importCandidates(filter)).filter(r => EMAIL.test(r.email));
  if (!recipients.length) throw new CampaignError('No valid email addresses match this filter.');
  const active = await campaignSql()`SELECT id FROM email_campaigns WHERE content->>'segmentId'=${segmentId} AND status IN ('scheduling','scheduled','queued','sending') LIMIT 1`;
  if (active.length) throw new CampaignError('This segment has an active campaign. Use another segment for imports.',409);
  const id = randomUUID();
  await campaignSql()`INSERT INTO email_campaign_imports(id,segment_id,source_filter,recipients) VALUES (${id},${segmentId},${filter},${JSON.stringify(recipients)}::jsonb)`;
  await campaignAudit(null,'segment_import_started',{ jobId:id, segmentId, filter, total:recipients.length });
  return mapImport((await campaignSql()`SELECT * FROM email_campaign_imports WHERE id=${id}`)[0]);
  } finally { await unlockSegment(segmentId,segmentToken); }
}
export async function runImportChunk(id: string) {
  requireId(id); await ensureCampaignSchema();
  const token = randomUUID();
  const rows = await campaignSql()`UPDATE email_campaign_imports SET lock_token=${token},lock_until=NOW()+INTERVAL '300 seconds',status='running',last_error=NULL WHERE id=${id} AND status IN ('pending','running','failed') AND (lock_until IS NULL OR lock_until<NOW()) RETURNING *`;
  if (!rows.length) throw new CampaignError('Import is complete or another request is processing it.',409);
  const row = rows[0];
  const recipients = row.recipients as ImportRecipient[];
  const segmentId = String(row.segment_id);
  let processed = Number(row.processed), skipped = Number(row.skipped);
  let segmentToken: string | null = null;
  try {
    segmentToken = await lockSegment(segmentId);
    const active = await campaignSql()`SELECT id FROM email_campaigns WHERE content->>'segmentId'=${segmentId} AND status IN ('scheduling','scheduled','queued','sending') LIMIT 1`;
    if (active.length) throw new CampaignError('This segment now has an active campaign. Import paused.',409);
    const end = Math.min(processed + 10,recipients.length);
    const startedAt = Date.now();
    while (processed < end && Date.now()-startedAt < 30_000) {
      const recipient = recipients[processed];
      let contact: ProviderContact;
      try { contact = await resendCampaignRequest<ProviderContact>(`/contacts/${encodeURIComponent(recipient.email)}`); }
      catch (error) {
        if (!(error instanceof ResendCampaignError) || error.providerStatus !== 404) throw error;
        const names = (recipient.name || '').trim().split(/\s+/);
        const created = await resendCampaignRequest<{id:string}>('/contacts','POST',{ email:recipient.email, first_name:names[0] || '', last_name:names.slice(1).join(' ') });
        // Retrieve after create: existing contacts must never be re-subscribed by an import.
        contact = await resendCampaignRequest<ProviderContact>(`/contacts/${created.id}`);
      }
      if (contact.unsubscribed) skipped++;
      else await resendCampaignRequest(`/contacts/${encodeURIComponent(contact.id)}/segments/${segmentId}`,'POST');
      processed++;
      // Commit after each contact; repeat membership additions are safe after a crash.
      await campaignSql()`UPDATE email_campaign_imports SET processed=${processed},skipped=${skipped},updated_at=NOW() WHERE id=${id} AND lock_token=${token}`;
      await new Promise(resolve => setTimeout(resolve, 550));
    }
    await campaignSql()`UPDATE email_campaign_imports SET status=${processed === recipients.length ? 'complete' : 'pending'} WHERE id=${id} AND lock_token=${token}`;
  } catch(error) {
    await campaignSql()`UPDATE email_campaign_imports SET status='failed',last_error=${errorMessage(error)} WHERE id=${id} AND lock_token=${token}`;
  } finally {
    if (segmentToken) await unlockSegment(segmentId,segmentToken);
    await campaignSql()`UPDATE email_campaign_imports SET lock_token=NULL,lock_until=NULL WHERE id=${id} AND lock_token=${token}`;
  }
  return mapImport((await campaignSql()`SELECT * FROM email_campaign_imports WHERE id=${id}`)[0]);
}
