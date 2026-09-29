import { NextResponse } from 'next/server';
import { BLOG_POSTS } from '@/content/blogPosts';

const allowed = new Set(BLOG_POSTS.map((post) => `${post.slug}.webp`));

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!allowed.has(filename)) return new NextResponse('Not found', { status: 404 });
  const upstream = `https://raw.githubusercontent.com/kashanshah/3dboxstudio/main/public/images/blog/${encodeURIComponent(filename)}`;
  return NextResponse.redirect(upstream, { status: 307, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
}
