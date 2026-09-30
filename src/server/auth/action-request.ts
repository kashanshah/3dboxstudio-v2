import { NextResponse } from 'next/server';
import { requestOrigin } from '@/server/request-origin';
import { enforceRateLimit } from '@/server/rate-limit';
export function guardAuthAction(req:Request,action:string,max=6,windowMs=15*60000){
 const origin=req.headers.get('origin');
 if((origin&&origin!==requestOrigin(req))||req.headers.get('sec-fetch-site')==='cross-site')return NextResponse.json({error:'Request origin is not allowed.'},{status:403});
 return enforceRateLimit(req,`auth:${action}`,{windowMs,max});
}
export function validActionToken(value:unknown):value is string{return typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);}
