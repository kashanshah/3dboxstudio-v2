import type { Instrumentation } from 'next';
import { registerPostHogLogs } from '@/lib/posthog-logs';

export function register(){
  if(process.env.NEXT_RUNTIME==='nodejs')registerPostHogLogs();
}

export const onRequestError:Instrumentation.onRequestError=async(error,request,context)=>{
  if(process.env.NEXT_RUNTIME!=='nodejs')return;
  const { getPostHogClient }=await import('@/lib/posthog-server');
  const posthog=getPostHogClient();
  if(!posthog)return;
  posthog.captureException(error,undefined,{
    path:request.path,
    method:request.method,
    route_path:context.routePath,
    route_type:context.routeType,
  });
  await posthog.flush();
};
