import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/server/admin/auth';
import { getExportFeedbackStats,listExportFeedback } from '@/server/export-feedback';
export async function GET(){const denied=await requireAdminApi();if(denied)return denied;const [stats,items]=await Promise.all([getExportFeedbackStats(),listExportFeedback()]);return NextResponse.json({stats,items});}
