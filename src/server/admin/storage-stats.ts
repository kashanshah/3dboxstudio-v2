import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
export type StorageStats={available:boolean;objects:number;bytes:number;last7Days:number;last30Days:number;partial:boolean;message?:string;prefix:string};
let cache:{expires:number;value:StorageStats}|undefined;
export async function getStorageStats():Promise<StorageStats>{
  const bucket=process.env.AWS_S3_BUCKET?.trim(),region=process.env.AWS_REGION?.trim(),prefix=process.env.AWS_S3_PREFIX?.trim()||'';
  const empty={available:false,objects:0,bytes:0,last7Days:0,last30Days:0,partial:false,prefix};
  if(!bucket||!region||!prefix) return {...empty,message:'Configure AWS_S3_BUCKET, AWS_REGION, and a V2 AWS_S3_PREFIX to show storage usage.'};
  if(!prefix.startsWith('v2/')) return {...empty,message:'Storage reporting requires a V2 prefix.'};
  if(cache&&cache.expires>Date.now())return cache.value;
  const client=new S3Client({region});
  try{
    let token:string|undefined;const now=Date.now(),value={...empty,available:true},abortSignal=AbortSignal.timeout(15000);
    for(let page=0;page<50;page++){
      const result=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix,ContinuationToken:token,MaxKeys:1000}),{abortSignal});
      for(const object of result.Contents??[]){if(!object.Key)continue;value.objects++;value.bytes+=object.Size??0;const age=now-(object.LastModified?.getTime()??0);if(age>=0&&age<30*86400000)value.last30Days++;if(age>=0&&age<7*86400000)value.last7Days++;}
      token=result.IsTruncated?result.NextContinuationToken:undefined;if(!token)break;
    }
    value.partial=Boolean(token);cache={expires:now+5*60000,value};return value;
  }catch{return {...empty,message:'Storage inventory is unavailable. Check AWS configuration and ListBucket permission.'};}
  finally{client.destroy();}
}
