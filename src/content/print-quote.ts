import { site } from '@/lib/site';

// The "Get this box printed" request: its choices and the checks both the
// form and the API apply. Requests are stored with the contact messages and
// emailed to the admin; there is no printing partner integration yet.

export const QUOTE_QUANTITIES = ['Under 100', '100–499', '500–999', '1,000–4,999', '5,000–9,999', '10,000 or more'] as const;
export const QUOTE_COLOURS = ['Not sure yet', 'Unprinted', '1 or 2 colours', 'Full colour (CMYK)', 'Full colour plus spot colours', 'Printed inside and out'] as const;
export const QUOTE_FINISHES = ['Not sure yet', 'None', 'Matte', 'Gloss', 'Soft touch', 'Foil', 'Embossing or debossing', 'Spot UV'] as const;

export const QUOTE_CONSENT = 'I agree that 3D Box Studio may share this request, including my name, email and country, with printing partners so they can quote for it.';

/** The box as the generator sends it. */
export type QuoteBox = {
  style: string; styleName: string; length: number; width: number; depth: number; units: 'mm' | 'in'; mode: string; material: string; thickness: number;
  /** The generator page with this box's settings, as a path on this site. */
  link: string;
};

export type QuoteRequest = {
  box: QuoteBox;
  quantity: (typeof QUOTE_QUANTITIES)[number];
  colours: (typeof QUOTE_COLOURS)[number];
  finish: (typeof QUOTE_FINISHES)[number];
  deadline: string | null;
  name: string;
  email: string;
  country: string;
  notes: string | null;
};

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
  const country = text(input.country, 80);
  if (!country) return { ok: false, error: 'Enter your country.' };
  const notes = typeof input.notes === 'string' && input.notes.trim() ? text(input.notes, 2000) : null;
  if (typeof input.notes === 'string' && input.notes.trim() && !notes) return { ok: false, error: 'Keep the notes under 2,000 characters.' };
  if (input.consent !== true) return { ok: false, error: 'Tick the box to agree that we may share the request with printing partners.' };
  return { ok: true, request: { box: { style, styleName, length, width, depth, units, mode, material, thickness, link: path }, quantity, colours, finish, deadline, name, email, country, notes } };
}

/** The request as plain lines, for the stored message and the email. */
export function quoteLines(request: QuoteRequest): [string, string][] {
  const { box } = request;
  return [
    ['Box', box.styleName],
    ['Size', `${box.length} × ${box.width} × ${box.depth} ${box.units} (${box.mode})`],
    ['Board', `${box.material}, ${box.thickness} mm`],
    ['Quantity', request.quantity],
    ['Printing', request.colours],
    ['Finish', request.finish],
    ['Needed by', request.deadline ?? 'No date given'],
    ['Name', request.name],
    ['Email', request.email],
    ['Country', request.country],
    ['Notes', request.notes ?? '—'],
    ['Box link', new URL(box.link, site.url).toString()],
  ];
}
