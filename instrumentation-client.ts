import type { CaptureResult, PostHog } from 'posthog-js';
import { REPLAY_BLOCK_SELECTOR, isAnalyticsBlockedPath, redactUrl } from '@/lib/analytics/policy';
import { getConsentState, onConsentChange } from '@/lib/analytics/consent';
import { setPostHogClient } from '@/lib/analytics/posthog';

const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host=process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

if(!token && process.env.NODE_ENV!=='production'){
  throw new Error('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
}
if(!host && process.env.NODE_ENV!=='production'){
  throw new Error('NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured');
}

// Autocapture, exceptions, page leaves and replay snapshots bypass trackEvent,
// so the admin exclusion has to be enforced on everything PostHog sends.
function pathOf(value:unknown){
  if(typeof value!=='string'||!value)return null;
  try{return new URL(value,'https://www.3dboxstudio.com').pathname;}catch{return null;}
}
function dropBlockedPaths(event:CaptureResult|null):CaptureResult|null{
  if(!event)return event;
  const properties=event.properties??{};
  const paths=[properties.$current_url,properties.page_location,properties.page_path].map(pathOf);
  if(typeof window!=='undefined')paths.push(window.location.pathname);
  return paths.some(path=>path!==null&&isAnalyticsBlockedPath(path))?null:event;
}

function redactStrings(record:Record<string,unknown>|undefined){
  if(!record)return;
  for(const [key,value] of Object.entries(record))if(typeof value==='string'&&value.includes('token='))record[key]=redactUrl(value);
}
// Reset and verification links carry single-use tokens. Strip them from every
// URL PostHog records: event properties, person properties and replay meta.
function redactSecrets(event:CaptureResult|null):CaptureResult|null{
  if(!event)return event;
  redactStrings(event.properties);
  redactStrings(event.$set as Record<string,unknown>|undefined);
  redactStrings(event.$set_once as Record<string,unknown>|undefined);
  const snapshots=event.properties?.$snapshot_data;
  if(Array.isArray(snapshots))for(const item of snapshots)redactStrings((item as {data?:Record<string,unknown>})?.data);
  return event;
}

// PostHog is not started until the visitor has consented: even an opted-out
// SDK fetches remote config and feature flags with an anonymous id. The SDK is
// not downloaded until then either, which keeps it out of every page's bundle.
let loading:Promise<PostHog|null>|null=null;
function startPostHog(){
  if(loading||!token||!host)return;
  const current:Promise<PostHog|null>=import('posthog-js').then(({default:posthog})=>{
    // Consent was withdrawn while the SDK downloaded.
    if(getConsentState()!=='granted'){
      if(loading===current)loading=null;
      return null;
    }
    posthog.init(token,{
      api_host:host,
      defaults:'2026-05-30',
      // AnalyticsPageView sends the one $pageview per route; the SDK's automatic
      // pageview counted every page twice.
      capture_pageview:false,
      capture_pageleave:true,
      capture_exceptions:true,
      session_recording:{blockSelector:REPLAY_BLOCK_SELECTOR},
      before_send:[dropBlockedPaths,redactSecrets],
      debug:process.env.NODE_ENV==='development',
    });
    setPostHogClient(posthog);
    return posthog;
  },()=>{
    // A failed download is retried on the next consent change.
    if(loading===current)loading=null;
    return null;
  });
  loading=current;
}

if(getConsentState()==='granted')startPostHog();
onConsentChange(state=>{
  if(state==='granted'){
    if(loading)void loading.then(posthog=>posthog?.opt_in_capturing({captureEventName:false}));
    else startPostHog();
  }else if(state==='denied'&&loading){
    void loading.then(posthog=>posthog?.opt_out_capturing());
  }
});
