import posthog from 'posthog-js';
import { REPLAY_BLOCK_SELECTOR } from '@/lib/analytics/policy';

const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host=process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

if(!token && process.env.NODE_ENV!=='production'){
  throw new Error('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
}
if(!host && process.env.NODE_ENV!=='production'){
  throw new Error('NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured');
}

if(token&&host){
  posthog.init(token,{
    api_host:host,
    defaults:'2026-05-30',
    capture_exceptions:true,
    session_recording:{blockSelector:REPLAY_BLOCK_SELECTOR},
    debug:process.env.NODE_ENV==='development',
  });
}
