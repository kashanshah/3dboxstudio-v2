'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Open normal client-side route changes at the top while preserving explicit
 * hash navigation such as /#workflow and /#showcase.
 */
export function ScrollToTopOnRouteChange() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
