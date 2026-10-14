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
    id: 'snap-lock-bottom-box',
    date: '2026-10-14',
    title: 'New template: snap lock bottom box',
    summary: 'A tuck top carton with a 1-2-3 snap-lock bottom that closes by hand with no glue: stronger than a tuck end, cheaper than a crash lock.',
    tags: ['New'],
    landingPage: { href: '/box-templates/snap-lock-bottom-box', label: 'See the snap lock bottom box template' },
    highlights: [
      'The bottom closes in three moves: fold in the side flaps, fold the back flap over them, then fold the front flap and push its tongue in under the back flap until it snaps.',
      'The dieline has tapered side flaps, a back flap with a half-moon notch and a front flap with a lock tongue, plus a tuck top with dust flaps and a thumb notch, all drawn from your inside size and board thickness.',
      'Watch the bottom close 1-2-3 in 3D, adjust the side flaps and lock tongue, and export the cutting template as a 1:1 PDF, SVG or DXF.',
    ],
  },
  {
    id: 'auto-lock-bottom-box',
    date: '2026-10-13',
    title: 'New template: auto lock bottom box',
    summary: 'A tuck top carton with a crash-lock bottom that locks itself when the carton is opened: the usual choice for bottles, jars and heavier products.',
    tags: ['New'],
    landingPage: { href: '/box-templates/auto-lock-bottom-box', label: 'See the auto lock bottom box template' },
    highlights: [
      'The bottom is folded and glued at the factory. Open the flat carton and the four bottom flaps swing down together and lock, with no tucking by hand.',
      'The dieline has interlocking front and back flaps, side flaps with 45° glue tabs, and a tuck top with dust flaps and a thumb notch, all drawn from your inside size and board thickness.',
      'Watch the bottom fold in 3D, adjust the glue flap, tuck and bottom flap sizes, and export the cutting template as a 1:1 PDF, SVG or DXF.',
    ],
  },
  {
    id: 'video-options',
    date: '2026-10-13',
    title: 'Video options: motion, length and background',
    summary: 'Choose how your MP4 moves, how long it runs and what sits behind the box.',
    tags: ['New'],
    highlights: [
      'Three motions: fold and turn (flat to closed, then one turn), turntable (the closed box turns once) and open and close (the lid opens while the box turns).',
      'Turntable and open and close end exactly where they start, so they loop seamlessly on social posts and product pages.',
      'Pick 6, 10 or 15 seconds, and a studio, white or any colour background.',
    ],
  },
  {
    id: 'delete-account',
    date: '2026-10-13',
    title: 'Delete your account yourself',
    summary: 'You can now delete your 3D Box Studio account from Account settings, without writing to us.',
    tags: ['New'],
    highlights: [
      'Open Account settings → Password & security → Delete account. Confirm with your password, or your email if you sign in with Google, and type DELETE.',
      'Your designs, projects, scenes and uploaded images are removed straight away, and every share link you made stops working.',
    ],
  },
  {
    id: 'studio-tour-shortcuts',
    date: '2026-10-13',
    title: 'A quick tour, keyboard shortcuts and a calmer Studio',
    summary: 'New to the Studio? A one-minute tour shows you around, and every keyboard shortcut is one key away.',
    tags: ['New', 'Improved'],
    highlights: [
      'The first time you open the Studio, a six-step tour points out the three steps, the size and flap controls, the 3D view, the design tools and the downloads. Skip it any time, or take it again from the file menu.',
      'Press ? for the keyboard shortcuts: save, undo and redo, moving the view, nudging artwork by 1 or 10 mm, and the keys that change how dragging, resizing and rotating behave.',
      'The Studio uses a smaller, consistent set of text sizes, so the box gets more of the screen and panels show more at once.',
    ],
  },
  {
    id: 'shapes-qr-barcodes',
    date: '2026-10-12',
    title: 'Shapes, QR codes and barcodes',
    summary: 'Add shapes, a QR code or a retail barcode to any box from the Design panel, with no other tool needed.',
    tags: ['New'],
    highlights: [
      'Seven shapes: rectangle, rounded rectangle, ellipse, triangle, star, line and arrow, with a fill colour, an outline or both. Side handles stretch a shape and its outline keeps its thickness.',
      'QR codes for a link or any text, in your colour, on a light background or a transparent one.',
      'EAN-13, UPC-A and Code 128 barcodes. The check digit is added for you and checked if you type it, and barcodes are placed at 100% size.',
      'Like text, they stay editable after saving and print in the 3D view, the PNG and MP4 downloads and the 1:1 PDF.',
    ],
  },
  {
    id: 'snapping-panel-colour',
    date: '2026-10-11',
    title: 'Snapping, align buttons and panel colours',
    summary: 'Line artwork up with the box in one drag, and colour any panel without making an image for it.',
    tags: ['New'],
    highlights: [
      'Dragged artwork and text snap their edges and centres to every panel and to the sheet, with guide lines. Hold Alt to move freely.',
      'Align buttons line the selected artwork up with the panel it sits on: left, centre, right, top, middle or bottom.',
      'Panel colour fills any panel with a solid colour, including its bleed, under your artwork, in 3D and in every export.',
    ],
  },
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
