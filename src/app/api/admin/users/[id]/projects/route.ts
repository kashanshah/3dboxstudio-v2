import { NextResponse } from 'next/server';
import { decodeRouteParam } from '@/lib/route-params';
import { requireAdminApi } from '@/server/admin/auth';
import { listUserProjects } from '@/server/admin/catalog';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const denied = await requireAdminApi();
  if (denied) return denied;
  const { id } = await params;
  const userId = decodeRouteParam(id).trim().slice(0, 80);
  if (!userId) return NextResponse.json({ error: 'User id is required.' }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1');
  const pageSize = Number(searchParams.get('pageSize') ?? '100');
  try {
    const result = await listUserProjects(userId, {
      page: Number.isInteger(page) ? page : 1,
      pageSize: Number.isInteger(pageSize) ? pageSize : 100,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/admin/users/[id]/projects failed:', error);
    return NextResponse.json({ error: 'Could not load projects.' }, { status: 500 });
  }
}
