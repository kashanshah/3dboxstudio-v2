export type Release = {
  id: string;
  date: string;
  version?: string;
  title: string;
  summary: string;
  highlights: string[];
  tags: ('New' | 'Improved' | 'Fixed')[];
  landingPage?: { href: string; label: string };
  image?: { src: string; alt: string; width: number; height: number };
};

// Add published updates here. Dates use YYYY-MM-DD; landing pages are optional.
// The changelog sorts entries newest first, independent of their position here.
export const releases: Release[] = [
  {
    id: 'v2',
    date: '2026-10-01',
    version: 'V2',
    title: 'Meet the new 3DBoxStudio',
    summary: 'A redesigned Studio brings box setup, dieline artwork, and live 3D review into one connected packaging workflow.',
    tags: ['New', 'Improved'],
    highlights: [
      'Move through Box, Design, and Preview & Download workspaces to take your packaging from structure to finished mockup.',
      'Set dimensions, board thickness, materials, and inside and outside colors before adding your artwork.',
      'Design on the flat dieline with artwork layers and a live 3D preview beside the canvas.',
      'Keep multiple Box Designs together in Projects, share interactive previews, and export PNG mockups or flat-layout PDFs.',
      'Sign in with your existing 3DBoxStudio account to continue in the new Studio.',
    ],
    landingPage: { href: '/whats-new/v2', label: 'Explore what’s new in V2' },
    image: {
      src: '/images/v2-launch/studio-design-artwork.png',
      alt: 'The new dieline artwork workspace with layers and a live 3D box preview',
      width: 2048,
      height: 1144,
    },
  },
];

export const changelogReleases = [...releases].sort((a, b) => b.date.localeCompare(a.date));
