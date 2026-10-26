import { readFile } from 'node:fs/promises';
import type { Browser, Page } from '@playwright/test';
import { test, expect, allowPageErrors } from './support/fixtures';
import { ADMIN_STATE, USER_STATE } from './support/user';

// Admin → Templates end to end: what an admin changes shows on the public
// site (gallery, template pages, generator, Studio, sitemap, llms.txt),
// and designs keep opening whatever happens to their template.

test.use({ storageState: ADMIN_STATE });
test.setTimeout(180_000);

const PREVIEW = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Saves a design for the test user through the API; returns its id. */
async function saveDesign(browser: Browser, name: string, templateId: string, extra: Record<string, unknown> = {}) {
  const context = await browser.newContext({ storageState: USER_STATE });
  const state = {
    version: 1, templateId, dimensions: { width: 90, height: 140, depth: 70, thickness: 0.5 },
    material: 'Kraft', opening: 0, measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [], insideArtworkLayers: [], mediaAssets: [],
    outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff', ...extra,
  };
  const response = await context.request.post('/api/projects', { data: { name, state, preview: PREVIEW } });
  expect(response.ok(), await response.text()).toBe(true);
  const id = (await response.json()).project.id as string;
  await context.close();
  return id;
}

/** The Active/Inactive switch of a template on Admin → Templates. */
async function setActive(page: Page, name: string, active: boolean) {
  await page.goto('/admin/templates');
  const toggle = page.getByRole('switch', { name: `${name} active` });
  if ((await toggle.getAttribute('aria-checked')) !== String(active)) await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(active));
}

/** Reloads a public page until it shows the admin's change (it regenerates on the visit after one). */
async function eventually(page: Page, path: string, check: () => Promise<boolean>) {
  await expect.poll(async () => { await page.goto(path); return check(); }, { timeout: 30_000, intervals: [500, 1000, 2000] }).toBe(true);
}

test('a template made inactive leaves the gallery, generator and Studio, and its designs still open', async ({ page, browser }) => {
  const designId = await saveDesign(browser, 'E2E gable design', 'gable-box');
  const user = await browser.newContext({ storageState: USER_STATE });
  const studio = await user.newPage();
  try {
    await setActive(page, 'Gable Box', false);

    const galleryCard = page.locator('.template-card h3').filter({ hasText: /^Gable box$/ });
    await eventually(page, '/box-templates', async () => (await galleryCard.count()) === 0);
    await expect(page.locator('.template-card').first()).toBeVisible();
    await eventually(page, '/box-dieline-generator', async () => (await page.getByRole('radio', { name: /Gable box/ }).count()) === 0);

    // Its page sends visitors to the gallery, temporarily, so it can come back.
    const redirected = await page.request.get('/box-templates/gable-box', { maxRedirects: 0 });
    expect(redirected.status()).toBe(307);
    expect(redirected.headers().location).toMatch(/\/box-templates$/);
    expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain('/box-templates/gable-box<');
    expect(await (await page.request.get('/llms.txt')).text()).toContain('dielines for 15 box styles');

    // The new-design dialog doesn't offer it, and a link to it starts from the default template.
    await studio.goto('/studio/editor');
    await expect(studio.locator('input[name="new-design-template"]').first()).toBeAttached();
    await expect(studio.locator('input[name="new-design-template"][value="gable-box"]')).toHaveCount(0);
    await studio.goto('/studio/editor?template=gable-box');
    await expect(studio.locator('input[name="new-design-template"]:checked')).not.toHaveValue('gable-box');

    // The design made from it opens, folds and saves as before.
    await studio.goto(`/studio/editor?project=${designId}`);
    await expect(studio.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expect(studio.locator('canvas.carton-engine-canvas').first()).toBeVisible();
  } finally {
    await user.close();
    await setActive(page, 'Gable Box', true);
  }
  await eventually(page, '/box-templates', async () => (await page.locator('.template-card h3').filter({ hasText: /^Gable box$/ }).count()) === 1);
  expect((await page.request.get('/box-templates/gable-box', { maxRedirects: 0 })).status()).toBe(200);
});

test('a template\'s new name shows in the gallery and the Studio, until it is reset', async ({ page, browser }) => {
  await page.goto('/admin/templates/pillow-box');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('E2E Pillow pouch');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('status')).toContainText('Saved');

  const user = await browser.newContext({ storageState: USER_STATE });
  const studio = await user.newPage();
  try {
    await eventually(page, '/box-templates', async () => (await page.locator('.template-card h3').filter({ hasText: 'E2E Pillow pouch' }).count()) === 1);
    await studio.goto('/studio/editor');
    await expect(studio.locator('.pro-new-design-template').filter({ hasText: 'E2E Pillow pouch' })).toBeVisible();
  } finally {
    await user.close();
    await page.goto('/admin/templates/pillow-box');
    page.once('dialog', dialog => void dialog.accept());
    await page.getByRole('button', { name: 'Reset to original' }).click();
    await expect(page.getByRole('status')).toContainText('original');
  }
  await page.goto('/admin/templates');
  await expect(page.getByRole('link', { name: 'Pillow Box', exact: true })).toBeVisible();
});

