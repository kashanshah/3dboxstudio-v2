import { NextResponse } from 'next/server';
import { beginGoogleOAuth } from '@/server/auth/google';

export const runtime='nodejs';

export async function GET(req:Request){
  const url=await beginGoogleOAuth(req);
  if(!url) return NextResponse.redirect(new URL('/login?auth_error=google_unconfigured',req.url));
  return NextResponse.redirect(url);
}
