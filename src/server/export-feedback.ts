import { randomUUID, createHash } from 'node:crypto';
import { ensureV2Schema, getSql } from '@/server/db';

export async function saveExportRating(input:{rating:number;format:string;templateId:string;userId:string|null;editKey:string;projectId?:string|null}) {
  await ensureV2Schema();
  const id=randomUUID();
  const db=getSql();
  // Only a design the signed-in account owns is recorded against the rating.
  const owned=input.projectId&&input.userId
    ? await db`SELECT id FROM projects WHERE id=${input.projectId} AND user_id=${input.userId} LIMIT 1` as {id:string}[]
    : [];
  const projectId=owned[0]?.id??null;
  await db`INSERT INTO export_feedback(id,user_id,edit_key_hash,rating,export_format,template_id,project_id) VALUES (${id},${input.userId},${createHash('sha256').update(input.editKey).digest('hex')},${input.rating},${input.format},${input.templateId},${projectId})`;
  return id;
}
export async function saveExportComment(id:string,comment:string,editKey:string) {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`UPDATE export_feedback SET comment=${comment},updated_at=NOW() WHERE id=${id} AND edit_key_hash=${createHash('sha256').update(editKey).digest('hex')} AND comment IS NULL RETURNING id` as {id:string}[];
  return rows.length>0;
}
export async function listExportFeedback(limit=250) {
  await ensureV2Schema();
  const db=getSql();
  // The design is listed only while it still exists.
  const rows=await db`SELECT f.id,f.rating,f.comment,f.export_format,f.template_id,f.created_at,u.id AS user_id,u.email,p.id AS project_id,p.name AS project_name
    FROM export_feedback f LEFT JOIN users u ON u.id=f.user_id LEFT JOIN projects p ON p.id=f.project_id
    ORDER BY f.created_at DESC LIMIT ${limit}` as {id:string;rating:number;comment:string|null;export_format:string;template_id:string;created_at:string;user_id:string|null;email:string|null;project_id:string|null;project_name:string|null}[];
  return rows.map(row=>({id:String(row.id),rating:Number(row.rating),comment:row.comment as string|null,
    format:String(row.export_format),templateId:String(row.template_id),createdAt:String(row.created_at),
    userId:row.user_id as string|null,email:row.email as string|null,
    projectId:row.project_id as string|null,projectName:row.project_name as string|null}));
}
export async function getExportFeedbackStats() {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`SELECT COUNT(*)::int AS total,COALESCE(AVG(rating),0)::float AS average,
    COUNT(*) FILTER (WHERE comment IS NOT NULL)::int AS comments,
    COUNT(*) FILTER (WHERE rating=1)::int AS one,COUNT(*) FILTER (WHERE rating=2)::int AS two,
    COUNT(*) FILTER (WHERE rating=3)::int AS three,COUNT(*) FILTER (WHERE rating=4)::int AS four,
    COUNT(*) FILTER (WHERE rating=5)::int AS five FROM export_feedback` as {total:number;average:number;comments:number;one:number;two:number;three:number;four:number;five:number}[];
  return rows[0] as {total:number;average:number;comments:number;one:number;two:number;three:number;four:number;five:number};
}
