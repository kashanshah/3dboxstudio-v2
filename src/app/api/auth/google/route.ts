import { NextResponse } from 'next/server';
import { beginGoogleOAuth } from '@/server/auth/google';

export const runtime='nodejs';

export async function GET(req:Request){
  const url=await beginGoogleOAuth(req);
  if(!url) return NextResponse.json({error:'Google sign-in is not configured.'},{status:503});
  return NextResponse.redirect(url);
}
