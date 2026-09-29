'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Next.js can preserve the previous scroll position during client-side route
 * transitions. Marketing/content pages should open at the top unless the URL
 * explicitly includes a hash target.
 */
export function ScrollToTopOnRouteChange() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
