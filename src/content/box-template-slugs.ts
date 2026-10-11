// Template id → its public page (/box-templates/<slug>). Kept apart from
// box-template-pages.ts so the Studio can link a template to its guide
// without bundling every page's copy; a test checks the two agree.
export const BOX_TEMPLATE_SLUGS: Record<string, string> = {
  'reverse-tuck-carton': 'reverse-tuck-end-box',
  'base-box': 'straight-tuck-end-box',
  'pizza-box': 'pizza-box',
  'mailer-box': 'mailer-box',
  'rigid-lid-base': 'rigid-box',
  'sleeve-box': 'sleeve-box',
  'split-top-box': 'split-top-box',
};
