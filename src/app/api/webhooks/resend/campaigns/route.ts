import { NextResponse } from 'next/server';
import { CampaignError } from '@/lib/email-campaigns';
import { storeCampaignWebhook, verifyCampaignWebhook } from '@/server/email/campaign-webhook';

export const runtime = 'nodejs';
export async function POST(req: Request) {
  if (Number(req.headers.get('content-length')) > 100_000) return NextResponse.json({error:'Payload too large.'},{status:413});
  const payload = await req.text();
  if (payload.length > 100_000) return NextResponse.json({error:'Payload too large.'},{status:413});
  const headers = Object.fromEntries(['svix-id','svix-timestamp','svix-signature'].map(name=>[name,req.headers.get(name)||'']));
  if (!headers['svix-id'] || headers['svix-id'].length > 200) return NextResponse.json({error:'Missing webhook signature.'},{status:401});
  try {
    const event = await verifyCampaignWebhook(payload,headers);
    await storeCampaignWebhook(headers['svix-id'],event);
    return NextResponse.json({received:true});
  } catch(error) {
    if (error instanceof CampaignError) return NextResponse.json({error:error.message},{status:error.status});
    // Non-2xx response lets Resend retry transient database failures.
    console.error('Campaign webhook storage failed');
    return NextResponse.json({error:'Webhook processing failed.'},{status:500});
  }
}
