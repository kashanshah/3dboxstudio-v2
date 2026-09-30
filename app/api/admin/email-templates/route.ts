import { NextResponse } from 'next/server'; import { requireAdminApi } from '@/server/admin/auth'; import { getEmailTemplatePreviews } from '@/server/email/templates';
export async function GET(){const denied=await requireAdminApi();if(denied)return denied;return NextResponse.json({items:getEmailTemplatePreviews()});}
