import type { Metadata } from 'next';

/** Head tags for URLs that render the 404 page; Next.js adds the noindex itself. */
export const notFoundMetadata:Metadata={
  title:'Page not found',
  description:'This page doesn’t exist. Return to the 3D Box Studio home page, browse packaging guides, or open the Studio.',
};
