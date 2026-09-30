import { NextResponse } from 'next/server';
import { ensureV2Schema } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';

export const runtime='nodejs';

export async function GET(){
  await ensureV2Schema();
  return NextResponse.json({user:await getCurrentUser()});
}
