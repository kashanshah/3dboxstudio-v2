export const site = {
  name: '3D Box Studio',
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  indexable: process.env.SITE_INDEXABLE === 'true',
};
