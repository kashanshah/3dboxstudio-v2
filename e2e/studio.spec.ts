import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';
import { test, expect } from './support/fixtures';
import { USER_STATE } from './support/user';

test.use({ storageState: USER_STATE });
// The studio renders WebGL in software on CI machines; switching steps can take seconds.
test.setTimeout(180_000);

/** Waits until an element stops moving (the sheet lays itself out after a step change). */
async function settled(locator: Locator) {
  let last = '';
  await expect.poll(async () => {
    const box = JSON.stringify(await locator.boundingBox());
    const same = box === last && box !== 'null';
    last = box;
    return same;
  }, { intervals: [500] }).toBe(true);
  return (await locator.boundingBox())!;
}

/** Opens the Design step and waits for the sheet to settle. */
async function openDesignStep(page: Page) {
  await page.getByRole('button', { name: /^2\s*Design/ }).click();
  await settled(page.locator('.pro-dieline-live'));
}

/** A new reverse tuck carton, through the "Create a box design" dialog. */
async function createDesign(page: Page, name: string, size = { width: 100, height: 150, depth: 50 }) {
  await page.goto('/studio/editor?template=reverse-tuck-carton');
  await page.locator('#new-design-name').fill(name);
  await page.locator('#new-design-width').fill(String(size.width));
  await page.locator('#new-design-height').fill(String(size.height));
  await page.locator('#new-design-depth').fill(String(size.depth));
  await page.getByRole('button', { name: 'Create design' }).click();
  await expect(page).toHaveURL(/\/studio\/editor\?project=/);
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
}

/** Uploads the test logo and places it on the dieline. */
async function addLogo(page: Page) {
  await openDesignStep(page);
  await page.getByRole('button', { name: 'Add artwork' }).click();
  const dialog = page.getByRole('dialog', { name: /Add artwork/ });
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Upload image' }).first().click();
  await (await chooser).setFiles('e2e/fixtures/logo.png');
  await expect(dialog.getByRole('button', { name: 'logo.png' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Add to dieline' }).click();
  await expect(dialog).toBeHidden();
  await expect(artwork(page)).toHaveCount(1);
}

const artwork = (page: Page) => page.locator('.pro-full-artwork-transform');
const sheetSizes = (page: Page) => page.locator('.pro-dieline-sizes');

async function aspect(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!.width / box!.height;
}

/** Types a new value into a size label on the sheet ("Height 150 mm, change"). */
async function setSheetSize(page: Page, label: string, mm: number) {
  await sheetSizes(page).getByRole('button', { name: new RegExp(`^${label} [\\d.]+ mm, change$`) }).first().click();
  const input = sheetSizes(page).locator('.dl-size-input');
  await input.fill(String(mm));
  await input.press('Enter');
  await expect(sheetSizes(page).getByRole('button', { name: `${label} ${mm} mm, change` }).first()).toBeVisible();
}

test('create a design, add artwork, resize the box, and it is all saved', async ({ page }) => {
  await createDesign(page, 'E2E carton');
  await addLogo(page);

  // Changing the box does not stretch artwork that is not selected.
  await page.keyboard.press('Escape');
  await expect(artwork(page).and(page.locator('.is-selected'))).toHaveCount(0);
  const before = await aspect(artwork(page));
  await setSheetSize(page, 'Height', 220);
  expect(await aspect(artwork(page))).toBeCloseTo(before, 1);

  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('W 100 × H 220 × D 50 mm').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '3D preview synced' }).first()).toBeVisible();
  await openDesignStep(page);
  await expect(artwork(page)).toHaveCount(1);
  expect(await aspect(artwork(page))).toBeCloseTo(before, 1);
  await expect(page.getByLabel('Design name')).toHaveValue('E2E carton');

  // The dieline SVG can carry the artwork, on its own layer under the lines.
  await page.getByRole('button', { name: /^3\s*Preview/ }).click();
  await page.getByRole('navigation', { name: 'Preview & Download tools' }).getByRole('button', { name: 'Download' }).click();
  await page.getByRole('tab', { name: 'Dieline' }).click();
  await page.getByRole('checkbox', { name: /Include artwork in the SVG/ }).check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download SVG' }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg.indexOf('<g id="ARTWORK"')).toBeGreaterThan(0);
  expect(svg.indexOf('<g id="ARTWORK"')).toBeLessThan(svg.indexOf('<g id="CUT"'));
  expect(svg).toMatch(/<image [^>]*href="data:image\/png;base64,/);
});

test('a size handle follows the pointer and changes the size one for one', async ({ page }) => {
  await createDesign(page, 'E2E handles');
  await openDesignStep(page);
  const handle = page.locator('[data-size-handle="width:front:x"]');
  const start = await settled(handle);
  const x = start.x + start.width / 2, y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let step = 1; step <= 8; step++) await page.mouse.move(x + step * 5, y);
  // The handle stays under the pointer while dragging (the sheet does not
  // jump); sizes move in half millimetres, so within a few pixels.
  await expect.poll(async () => {
    const box = await handle.boundingBox();
    return box ? Math.abs(box.x + box.width / 2 - (x + 40)) : Infinity;
  }).toBeLessThanOrEqual(3);
  await page.mouse.up();
  const width = Number((await handle.getAttribute('aria-label'))?.match(/Width ([\d.]+) mm/)?.[1]);
  expect(width).toBeGreaterThan(100);
});

test('download the 1:1 print PDF', async ({ page }) => {
  await createDesign(page, 'E2E print');
  await openDesignStep(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download 1:1 PDF' }).first().click();
  const file = await (await download).path();
  const bytes = await readFile(file!);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(2_000);
});

test('a share link opens for someone who is signed out', async ({ page, browser }) => {
  await createDesign(page, 'E2E shared');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  const link = await page.getByLabel('Share link').inputValue();
  expect(link).toMatch(/\/studio\/[A-Za-z0-9_-]+$/);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  const errors: string[] = [];
  visitorPage.on('pageerror', (error) => errors.push(error.message));
  const response = await visitorPage.goto(new URL(link).pathname);
  expect(response?.status()).toBe(200);
  await expect(visitorPage.getByText('E2E shared').first()).toBeVisible();
  await expect(visitorPage.locator('canvas').first()).toBeVisible();
  expect(errors).toEqual([]);
  await visitor.close();
});

test('the first visit shows the studio tour, which can be skipped', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('bx-studio-tour'));
  await createDesign(page, 'E2E tour');
  const tour = page.getByRole('dialog', { name: /Three steps to a finished box/ });
  await expect(tour).toBeVisible();
  await tour.getByText('Skip tour', { exact: true }).click();
  await expect(tour).toBeHidden();
});
