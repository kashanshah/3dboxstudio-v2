'use client';

import { useTranslations } from '@/components/i18n/locale-provider';
import Image from 'next/image';
import { safeReturnTo } from '@/lib/auth-navigation';
import './google-sign-in-button.css';

/** Google's unmodified, pre-approved light web button; keeps our existing OAuth redirect flow. */
export function GoogleSignInButton({ next = '/studio', large = false }: { next?: string; large?: boolean }) {
  const t = useTranslations();

  return (
    <a className={`google-sign-in-button${large ? ' is-large' : ''}`} href={`/api/auth/google?next=${encodeURIComponent(safeReturnTo(next))}`}>
      <Image src="/brand/google-signin-light.png" alt={t("auth.sign_in_with_google")} width={180} height={40} unoptimized />
    </a>
  );
}
