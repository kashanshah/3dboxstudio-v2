import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminDesignProfileView } from '@/components/admin/admin-design-profile';
import { getDesignProfile } from '@/server/admin/profiles';
import { getCurrentUser } from '@/server/auth/session';

export const metadata: Metadata = { title: 'Admin — Design' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ copy?: string }> };

export default async function AdminDesignPage({ params, searchParams }: Props) {
  const { id: rawId } = await params;
  const { copy } = await searchParams;
  // The copy goes to whichever Studio account is signed in on this browser.
  // The profile decodes the route parameter itself.
  const [profile, studioUser] = await Promise.all([getDesignProfile(rawId), getCurrentUser()]);
  if (!profile) notFound();
  return (
    <>
      <p className="admin-email-back"><Link href="/admin/designs">Back to designs</Link></p>
      <div className="admin-panel admin-profile-page"><div className="admin-panel-body"><AdminDesignProfileView profile={profile} afterDelete="/admin/designs" studioUserEmail={studioUser?.email ?? null} copy={copy} /></div></div>
    </>
  );
}
