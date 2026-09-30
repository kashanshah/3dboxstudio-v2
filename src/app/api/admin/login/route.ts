import { NextResponse } from 'next/server';
import { createAdminSessionToken,setAdminCookie,verifyAdminPassword } from '@/server/admin/auth';
import { enforceRateLimit } from '@/server/rate-limit';
export const runtime='nodejs';
export async function POST(req:Request){
  const limited=enforceRateLimit(req,'admin:login',{windowMs:15*60*1000,max:5}); if(limited)return limited;
  const body=await req.json().catch(()=>null) as {password?:unknown}|null;
  if(typeof body?.password!=='string'||!body.password)return NextResponse.json({error:'Enter the admin password.'},{status:400});
  if(!verifyAdminPassword(body.password))return NextResponse.json({error:'Incorrect admin password.'},{status:401});
  await setAdminCookie(createAdminSessionToken()); return NextResponse.json({ok:true});
}
