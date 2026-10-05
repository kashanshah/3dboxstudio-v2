"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  OPEN_CONSENT_SETTINGS_EVENT,
  getConsentState,
  readStoredConsent,
  readStoredConsentRegion,
  setConsentState,
  storeConsentRegion,
} from "@/lib/analytics/consent";
import { ANALYTICS_ENABLED, isAnalyticsBlockedPath } from "@/lib/analytics/policy";
import "./consent-banner.css";

async function consentRequired(): Promise<boolean> {
  const stored = readStoredConsentRegion();
  if (stored) return stored === "required";
  try {
    const response = await fetch("/api/consent-region", { cache: "no-store" });
    const { required } = await response.json() as { required?: unknown };
    const result = required !== false;
    storeConsentRegion(result);
    return result;
  } catch {
    return true;
  }
}

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSENT_SETTINGS_EVENT, show);
    if (ANALYTICS_ENABLED && getConsentState() === "pending" && !isAnalyticsBlockedPath(window.location.pathname)) {
      void consentRequired().then(required => {
        if (readStoredConsent()) return;
        if (required) setOpen(true);
        else setConsentState("granted", false);
      });
    }
    return () => window.removeEventListener(OPEN_CONSENT_SETTINGS_EVENT, show);
  }, []);

  if (!open) return null;
  const choose = (granted: boolean) => {
    setConsentState(granted ? "granted" : "denied");
    setOpen(false);
  };
  return <section className="consent-banner" role="dialog" aria-modal="false" aria-labelledby="consent-banner-title">
    <h2 id="consent-banner-title">Cookies &amp; analytics</h2>
    <p>
      We use Google Analytics and PostHog, including session recordings, to understand how 3D Box Studio is used and fix
      problems. They only run if you accept. Your uploaded artwork is never included in recordings.{" "}
      <Link href="/privacy#privacy-cookies-and-similar-technologies">Privacy policy</Link>
    </p>
    <div className="consent-banner-actions">
      <button type="button" onClick={() => choose(false)}>Decline</button>
      <button type="button" className="is-primary" onClick={() => choose(true)}>Accept</button>
    </div>
  </section>;
}

export function CookieSettingsButton({ className }: { className?: string }) {
  return <button type="button" className={className ?? "cookie-settings-link"}
    onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_SETTINGS_EVENT))}>Cookie settings</button>;
}