test('a named template is added from a style, and a design made from it records it', async ({ page, browser }) => {
  await page.goto('/admin/templates/new');
  await page.getByRole('combobox', { name: /^Box style/ }).selectOption('hexagon-box');
  await page.getByRole('textbox', { name: /^Slug/ }).fill('e2e-candle-box');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('E2E Candle box');
  await page.getByRole('textbox', { name: 'Short description' }).fill('A hexagon box for candles.');
  await page.getByRole('spinbutton', { name: /^Across flats/ }).fill('80');
  await page.getByRole('spinbutton', { name: /^Height/ }).fill('100');
  await page.getByRole('button', { name: 'Add template' }).click();
  await expect(page).toHaveURL(/\/admin\/templates\/e2e-candle-box\?created=1/);
  await expect(page.getByRole('heading', { name: 'E2E Candle box' })).toBeVisible();

  // It is listed like any template, with its own defaults.
  await eventually(page, '/box-templates', async () => (await page.locator('.template-card h3').filter({ hasText: 'E2E Candle box' }).count()) === 1);
  await eventually(page, '/box-dieline-generator', async () => (await page.getByRole('radio', { name: /E2E Candle box/ }).count()) === 1);

  const user = await browser.newContext({ storageState: USER_STATE });
  const studio = await user.newPage();
  try {
    await studio.goto('/studio/editor?template=e2e-candle-box');
    await expect(studio.locator('input[name="new-design-template"]:checked')).toHaveValue('e2e-candle-box');
    await expect(studio.locator('#new-design-width')).toHaveValue('80');
    await studio.locator('#new-design-name').fill('E2E candle design');
    await studio.getByRole('button', { name: 'Create design' }).click();
    await expect(studio).toHaveURL(/\/studio\/editor\?project=/);
    await expect(studio.getByRole('button', { name: 'Saved' })).toBeVisible();
    // It reopens, drawn by the hexagon box.
    await studio.reload();
    await expect(studio.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expect(studio.locator('canvas.carton-engine-canvas').first()).toBeVisible();
  } finally {
    await user.close();
  }

  // Counted on Admin → Templates; the count opens the designs list filtered to it.
  await page.goto('/admin/templates');
  const row = page.getByRole('row').filter({ hasText: 'e2e-candle-box' });
  await row.getByRole('link', { name: /1 designs using E2E Candle box/ }).click();
  await expect(page).toHaveURL(/\/admin\/designs\?template=e2e-candle-box/);
  const design = page.getByRole('row').filter({ hasText: 'E2E candle design' });
  await expect(design).toBeVisible();
  await expect(design).toContainText('E2E Candle box');
  await expect(page.getByRole('row').filter({ hasText: 'E2E gable design' })).toHaveCount(0);
});

test('an uploaded JSON definition is refused with a reason, or saved as an inactive draft', async ({ page }) => {
  await page.goto('/admin/templates/new?kind=json');
  // A refused definition is answered 422, which the browser logs.
  allowPageErrors(page, /status of 422/);
  const refusal = page.locator('.admin-template-json-error');
  await page.getByRole('textbox', { name: 'Definition (JSON)' }).fill('{ "format": "parametric-template/0", "templateId": "e2e-broken" }');
  await page.getByRole('button', { name: 'Check and save as draft' }).click();
  await expect(refusal).toContainText('"format" must be "parametric-template/1"');

  const broken = JSON.parse(await readFile('e2e/fixtures/tray-template.json', 'utf8'));
  broken.templateId = 'e2e-broken-tray';
  broken.derived.push(['oops', 'noSuchValue * 2']);
  await page.getByRole('textbox', { name: 'Definition (JSON)' }).fill(JSON.stringify(broken));
  await page.getByRole('button', { name: 'Check and save as draft' }).click();
  await expect(refusal).toContainText('Unknown value "noSuchValue"');

  await page.getByRole('textbox', { name: 'Definition (JSON)' }).fill(await readFile('e2e/fixtures/tray-template.json', 'utf8'));
  await page.getByRole('button', { name: 'Check and save as draft' }).click();
  await expect(page).toHaveURL(/\/admin\/templates\/e2e-tray\?created=1/);
  await expect(page.getByRole('status').first()).toContainText('inactive draft');
  await expect(page.getByRole('switch', { name: 'E2E uploaded tray active' })).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('img', { name: 'Flat cutting template' })).toBeVisible();
  await expect(page.locator('.admin-template-3d canvas')).toBeVisible();

  // A draft is listed nowhere public.
  await page.goto('/admin/templates');
  await expect(page.getByRole('row').filter({ hasText: 'e2e-tray' })).toContainText('JSON');
  await page.goto('/box-templates');
  await expect(page.locator('.template-card h3').filter({ hasText: 'E2E uploaded tray' })).toHaveCount(0);
});

