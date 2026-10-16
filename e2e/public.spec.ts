import { test, expect, expectNoHorizontalScroll } from './support/fixtures';

// The marketing site: each page renders with no errors, a real title and
// one main heading.
const PAGES = ['/', '/box-templates', '/features', '/faq', '/contact', '/es', '/fr'];

for (const path of PAGES) {
  test(`${path} renders`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/3D Box Studio|Box/i);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}

test('a template page shows its dieline and opens it in the studio', async ({ page }) => {
  await page.goto('/box-templates');
  const first = page.locator('a[href^="/box-templates/"]').first();
  const href = await first.getAttribute('href');
  expect(href).toBeTruthy();
  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('a[href*="/studio"]').first()).toBeVisible();
});

test('robots.txt, the sitemap and llms.txt are served', async ({ request }) => {
  for (const path of ['/robots.txt', '/sitemap.xml', '/llms.txt']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect((await response.text()).length, path).toBeGreaterThan(20);
  }
});

test('an unknown page is a 404', async ({ page }) => {
  const response = await page.goto('/no-such-page-e2e');
  expect(response?.status()).toBe(404);
});

test('the box templates can be searched, together with the tag filters', async ({ page }) => {
  await page.goto('/box-templates');
  const cards = page.locator('.template-card');
  const total = await cards.count();
  expect(total).toBeGreaterThan(5);
  const search = page.getByRole('searchbox', { name: 'Search box templates' });

  await search.fill('pizza');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().getByRole('heading')).toContainText(/pizza/i);
  await expect(page.getByRole('status').filter({ hasText: 'of' })).toContainText(`1 of ${total} templates`);

  // Size presets are searchable too: "perfume" finds the tuck end cartons.
  await search.fill('perfume');
  await expect(cards.filter({ hasText: /reverse tuck end/i })).toHaveCount(1);

  await search.fill('no such box anywhere');
  await expect(cards).toHaveCount(0);
  await expect(page.getByText(/No template matches/)).toBeVisible();
  await page.getByRole('button', { name: 'Show all templates' }).click();
  await expect(search).toHaveValue('');
  await expect(cards).toHaveCount(total);
});
