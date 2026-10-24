import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { sendDueFollowUps } from '@/server/onboarding-emails';

export const runtime='nodejs';
export const maxDuration=60;

// Run daily by Vercel Cron (vercel.json), which sends CRON_SECRET as a bearer
// token. Without the secret set, the job refuses to run.
export async function GET(req:Request){
  const secret=process.env.CRON_SECRET?.trim();
  if(!secret) return NextResponse.json({error:'CRON_SECRET is not set.'},{status:503});
  if(req.headers.get('authorization')!==`Bearer ${secret}`) return NextResponse.json({error:'Unauthorized.'},{status:401});
  await ensureV2Schema();
  return NextResponse.json(await sendDueFollowUps());
}