test('the designs list filters by template, with the search and sorts', async ({ page, browser }) => {
  await saveDesign(browser, 'E2E filter mailer', 'mailer-box');
  await saveDesign(browser, 'E2E filter cake', 'cake-box');
  await page.goto('/admin/designs?q=E2E%20filter');
  await expect(page.getByRole('row').filter({ hasText: 'E2E filter mailer' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'E2E filter cake' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Template' }).selectOption('cake-box');
  await expect(page).toHaveURL(/template=cake-box/);
  await expect(page).toHaveURL(/q=E2E/);
  await expect(page.getByRole('row').filter({ hasText: 'E2E filter cake' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'E2E filter mailer' })).toHaveCount(0);
  await expect(page.locator('.admin-filter-note')).toContainText('Cake Box');
  // Sorting keeps the filter.
  await page.getByRole('link', { name: 'Design', exact: true }).click();
  await expect(page).toHaveURL(/template=cake-box/);
  await expect(page.getByRole('row').filter({ hasText: 'E2E filter mailer' })).toHaveCount(0);
});

test('after an admin change every template page still answers, Spanish ones and their prefetches too', async ({ page }) => {
  // A change revalidates the whole site; each page regenerates on its next visit.
  await setActive(page, 'Sleeve Box', false);
  await setActive(page, 'Sleeve Box', true);
  for (const path of ['/box-templates', '/box-templates/mailer-box', '/box-dieline-generator', '/es/box-templates', '/es/box-templates/mailer-box', '/es/box-dieline-generator']) {
    for (const headers of [{}, { RSC: '1' }] as Record<string, string>[]) {
      const response = await page.request.get(path, { headers });
      expect(response.status(), `${path} ${JSON.stringify(headers)}`).toBe(200);
    }
  }
  // Pages that never existed still 404.
  for (const path of ['/box-templates/no-such-box', '/fr/box-templates', '/fr/box-dieline-generator', '/es/box-templates/no-such-box']) {
    expect((await page.request.get(path)).status(), path).toBe(404);
  }
  await page.goto('/es/box-templates');
  await page.getByRole('link', { name: /Caja postal|mailer/i }).first().click();
  await expect(page).toHaveURL(/\/es\/box-templates\/mailer-box/);
});
