export const site = {
  name: '3D Box Studio',
  // Keep the established production domain canonical during V2 staging.
  // v2.3dmodel.com remains noindex unless SITE_INDEXABLE=true.
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.3dboxstudio.com'),
  indexable: process.env.SITE_INDEXABLE === 'true',
};
