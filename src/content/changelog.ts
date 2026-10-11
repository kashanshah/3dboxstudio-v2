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
    id: 'text-tool',
    date: '2026-10-11',
    title: 'Add text to your box',
    summary: 'Type straight onto the dieline: brand names, taglines and labels, in nine fonts, on the outside or the inside of any box.',
    tags: ['New'],
    highlights: [
      'Design → Add text puts a text layer on the face people see first: the lid of a mailer or rigid box, the front of a carton.',
      'Choose from nine fonts (sans, condensed, display, serif, script and mono), bold, colour, alignment, letter spacing and line height.',
      'Text stays editable after saving, and appears in the 3D view, the PNG and MP4 downloads and the 1:1 PDF exactly as on the sheet.',
    ],
  },
  {
    id: 'rigid-box-svg-dxf',
    date: '2026-10-11',
    title: 'Rigid lid and base boxes, SVG and DXF dielines, and adjustable flap sizes',
    summary: 'Design a two-piece rigid gift box, download any dieline as SVG or DXF for your box maker, and change the size of each flap and panel on the box itself.',
    tags: ['New', 'Improved'],
    highlights: [
      'New rigid lid and base box template: both wraps drawn from the inside size of the base, with corner ears, turn-ins and an adjustable lid height, and the lid lifting off in 3D.',
      'New mailer box template (FEFCO 0427 roll end tuck top) with a self-locking base and hinged lid.',
      'Download the cutting template of any box as SVG or DXF at 1:1 in millimetres, with cut and crease lines on separate layers.',
      'Change the size of each flap and panel, from the Sizes panel, by typing on the 3D box or the flat dieline, or by dragging handles on the dieline.',
      'Show sizes is on by default and labels the box and flap sizes in 3D, including with the lid open.',
      'Fold and flatten animations now run smoothly from 0 to 100%.',
    ],
    landingPage: { href: '/box-templates/rigid-box', label: 'Try the rigid box template' },
    image: {
      src: '/images/blog/rigid-box-lid-and-base-template.webp',
      alt: 'Rigid lid and base box wrap layout next to the folded box with its lid lifting off',
      width: 1200,
      height: 800,
    },
  },
  {
    id: 'mp4-video-camera-angles',
    date: '2026-10-09',
    title: 'MP4 video export and more camera angles',
    summary: 'Download a short video of your box folding closed and turning, ready for product pages, ads and social posts.',
    tags: ['New', 'Improved'],
    highlights: [
      'Preview & Download → Video renders a clip of about 10 seconds in your browser: the box folds from flat to closed, then turns once.',
      'Videos are 1080p MP4 (720p on phones) and use your artwork, material and lighting.',
      'New camera angles: Hero (low angle), Back angle and Overhead.',
      'The fold button now runs at an even pace, so each stage of the fold reads clearly.',
    ],
  },
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
