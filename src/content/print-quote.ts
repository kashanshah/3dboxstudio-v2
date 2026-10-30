import { site } from '@/lib/site';

// The "Get this box printed" request: its choices and the checks both the
// form and the API apply. Requests are stored with the contact messages and
// emailed to the admin; there is no printing partner integration yet.

export const QUOTE_QUANTITIES = ['Under 100', '100–499', '500–999', '1,000–4,999', '5,000–9,999', '10,000 or more'] as const;
export const QUOTE_COLOURS = ['Not sure yet', 'Unprinted', '1 or 2 colours', 'Full colour (CMYK)', 'Full colour plus spot colours', 'Printed inside and out'] as const;
export const QUOTE_FINISHES = ['Not sure yet', 'None', 'Matte', 'Gloss', 'Soft touch', 'Foil', 'Embossing or debossing', 'Spot UV'] as const;

export const QUOTE_CONSENT = 'I agree that 3D Box Studio may share this request, including my name, email and country, with printing partners so they can quote for it.';
export const WAITLIST_CONSENT = 'Email me once when printing is available in my country. My email is used for nothing else.';

/** Where printing is offered at launch: the US, Canada, the UK and the EU. Elsewhere the form takes a waitlist email instead. */
export const PRINT_COUNTRIES: ReadonlySet<string> = new Set([
  'US', 'CA', 'GB',
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

/** ISO 3166-1 alpha-2 codes, for the country list. */
export const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
  'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
] as const;

const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRY_CODES);
let names: Intl.DisplayNames | null = null;
/** "United Kingdom" for "GB"; the code itself if the runtime has no name for it. */
export function countryName(code: string) {
  try { names ??= new Intl.DisplayNames(['en'], { type: 'region' }); return names.of(code) ?? code; } catch { return code; }
}
/** A known country code, upper-cased, or null (a visitor's location header, a form value). */
export function countryCode(value: unknown) {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return COUNTRY_SET.has(code) ? code : null;
}
export const printsIn = (code: string | null) => Boolean(code && PRINT_COUNTRIES.has(code));

/** The box as the generator sends it. */
export type QuoteBox = {
  style: string; styleName: string; length: number; width: number; depth: number; units: 'mm' | 'in'; mode: string; material: string; thickness: number;
  /** The generator page with this box's settings, as a path on this site. */
  link: string;
  /** Where the request came from: the dieline generator, or the Studio. */
  source?: 'generator' | 'studio';
  /** The Studio's finish (Kraft, Gloss coated…), when it came from the Studio. */
  finish?: string;
};

export type QuoteRequest = {
  box: QuoteBox;
  quantity: (typeof QUOTE_QUANTITIES)[number];
  colours: (typeof QUOTE_COLOURS)[number];
  finish: (typeof QUOTE_FINISHES)[number];
  deadline: string | null;
  name: string;
  email: string;
  /** ISO 3166-1 alpha-2 code, one printing is offered in. */
  country: string;
  notes: string | null;
};

/** "Tell me when printing is available in my country", from a country printing isn't offered in yet. */
export type WaitlistRequest = { email: string; country: string; box: { style: string; styleName: string; source: 'generator' | 'studio' } };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown, max: number) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
};
const oneOf = <T extends string>(list: readonly T[], value: unknown) => (list as readonly unknown[]).includes(value) ? value as T : null;
const size = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 10000 ? value : null;

