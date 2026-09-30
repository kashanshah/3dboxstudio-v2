import { NextResponse } from 'next/server'; import { requireAdminApi } from '@/server/admin/auth'; import { listContactSubmissions } from '@/server/contact-submissions';
export async function GET(){const denied=await requireAdminApi();if(denied)return denied;return NextResponse.json({items:await listContactSubmissions(100)});}
