import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ensureV2Schema,getSql } from '@/server/db';
import { getCurrentUser } from '@/server/auth/session';
import { guardAuthAction } from '@/server/auth/action-request';
import { validProjectState } from '@/lib/studio-project';
export async function saveProject(req:Request,id?:string){
 const denied=guardAuthAction(req,'save-project',60);if(denied)return denied;
 await ensureV2Schema();const user=await getCurrentUser();if(!user)return NextResponse.json({error:'Sign in to save your design.'},{status:401});
 const raw=await req.text();if(Buffer.byteLength(raw)>3*1024*1024)return NextResponse.json({error:'This design exceeds the current 3 MB save limit. Use smaller artwork images and try again.'},{status:413});
 let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid design data.'},{status:400});}
 if(typeof body?.name!=='string'||!body.name.trim()||body.name.length>120||!validProjectState(body.state)||typeof body.preview!=='string'||body.preview.length>250000||!/^data:image\/png;base64,/.test(body.preview))return NextResponse.json({error:'Invalid design data.'},{status:400});
 const sql=getSql();let rows;
 if(id){if(typeof body.updatedAt!=='string')return NextResponse.json({error:'Reload the design before saving.'},{status:409});rows=await sql`UPDATE projects SET name=${body.name.trim()},studio_state=${JSON.stringify(body.state)}::jsonb,preview_image_key=${body.preview},updated_at=NOW() WHERE id=${id} AND user_id=${user.id} AND updated_at=${body.updatedAt}::timestamptz RETURNING id,updated_at`;}
 else {id=randomUUID();rows=await sql`INSERT INTO projects(id,user_id,name,studio_state,preview_image_key) VALUES(${id},${user.id},${body.name.trim()},${JSON.stringify(body.state)}::jsonb,${body.preview}) RETURNING id,updated_at`;}
 if(!(rows as unknown[]).length)return NextResponse.json({error:'The design was changed elsewhere or is no longer available. Reload before saving.'},{status:409});
 return NextResponse.json({project:(rows as {id:string;updated_at:string}[])[0]});
}
