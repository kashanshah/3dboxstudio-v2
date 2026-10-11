import { after } from 'next/server';
import { PostHog } from 'posthog-node';

const globalForPostHog=globalThis as typeof globalThis & {__posthogServerClient?:PostHog|null};

// One client per server instance. A client per call leaked a process
// 'uncaughtException' listener each time (exception autocapture) and made every
// save wait on a PostHog round-trip. Uncaught server errors are reported through
// onRequestError in instrumentation.ts instead.
export function getPostHogClient():PostHog|null{
  if(globalForPostHog.__posthogServerClient!==undefined)return globalForPostHog.__posthogServerClient;
  const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
  const host=process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  if(!token||!host){
    const runningTests=process.env.NODE_ENV==='test'||process.env.NODE_TEST_CONTEXT!==undefined;
    // Analytics are optional in development (.env.example: leave the token
    // empty to disable). Report it once instead of failing the request, so
    // sign-in and every other route work without credentials.
    if(process.env.NODE_ENV!=='production'&&!runningTests){
      const variable=!token?'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN':'NEXT_PUBLIC_POSTHOG_HOST';
      console.warn(`${variable} is not configured, so PostHog server events are not recorded. Set it in .env.local to turn them on.`);
    }
    globalForPostHog.__posthogServerClient=null;
    return null;
  }
  globalForPostHog.__posthogServerClient=new PostHog(token,{host,flushAt:20,flushInterval:10_000,enableExceptionAutocapture:false});
  return globalForPostHog.__posthogServerClient;
}

// Send queued events once the response has gone out; outside a request scope
// (scripts, tests) flush straight away.
function flushLater(posthog:PostHog){
  const flush=()=>posthog.flush().catch(error=>console.error('PostHog flush failed',error));
  try{after(flush);}catch{void flush();}
}

export async function captureServerEvent(
  distinctId:string,
  event:string,
  properties:Record<string,string|number|boolean>={},
):Promise<void>{
  const posthog=getPostHogClient();
  if(!posthog)return;
  posthog.capture({distinctId,event,properties});
  flushLater(posthog);
}

export async function captureServerUserEvent(
  distinctId:string,
  event:string,
  eventProperties:Record<string,string|number|boolean>,
  personProperties:Record<string,unknown>,
):Promise<void>{
  const posthog=getPostHogClient();
  if(!posthog)return;
  posthog.identify({distinctId,properties:personProperties});
  posthog.capture({distinctId,event,properties:eventProperties});
  flushLater(posthog);
}

export async function captureServerException(error:unknown,distinctId?:string,properties?:Record<string,unknown>):Promise<void>{
  const posthog=getPostHogClient();
  if(!posthog)return;
  posthog.captureException(error,distinctId,properties);
  flushLater(posthog);
}
