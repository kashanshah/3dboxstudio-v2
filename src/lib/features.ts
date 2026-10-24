// Feature flags: one place for features that are built but not yet switched
// on for everyone. Each flag is 'off' (nowhere), 'draft' (previews and
// development only, like draft pages), 'beta' (accounts given Pro access in
// the admin, a Pro flag only) or 'on' (everywhere).
// NEXT_PUBLIC_FEATURES (a comma-separated list of ids) turns flags on for one
// deployment, to try a feature before it ships.
//
// Pro flags mark capabilities that may one day be paid. A Pro flag may only
// add something new: never put an existing free feature behind one. Every
// dieline download, the 3D Studio, saved Studio projects, share links and
// image and video exports stay free (FREE_FOREVER below; a test checks no Pro
// flag claims one).

export type FeatureStatus = 'off' | 'draft' | 'beta' | 'on';
export type Feature = { status: FeatureStatus; pro: boolean; summary: string };

export const FEATURES = {
  printQuote: { status: 'draft', pro: false, summary: 'Get this box printed: a quote request form on the dieline generator, emailed to the admin.' },
  welcomeEmails: { status: 'on', pro: false, summary: 'A welcome email when an account is verified, and one follow-up 3 days later, each with an unsubscribe link.' },
  clientShares: { status: 'beta', pro: true, summary: 'Branded links for clients: your name and logo instead of ours, and an optional password. Plain share links stay free.' },
  nesting: { status: 'off', pro: true, summary: 'Nest several dielines on a press sheet (imposition).' },
  costEstimate: { status: 'off', pro: true, summary: 'An estimated print cost for a box at a given quantity and board.' },
  savedDielines: { status: 'off', pro: true, summary: 'A library of saved generator boxes. Saving Studio projects stays free.' },
  bulkExport: { status: 'off', pro: true, summary: 'Many sizes or styles in one go, for example from a spreadsheet, as one zip. Single files stay free.' },
  apiKeys: { status: 'off', pro: true, summary: 'API keys to generate dielines from other software.' },
} satisfies Record<string, Feature>;

export type FeatureId = keyof typeof FEATURES;

/** What stays free whatever is added later. */
export const FREE_FOREVER = [
  'Dieline downloads: SVG, PDF (1:1 and tiled), DXF, PNG and cutting-machine files, in any size, with no account',
  'Every box style in the generator and the Studio',
  'Designing in the 3D Studio with a free account, and saving Studio projects',
  'Share links',
  'PNG, JPG and MP4 exports from the Studio',
] as const;

const showDrafts = () => process.env.NEXT_PUBLIC_SHOW_DRAFTS === 'true';
const forced = () => new Set((process.env.NEXT_PUBLIC_FEATURES ?? '').split(',').map(id => id.trim()).filter(Boolean));

/** Whether a feature is on in this deployment. Works on the server and in the browser. */
export function isFeatureOn(id: FeatureId): boolean {
  const feature: Feature = FEATURES[id];
  if (forced().has(id)) return true;
  return feature.status === 'on' || (feature.status === 'draft' && showDrafts());
}

/** Whether this account can use a feature: on for the deployment, or a beta Pro feature and the account has Pro access. */
export function canUseFeature(id: FeatureId, user: { pro?: boolean } | null | undefined): boolean {
  const feature: Feature = FEATURES[id];
  return isFeatureOn(id) || (feature.pro && feature.status === 'beta' && Boolean(user?.pro));
}
