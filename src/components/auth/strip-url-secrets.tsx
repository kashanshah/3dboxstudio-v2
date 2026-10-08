'use client';

import { useLayoutEffect } from 'react';

/**
 * Reset and verification links put a single-use token in the URL. The page
 * already has it as a prop, so drop it from the address bar straight away:
 * it then can't leak through analytics, session replay, referrers or history.
 */
export function StripUrlSecrets() {
  useLayoutEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) return;
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, []);
  return null;
}
