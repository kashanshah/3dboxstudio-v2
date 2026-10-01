import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedDesignViewer } from '@/components/studio/shared-design-viewer';
import { decodeRouteParam } from '@/lib/route-params';
import { getAdminDesignView } from '@/server/admin/catalog';

export const metadata: Metadata = {
  title: 'Admin — Design preview',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminDesignViewPage({ params }: Props) {
  const { id: rawId } = await params;
  const design = await getAdminDesignView(decodeRouteParam(rawId));
  if (!design) notFound();
  return <SharedDesignViewer name={design.name} state={design.state} legacy={design.legacy} />;
}
