import { NextResponse } from 'next/server';
import { deleteCurrentSession } from '@/server/auth/session';

export const runtime='nodejs';

export async function POST(){
  await deleteCurrentSession();
  return NextResponse.json({ok:true});
}
