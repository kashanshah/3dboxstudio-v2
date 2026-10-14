'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Escape closes the detail panel (unless a dialog inside it is open). */
export function AdminDrawerKeys({ closeHref }: { closeHref: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('dialog[open]')) return;
      router.push(closeHref, { scroll: false });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeHref, router]);
  return null;
}
