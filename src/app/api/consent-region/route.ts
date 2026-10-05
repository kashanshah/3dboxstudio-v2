import { NextResponse } from 'next/server';
import { consentRequiredFor } from '@/lib/analytics/consent-region';

export const runtime='nodejs';

export function GET(req:Request){
  return NextResponse.json(
    {required:consentRequiredFor(req.headers.get('x-vercel-ip-country'))},
    {headers:{'Cache-Control':'private, no-store'}},
  );
}
