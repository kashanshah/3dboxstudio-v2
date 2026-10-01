"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_ENABLED, isAnalyticsBlockedPath } from "@/lib/analytics/policy";

export function AnalyticsPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousLocation = useRef<string | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ANALYTICS_ENABLED || !pathname) return;
    if (isAnalyticsBlockedPath(pathname)) {
      lastKey.current = null;
      return;
    }

    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    if (lastKey.current === pagePath) return;
    lastKey.current = pagePath;

    trackEvent("page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
      page_referrer: previousLocation.current ?? document.referrer,
    });
    previousLocation.current = window.location.href;
  }, [pathname, searchParams]);

  return null;
}
