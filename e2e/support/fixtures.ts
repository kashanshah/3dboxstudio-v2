import { test as base, expect, type Page } from '@playwright/test';
import { MAIL_PORT } from './env';

// Every test fails if the page logs an error or throws: a React render loop
// (error #185), a hydration mismatch or a crash in an effect shows up here
// even when the page still looks fine.

const IGNORED = [
  // Vercel's analytics script only exists on Vercel.
  /\/_vercel\//,
  // The admin email previews are sandboxed on purpose (sandbox="" on an
  // srcdoc frame), so nothing in an email can run; newer Chrome reports the
  // blocked attempt.
  /^Blocked script execution in 'about:srcdoc' because the document's frame is sandboxed/,
];

const expected = new WeakMap<Page, RegExp[]>();

/** Lets this test's page log errors matching a pattern (a wrong password's 401, say). */
export function allowPageErrors(page: Page, ...patterns: RegExp[]) {
  expected.set(page, [...(expected.get(page) ?? []), ...patterns]);
}

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const where = message.location().url;
      // A page that is meant to be missing logs its own 404.
      if (/status of 404/.test(message.text()) && where === page.url()) return;
      if (IGNORED.some((pattern) => pattern.test(message.text()) || pattern.test(where))) return;
      errors.push(`console: ${message.text()}${where ? ` (${where})` : ''}`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) errors.push(`HTTP ${response.status()}: ${response.url()}`);
    });
    await use(errors);
    const allowed = expected.get(page) ?? [];
    expect(errors.filter((error) => !allowed.some((pattern) => pattern.test(error))), 'the page logged errors').toEqual([]);
  }, { auto: true }],
});

export { expect };

/**
 * Fails unless the page fits the screen. Measured against the device's
 * width, not the window's: on a phone, a page that is too wide makes the
 * browser zoom out, which widens the window to match.
 */
export async function expectNoHorizontalScroll(page: Page) {
  const screenWidth = page.viewportSize()!.width;
  const pageWidth = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth));
  expect(pageWidth, `page is wider than the ${screenWidth}px screen`).toBeLessThanOrEqual(screenWidth + 1);
}

type Email = { id: string; to: string[]; subject: string; html: string; text?: string };

/** The newest email sent to an address, waiting for it to arrive. */
export async function latestEmailTo(address: string, subject?: RegExp): Promise<Email> {
  let found: Email | undefined;
  await expect.poll(async () => {
    const response = await fetch(`http://127.0.0.1:${MAIL_PORT}/emails`);
    const { data } = await response.json() as { data: Email[] };
    found = data.find((email) => email.to.includes(address) && (!subject || subject.test(email.subject)));
    return Boolean(found);
  }, { message: `an email to ${address}` }).toBe(true);
  return found!;
}
