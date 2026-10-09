'use client';

import { useEffect } from 'react';
import { shouldCheckSession } from '@/lib/auth-hint';
import { useAuth } from './auth-provider';

/**
 * Rendered by pages the server has already shown to a signed-in user. If the
 * hint cookie is missing there, the provider skipped /api/auth/me; asking now
 * shows the account and restores the hint.
 */
export function SignedInHintRepair(){
  const {refresh}=useAuth();
  useEffect(()=>{if(!shouldCheckSession())void refresh();},[refresh]);
  return null;
}
