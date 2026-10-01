"use client";

import { useLayoutEffect } from "react";
import { installAnalyticsRouteGuard } from "@/lib/analytics/route-guard";

export function AnalyticsRouteGuard() {
  useLayoutEffect(installAnalyticsRouteGuard, []);
  return null;
}
