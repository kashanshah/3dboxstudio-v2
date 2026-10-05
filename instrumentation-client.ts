import posthog from 'posthog-js';
import type { CaptureResult } from 'posthog-js';
import { REPLAY_BLOCK_SELECTOR, isAnalyticsBlockedPath } from '@/lib/analytics/policy';
import { getConsentState, onConsentChange } from '@/lib/analytics/consent';

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

// PostHog is not started until the visitor has consented: even an opted-out
// SDK fetches remote config and feature flags with an anonymous id.
let started=false;
function startPostHog(){
  if(started||!token||!host)return;
  started=true;
  posthog.init(token,{
    api_host:host,
    defaults:'2026-05-30',
    // AnalyticsPageView sends the one $pageview per route; the SDK's automatic
    // pageview counted every page twice.
    capture_pageview:false,
    capture_pageleave:true,
    capture_exceptions:true,
    session_recording:{blockSelector:REPLAY_BLOCK_SELECTOR},
    before_send:dropBlockedPaths,
    debug:process.env.NODE_ENV==='development',
  });
}

if(getConsentState()==='granted')startPostHog();
onConsentChange(state=>{
  if(state==='granted'){
    if(started)posthog.opt_in_capturing({captureEventName:false});
    else startPostHog();
  }else if(state==='denied'&&started){
    posthog.opt_out_capturing();
  }
});
