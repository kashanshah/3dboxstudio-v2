import { isAnalyticsBlockedPath, setGaDisableFlag } from "./policy";

type AnalyticsWindow = Window & {
  __syncAnalyticsRoute?: (pathname: string) => void;
  posthog?: {
    set_config?: (config: Record<string, unknown>) => void;
    stopSessionRecording?: () => void;
  };
};

export function syncAnalyticsRoute(pathname: string): void {
  const blocked = isAnalyticsBlockedPath(pathname);
  setGaDisableFlag(blocked);
  const w = window as AnalyticsWindow;
  w.posthog?.set_config?.({
    autocapture: !blocked,
    capture_pageleave: !blocked,
    disable_session_recording: blocked,
  });
  if (blocked) w.posthog?.stopSessionRecording?.();
}

// Run before SDK history listeners, so enhanced measurement and replay cannot
// observe an admin navigation before React's route effects have committed.
export function installAnalyticsRouteGuard(): () => void {
  const w = window as AnalyticsWindow;
  const history = w.history;
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const wrap = (original: History["pushState"]): History["pushState"] => function (data, unused, url) {
    const target = url == null ? w.location.pathname : new URL(url, w.location.href).pathname;
    syncAnalyticsRoute(target);
    try {
      return original.call(history, data, unused, url);
    } finally {
      syncAnalyticsRoute(w.location.pathname);
    }
  };
  const push = wrap(originalPush);
  const replace = wrap(originalReplace);
  const onPopState = () => syncAnalyticsRoute(w.location.pathname);
  w.__syncAnalyticsRoute = syncAnalyticsRoute;
  history.pushState = push;
  history.replaceState = replace;
  w.addEventListener("popstate", onPopState, true);
  onPopState();
  return () => {
    if (history.pushState === push) history.pushState = originalPush;
    if (history.replaceState === replace) history.replaceState = originalReplace;
    w.removeEventListener("popstate", onPopState, true);
    delete w.__syncAnalyticsRoute;
  };
}
