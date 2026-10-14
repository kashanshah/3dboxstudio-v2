import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminUserProfileView } from '@/components/admin/admin-user-profile';
import { getUserProfile } from '@/server/admin/profiles';
import { decodeRouteParam } from '@/lib/route-params';

export const metadata: Metadata = { title: 'Admin — User' };

type Props = { params: Promise<{ id: string }> };

export default async function AdminUserPage({ params }: Props) {
  const { id } = await params;
  const profile = await getUserProfile(decodeRouteParam(id));
  if (!profile) notFound();
  return (
    <>
      <p className="admin-email-back"><Link href="/admin/users">Back to users</Link></p>
      <div className="admin-panel admin-profile-page"><div className="admin-panel-body"><AdminUserProfileView profile={profile} afterDelete="/admin/users" /></div></div>
    </>
  );
}
