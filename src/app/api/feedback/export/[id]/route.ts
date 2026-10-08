import { NextResponse } from 'next/server';
import { saveExportComment } from '@/server/export-feedback';
import { enforceRateLimit } from '@/server/rate-limit';
export const runtime='nodejs';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}) {
  const origin=req.headers.get('origin');
  if(origin && new URL(origin).host!==new URL(req.url).host) return NextResponse.json({error:'Invalid origin'},{status:403});
  const limited=enforceRateLimit(req,'export:feedback:comment',{windowMs:60*60*1000,max:20});
  if(limited)return limited;
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/.test(id))return NextResponse.json({error:'Invalid ID'},{status:400});
  const body=await req.json().catch(()=>null);
  const comment=typeof body?.comment==='string'?body.comment.trim():'';
  if(typeof body?.editKey!=='string'|| !/^[0-9a-f-]{36}$/.test(body.editKey))return NextResponse.json({error:'Invalid edit key'},{status:400});
  if(!comment||comment.length>1000)return NextResponse.json({error:'Invalid comment'},{status:400});
  const ok=await saveExportComment(id,comment,body.editKey);
  return NextResponse.json({ok},{status:ok?200:404});
}
