import { randomUUID } from 'node:crypto';
import { ensureV2Schema, getSql } from '@/server/db';

export async function saveExportRating(input:{rating:number;format:string;templateId:string;userId:string|null}) {
  await ensureV2Schema();
  const id=randomUUID();
  const db=getSql();
  await db`INSERT INTO export_feedback(id,user_id,rating,export_format,template_id) VALUES (${id},${input.userId},${input.rating},${input.format},${input.templateId})`;
  return id;
}
export async function saveExportComment(id:string,comment:string,userId:string|null) {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`UPDATE export_feedback SET comment=${comment},updated_at=NOW() WHERE id=${id} AND comment IS NULL RETURNING id`;
  return rows.length>0;
}
export async function listExportFeedback(limit=250) {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`SELECT f.id,f.rating,f.comment,f.export_format,f.template_id,f.created_at,u.email
    FROM export_feedback f LEFT JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC LIMIT ${limit}`;
  return rows.map(row=>({id:String(row.id),rating:Number(row.rating),comment:row.comment as string|null,
    format:String(row.export_format),templateId:String(row.template_id),createdAt:String(row.created_at),
    email:row.email as string|null}));
}
export async function getExportFeedbackStats() {
  await ensureV2Schema();
  const db=getSql();
  const rows=await db`SELECT COUNT(*)::int AS total,COALESCE(AVG(rating),0)::float AS average,
    COUNT(*) FILTER (WHERE comment IS NOT NULL)::int AS comments,
    COUNT(*) FILTER (WHERE rating=1)::int AS one,COUNT(*) FILTER (WHERE rating=2)::int AS two,
    COUNT(*) FILTER (WHERE rating=3)::int AS three,COUNT(*) FILTER (WHERE rating=4)::int AS four,
    COUNT(*) FILTER (WHERE rating=5)::int AS five FROM export_feedback`;
  return rows[0] as {total:number;average:number;comments:number;one:number;two:number;three:number;four:number;five:number};
}
