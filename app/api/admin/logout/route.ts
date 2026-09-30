import { NextResponse } from 'next/server'; import { clearAdminCookie } from '@/server/admin/auth';
export const runtime='nodejs'; export async function POST(){await clearAdminCookie();return NextResponse.json({ok:true});}