/** Checks a request; returns it cleaned, or the first problem in words for the form. */
export function parseQuoteRequest(body: unknown): { ok: true; request: QuoteRequest } | { ok: false; error: string } {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const raw = input.box && typeof input.box === 'object' ? input.box as Record<string, unknown> : {};
  const style = text(raw.style, 60), styleName = text(raw.styleName, 120), mode = text(raw.mode, 20), material = text(raw.material, 80), link = text(raw.link, 2000);
  // The generator page and its settings, as a path on this site.
  const path = link && /^\/(?!\/)[^\s]*$/.test(link) ? link : null;
  const length = size(raw.length), width = size(raw.width), depth = size(raw.depth), thickness = size(raw.thickness);
  const units = raw.units === 'mm' || raw.units === 'in' ? raw.units : null;
  if (!style || !styleName || !mode || !material || !path || !length || !width || !depth || !thickness || !units) return { ok: false, error: 'The box size is missing. Close this form, check the size and try again.' };
  const quantity = oneOf(QUOTE_QUANTITIES, input.quantity);
  if (!quantity) return { ok: false, error: 'Choose a quantity.' };
  const colours = oneOf(QUOTE_COLOURS, input.colours);
  if (!colours) return { ok: false, error: 'Choose the printing.' };
  const finish = oneOf(QUOTE_FINISHES, input.finish);
  if (!finish) return { ok: false, error: 'Choose a finish.' };
  const deadline = typeof input.deadline === 'string' && input.deadline ? (/^\d{4}-\d{2}-\d{2}$/.test(input.deadline) ? input.deadline : undefined) : null;
  if (deadline === undefined) return { ok: false, error: 'Enter the date as a calendar date.' };
  const name = text(input.name, 120);
  if (!name) return { ok: false, error: 'Enter your name.' };
  const email = text(input.email, 254);
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const country = countryCode(input.country);
  if (!country) return { ok: false, error: 'Choose your country.' };
  if (!printsIn(country)) return { ok: false, error: `Printing isn't available in ${countryName(country)} yet.` };
  const notes = typeof input.notes === 'string' && input.notes.trim() ? text(input.notes, 2000) : null;
  if (typeof input.notes === 'string' && input.notes.trim() && !notes) return { ok: false, error: 'Keep the notes under 2,000 characters.' };
  if (input.consent !== true) return { ok: false, error: 'Tick the box to agree that we may share the request with printing partners.' };
  const source = raw.source === 'studio' ? 'studio' : 'generator';
  const boxFinish = text(raw.finish, 60);
  return { ok: true, request: { box: { style, styleName, length, width, depth, units, mode, material, thickness, link: path, source, ...(boxFinish ? { finish: boxFinish } : {}) }, quantity, colours, finish, deadline, name, email, country, notes } };
}

/** Checks a waitlist request: an email, a country printing isn't offered in yet, and the box it was for. */
export function parseWaitlistRequest(body: unknown): { ok: true; request: WaitlistRequest } | { ok: false; error: string } {
  const input = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const raw = input.box && typeof input.box === 'object' ? input.box as Record<string, unknown> : {};
  const email = text(input.email, 254);
  if (!email || !EMAIL.test(email)) return { ok: false, error: 'Enter a valid email address.' };
  const country = countryCode(input.country);
  if (!country) return { ok: false, error: 'Choose your country.' };
  if (printsIn(country)) return { ok: false, error: `Printing is available in ${countryName(country)}: ask for a quote instead.` };
  if (input.consent !== true) return { ok: false, error: 'Tick the box so we may email you when printing is available.' };
  const style = text(raw.style, 60) ?? 'unknown', styleName = text(raw.styleName, 120) ?? 'Unknown box';
  return { ok: true, request: { email, country, box: { style, styleName, source: raw.source === 'studio' ? 'studio' : 'generator' } } };
}

/** The request as plain lines, for the stored message and the email. */
export function quoteLines(request: QuoteRequest): [string, string][] {
  const { box } = request;
  return [
    ['Box', box.styleName],
    ['Size', `${box.length} × ${box.width} × ${box.depth} ${box.units} (${box.mode})`],
    ['Board', `${box.material}, ${box.thickness} mm`],
    ...(box.finish ? [['Studio finish', box.finish] as [string, string]] : []),
    ['Quantity', request.quantity],
    ['Printing', request.colours],
    ['Finish', request.finish],
    ['Needed by', request.deadline ?? 'No date given'],
    ['Name', request.name],
    ['Email', request.email],
    ['Country', `${countryName(request.country)} (${request.country})`],
    ['Notes', request.notes ?? '—'],
    ['Sent from', box.source === 'studio' ? 'Studio' : 'Dieline generator'],
    ['Box link', new URL(box.link, site.url).toString()],
  ];
}
