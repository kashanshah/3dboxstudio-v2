"use client";

import Script from "next/script";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { ensureGtagInitialized } from "@/lib/analytics/gtag";
import { getConsentState, onConsentChange } from "@/lib/analytics/consent";
import {
  GA_ENABLED,
  GA_MEASUREMENT_ID,
  isAnalyticsBlockedPath,
  setGaDisableFlag,
} from "@/lib/analytics/policy";

export function useAnalyticsConsent() {
  return useSyncExternalStore(onConsentChange, getConsentState, () => "pending" as const);
}

export function GoogleAnalytics() {
  const pathname = usePathname() ?? "/";
  const blocked = isAnalyticsBlockedPath(pathname);
  const granted = useAnalyticsConsent() === "granted";

  useEffect(() => {
    setGaDisableFlag(blocked || !granted);
  }, [blocked, granted]);

  useEffect(() => {
    if (!GA_ENABLED || blocked || !granted) return;
    ensureGtagInitialized();
  }, [blocked, granted]);

  if (!GA_ENABLED || blocked || !granted) return null;

  return (
    <Script
      id="_next-ga"
      strategy="afterInteractive"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
    />
  );
}
