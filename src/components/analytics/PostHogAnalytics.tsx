"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  POSTHOG_ENABLED,
  POSTHOG_HOST,
  POSTHOG_PROJECT_TOKEN,
  isAnalyticsBlockedPath,
} from "@/lib/analytics/policy";

export function bootstrap(): string {
  const token = JSON.stringify(POSTHOG_PROJECT_TOKEN);
  const host = JSON.stringify(POSTHOG_HOST);

  return `
// Recheck when the deferred script executes, after any intervening navigation.
var isBlockedPath=${isAnalyticsBlockedPath.toString()};
if (!isBlockedPath(window.location.pathname)) {
(function(d,w){
  var ph=w.posthog=w.posthog||[];
  if(ph.__SV){return;}
  ph._i=[];
  ph.init=function(token,config,name){
    function stub(target,method){
      target[method]=function(){target.push([method].concat(Array.prototype.slice.call(arguments,0)));};
    }
    var script=d.createElement("script");
    script.type="text/javascript";
    script.async=true;
    script.crossOrigin="anonymous";
    script.src=config.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js";
    var first=d.getElementsByTagName("script")[0];
    first.parentNode.insertBefore(script,first);
    var instance=ph;
    if(name!==undefined){instance=ph[name]=[];}else{name="posthog";}
    instance.people=instance.people||[];
    var methods="init capture identify reset set_config startSessionRecording stopSessionRecording get_distinct_id".split(" ");
    for(var i=0;i<methods.length;i++){stub(instance,methods[i]);}
    ph._i.push([token,config,name]);
  };
  ph.__SV=1;
})(document,window);

window.posthog.init(${token},{
  api_host:${host},
  defaults:"2026-05-30",
  autocapture:true,
  capture_pageview:false,
  capture_pageleave:true,
  person_profiles:"identified_only",
  before_send:function(event){
    if(isBlockedPath(window.location.pathname)){return null;}
    var props=event.properties||{};
    var urls=[props.$current_url,props.page_location,props.page_path];
    for(var i=0;i<urls.length;i++){
      if(typeof urls[i]!=="string"){continue;}
      try{if(isBlockedPath(new URL(urls[i],window.location.href).pathname)){return null;}}catch(e){}
    }
    return event;
  },
  loaded:function(){
    if(window.__syncAnalyticsRoute){window.__syncAnalyticsRoute(window.location.pathname);}
  }
});

var queued=window.__posthogCaptureQueue||[];
for(var i=0;i<queued.length;i++){
  window.posthog.capture(queued[i][0],queued[i][1]);
}
window.__posthogCaptureQueue=[];
}
`.trim();
}

export function PostHogAnalytics() {
  const pathname = usePathname() ?? "/";
  if (!POSTHOG_ENABLED || isAnalyticsBlockedPath(pathname)) return null;
  return (
    <Script
      id="_next-posthog"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: bootstrap() }}
    />
  );
}
