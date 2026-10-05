const explicitIndexing = process.env.SITE_INDEXABLE;

export const site = {
  name: '3D Box Studio',
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.3dboxstudio.com'),
  // Explicit env wins. If omitted, production deployments are indexable while
  // preview/development deployments remain noindex.
  indexable: explicitIndexing === 'true' || (explicitIndexing == null && process.env.VERCEL_ENV === 'production'),
};

/** Default social preview (1200×630) for pages without their own image. */
export const defaultOgImage = {
  url: '/og/3d-box-studio.png',
  width: 1200,
  height: 630,
  alt: '3D Box Studio: design the box on the dieline and see it in 3D. Free online 3D box designer and packaging mockup generator.',
};
