const explicitIndexing = process.env.SITE_INDEXABLE;

export const site = {
  name: '3D Box Studio',
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.3dboxstudio.com'),
  // Explicit env wins. If omitted, production deployments are indexable while
  // preview/development deployments remain noindex.
  indexable: explicitIndexing === 'true' || (explicitIndexing == null && process.env.VERCEL_ENV === 'production'),
};
