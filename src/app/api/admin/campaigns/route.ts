import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { requestOrigin } from '@/server/request-origin';
import { enforceRateLimit } from '@/server/rate-limit';
import { CAMPAIGN_EVENTS, CampaignError, requireId } from '@/lib/email-campaigns';
import { campaignActivity, cancelCampaign, createCampaign, createSegment, enableCampaignTracking, getCampaign, importCandidates, listCampaigns, listSegments, refreshCampaign, refreshCampaignTotals, reviewCampaign, runImportChunk, saveCampaign, scheduleCampaign, segmentContacts, startSegmentImport, testCampaign } from '@/server/email/campaigns';
import { configureCampaignWebhook } from '@/server/email/campaign-webhook';
import { resendCampaignRequest } from '@/server/email/campaign-resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (body: unknown) => NextResponse.json(body,{headers:{'Cache-Control':'no-store'}});
function failure(error: unknown) {
  if (error instanceof CampaignError) return NextResponse.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  console.error('Admin campaign operation failed');
  return NextResponse.json({error:'Campaign operation failed. Refresh status before trying again.'},{status:500});
}
export async function GET(req: Request) {
  const denied = await requireAdminApi(); if (denied) return denied;
  const params = new URL(req.url).searchParams;
  try {
    const view = params.get('view');
    if (view === 'segments') return json({segments:await listSegments()});
    if (view === 'contacts') return json(await segmentContacts(requireId(params.get('segmentId')),params.get('after') || ''));
    if (view === 'candidates') { const recipients = await importCandidates(params.get('filter') || 'verified'); return json({count:recipients.length,sample:recipients.slice(0,10)}); }
    if (view === 'review') return json(await reviewCampaign(requireId(params.get('id'))));
    if (view === 'detail') return json(await campaignActivity(requireId(params.get('id'))));
    if (view === 'recipients' || view === 'links') {
      const campaign = await getCampaign(requireId(params.get('id')));
      if (!campaign.broadcastId) return json({data:[],has_more:false});
      const query = new URLSearchParams({limit:'25'});
      const after = params.get('after'); if (after && after.length <= 200) query.set('after',after);
      if (view === 'recipients') {
        const type = params.get('type') || 'delivered';
        if (!CAMPAIGN_EVENTS.some(e=>e===type)) throw new CampaignError('Invalid event type.');
        query.set('type',type);
        const email = params.get('email'); if (email) query.set('email',email.slice(0,254));
      }
      return json(await resendCampaignRequest(`/broadcasts/${campaign.broadcastId}/${view === 'links' ? 'clicked-links' : 'recipients'}?${query}`));
    }
    const page = Math.max(1,Math.min(10000,Number(params.get('page')) || 1));
    return json(await listCampaigns(Math.floor(page)));
  } catch(error) { return failure(error); }
}
export async function POST(req: Request) {
  const denied = await requireAdminApi(); if (denied) return denied;
  if (req.headers.get('origin') !== requestOrigin(req) || req.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
  if (!req.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({error:'JSON request required.'},{status:415});
  if (Number(req.headers.get('content-length')) > 400_000) return NextResponse.json({error:'Request too large.'},{status:413});
  const raw = await req.text();
  if (raw.length > 400_000) return NextResponse.json({error:'Request too large.'},{status:413});
  let body: Record<string,unknown>;
  try { body = JSON.parse(raw); if (!body || typeof body !== 'object') throw new Error(); }
  catch { return NextResponse.json({error:'Invalid JSON request.'},{status:400}); }
  const limited = enforceRateLimit(req,'admin-campaigns',{windowMs:60_000,max:60}); if (limited) return limited;
  try {
    if (body.action === 'refresh-overview') { await refreshCampaignTotals(); return json(await listCampaigns(Math.max(1,Math.min(10000,Math.floor(Number(body.page) || 1))))); }
    if (body.action === 'create') return json({campaign:await createCampaign(body.content)});
    if (body.action === 'create-segment') return json({segment:await createSegment(body.name)});
    if (body.action === 'configure-webhook') return json({webhook:await configureCampaignWebhook()});
    if (body.action === 'enable-tracking') { if (typeof body.from !== 'string') throw new CampaignError('Choose a sender.'); return json({domain:await enableCampaignTracking(body.from)}); }
    if (body.action === 'start-import') return json({job:await startSegmentImport(requireId(body.segmentId),String(body.filter || ''),body.confirmed === true)});
    if (body.action === 'import-chunk') return json({job:await runImportChunk(requireId(body.jobId))});
    const id = requireId(body.id);
    const revision = Number(body.revision);
    if (['save','test','schedule'].includes(String(body.action)) && (!Number.isInteger(revision) || revision < 1)) throw new CampaignError('Invalid campaign revision.');
    if (body.action === 'save') return json({campaign:await saveCampaign(id,revision,body.content)});
    if (body.action === 'test') return json({campaign:await testCampaign(id,revision,body.recipient,body.requestId)});
    if (body.action === 'schedule') {
      if (typeof body.wallTime !== 'string' || typeof body.timeZone !== 'string' || typeof body.fingerprint !== 'string' || body.fingerprint.length !== 64) throw new CampaignError('Review the campaign schedule first.');
      return json({campaign:await scheduleCampaign(id,{revision,fingerprint:body.fingerprint,wallTime:body.wallTime,timeZone:body.timeZone,confirmed:body.confirmed===true})});
    }
    if (body.action === 'cancel') return json({campaign:await cancelCampaign(id)});
    if (body.action === 'refresh') return json({campaign:await refreshCampaign(id)});
    if (body.action === 'duplicate') { const campaign = await getCampaign(id); return json({campaign:await createCampaign({...campaign,name:`${campaign.name.slice(0,140)} (copy)`})}); }
    throw new CampaignError('Unknown campaign action.');
  } catch(error) { return failure(error); }
}
