import { ensureV2Schema, getSql } from '@/server/db';
import { ADMIN_DISPLAY_TIME_ZONE, addAdminPeriod, startOfAdminPeriod, adminPeriodStartIso, formatAdminPeriodLabel, adminPeriodKey, type AdminPeriodTrunc } from '@/lib/admin-time-zone';
export type DashboardPeriod='daily'|'weekly'|'monthly'|'quarterly'|'yearly';
export function parseDashboardPeriod(value?:string):DashboardPeriod{return ['daily','weekly','monthly','quarterly','yearly'].includes(value??'')?value as DashboardPeriod:'daily';}
const periods:Record<DashboardPeriod,{trunc:AdminPeriodTrunc;count:number}>={daily:{trunc:'day',count:30},weekly:{trunc:'week',count:12},monthly:{trunc:'month',count:12},quarterly:{trunc:'quarter',count:8},yearly:{trunc:'year',count:5}};
export type CountSeries={date:string;count:number};
export type Breakdown={label:string;count:number};
type Metrics={users:{total:number;verified:number;last7:number;last30:number};designs:{total:number;owned:number;anonymous:number;expired:number;last7:number;last30:number;views:number};images:{faces:number;previews:number;last7:number;last30:number};contacts:{total:number;new:number;last7:number};media:{count:number;bytes:number};sources:Breakdown[];methods:Breakdown[];landings:Breakdown[];conversions:Breakdown[];signups:CountSeries[];designActivity:CountSeries[];imageActivity:CountSeries[];verifiedActivity:CountSeries[];googleActivity:CountSeries[];};
// Legacy payloads are preserved verbatim, not interpreted as V2 editor state.
const designCte=`WITH designs AS (
 SELECT source||':'||source_id AS id, payload->>'user_id' AS user_id,
 admin_ts(payload->>'created_at') AS created_at,admin_ts(payload->>'expires_at') AS expires_at,
 COALESCE(admin_bigint(payload->>'view_count'),0) AS views,
 CASE WHEN jsonb_typeof(payload->'images')='object' THEN (SELECT COUNT(*) FROM jsonb_object_keys(payload->'images')) ELSE 0 END AS face_count,
 CASE WHEN NULLIF(payload->>'og_image_key','') IS NOT NULL THEN 1 ELSE 0 END AS preview_count
 FROM legacy_records WHERE entity_type='shared_designs' AND deleted_at IS NULL
 UNION ALL
 SELECT id,user_id,created_at,NULL::timestamptz,0,COALESCE(artwork_count,0),
 CASE WHEN NULLIF(preview_image_key,'') IS NOT NULL THEN 1 ELSE 0 END FROM projects
), filtered AS (SELECT * FROM designs WHERE $1::boolean OR face_count>0),
contacts AS (
 SELECT created_at,status FROM contact_submissions
 UNION ALL SELECT admin_ts(payload->>'created_at'),payload->>'status' FROM legacy_records
 WHERE entity_type='contact_submissions' AND deleted_at IS NULL
)`;
export async function getDashboard(period:DashboardPeriod,includeBlank:boolean){
 await ensureV2Schema();const sql=getSql(),config=periods[period];
 const start=addAdminPeriod(startOfAdminPeriod(new Date(),config.trunc),config.trunc,-(config.count-1));
 const spine=Array.from({length:config.count},(_,i)=>{const day=addAdminPeriod(start,config.trunc,i);return {date:adminPeriodKey(day,'day'),label:formatAdminPeriodLabel(day,config.trunc)};});
 const [result,runs]=await Promise.all([sql.query(`${designCte}
 SELECT jsonb_build_object(
 'users',(SELECT jsonb_build_object('total',COUNT(*),'verified',COUNT(*) FILTER(WHERE email_verified_at IS NOT NULL),'last7',COUNT(*) FILTER(WHERE created_at>=NOW()-INTERVAL '7 days'),'last30',COUNT(*) FILTER(WHERE created_at>=NOW()-INTERVAL '30 days')) FROM users),
 'designs',(SELECT jsonb_build_object('total',COUNT(*),'owned',COUNT(*) FILTER(WHERE user_id IS NOT NULL),'anonymous',COUNT(*) FILTER(WHERE user_id IS NULL),'expired',COUNT(*) FILTER(WHERE expires_at<=NOW()),'last7',COUNT(*) FILTER(WHERE created_at>=NOW()-INTERVAL '7 days'),'last30',COUNT(*) FILTER(WHERE created_at>=NOW()-INTERVAL '30 days'),'views',COALESCE(SUM(views),0)) FROM filtered),
 'images',(SELECT jsonb_build_object('faces',COALESCE(SUM(face_count),0),'previews',COALESCE(SUM(preview_count),0),'last7',COALESCE(SUM(face_count+preview_count) FILTER(WHERE created_at>=NOW()-INTERVAL '7 days'),0),'last30',COALESCE(SUM(face_count+preview_count) FILTER(WHERE created_at>=NOW()-INTERVAL '30 days'),0)) FROM filtered),
 'contacts',(SELECT jsonb_build_object('total',COUNT(*),'new',COUNT(*) FILTER(WHERE status='new'),'last7',COUNT(*) FILTER(WHERE created_at>=NOW()-INTERVAL '7 days')) FROM contacts),
 'media',(SELECT jsonb_build_object('count',COUNT(*),'bytes',COALESCE(SUM(byte_size),0)) FROM media_assets),
 'sources',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT COALESCE(NULLIF(utm_source,''),'Direct / unknown') label,COUNT(*) count FROM users WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 8)t),
 'methods',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT COALESCE(NULLIF(signup_method,''),'Unknown') label,COUNT(*) count FROM users WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC)t),
 'landings',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT COALESCE(NULLIF(signup_landing_type,''),'Unknown') label,COUNT(*) count FROM users WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 10)t),
 'conversions',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT COALESCE(NULLIF(signup_conversion_page,''),'Unknown') label,COUNT(*) count FROM users WHERE created_at>=NOW()-INTERVAL '30 days' GROUP BY 1 ORDER BY 2 DESC LIMIT 10)t),
 'signups',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT to_char(date_trunc($2,timezone($3,created_at)),'YYYY-MM-DD') date,COUNT(*) count FROM users WHERE created_at>=$4::timestamptz GROUP BY 1 ORDER BY 1)t),
 'verifiedActivity',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT to_char(date_trunc($2,timezone($3,created_at)),'YYYY-MM-DD') date,COUNT(*) count FROM users WHERE created_at>=$4::timestamptz AND email_verified_at IS NOT NULL GROUP BY 1 ORDER BY 1)t),
 'googleActivity',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT to_char(date_trunc($2,timezone($3,created_at)),'YYYY-MM-DD') date,COUNT(*) count FROM users WHERE created_at>=$4::timestamptz AND signup_method='google' GROUP BY 1 ORDER BY 1)t),
 'designActivity',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT to_char(date_trunc($2,timezone($3,created_at)),'YYYY-MM-DD') date,COUNT(*) count FROM filtered WHERE created_at>=$4::timestamptz GROUP BY 1 ORDER BY 1)t),
 'imageActivity',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT to_char(date_trunc($2,timezone($3,created_at)),'YYYY-MM-DD') date,COALESCE(SUM(face_count+preview_count),0) count FROM filtered WHERE created_at>=$4::timestamptz GROUP BY 1 ORDER BY 1)t)
 ) AS metrics`,[includeBlank,config.trunc,ADMIN_DISPLAY_TIME_ZONE,adminPeriodStartIso(start)]),
  sql`SELECT source,snapshot_at,completed_at,counts FROM legacy_sync_runs ORDER BY completed_at DESC LIMIT 5`]);
 return {metrics:(result as {metrics:Metrics}[])[0].metrics,spine,runs:runs as {source:string;snapshot_at:string;completed_at:string;counts:Record<string,unknown>}[],timezone:ADMIN_DISPLAY_TIME_ZONE};
}
export type DashboardData=Awaited<ReturnType<typeof getDashboard>>;
