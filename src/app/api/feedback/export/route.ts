import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/server/rate-limit';
import { getCurrentUser } from '@/server/auth/session';
import { saveExportRating } from '@/server/export-feedback';
export const runtime='nodejs';
export async function POST(req:Request) {
  const origin=req.headers.get('origin');
  if(origin && new URL(origin).host!==new URL(req.url).host) return NextResponse.json({error:'Invalid origin'},{status:403});
  const limited=enforceRateLimit(req,'export:feedback',{windowMs:60*60*1000,max:20});
  if(limited)return limited;
  const body=await req.json().catch(()=>null);
  if(!body || !Number.isInteger(body.rating) || body.rating<1 || body.rating>5 ||
    typeof body.format!=='string' || !['png','pdf'].includes(body.format) ||
    typeof body.templateId!=='string' || body.templateId.length>120 ||
    typeof body.editKey!=='string' || !/^[0-9a-f-]{36}$/.test(body.editKey))
    return NextResponse.json({error:'Invalid rating'},{status:400});
  const user=await getCurrentUser();
  const id=await saveExportRating({rating:body.rating,format:body.format,templateId:body.templateId,userId:user?.id??null,editKey:body.editKey});
  return NextResponse.json({id,ok:true});
}
