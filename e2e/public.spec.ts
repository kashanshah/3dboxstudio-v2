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

test('the Spanish template pages and generator are in Spanish and linked both ways', async ({ page }) => {
  await page.goto('/es/box-templates');
  await expect(page.getByRole('heading', { level: 1, name: 'Plantillas de cajas gratis' })).toBeVisible();
  await page.getByRole('link', { name: /^Caja postal autoarmable/ }).first().click();

  await expect(page).toHaveURL(/\/es\/box-templates\/mailer-box$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Plantilla de caja postal autoarmable' })).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/box-templates\/mailer-box$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/es\/box-templates\/mailer-box$/);
  // The generator speaks Spanish, and a preset still redraws the box.
  await expect(page.getByRole('heading', { name: 'Haz el troquel de tu caja postal autoarmable' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Descargar PDF/ })).toBeVisible();
  await page.getByRole('button', { name: 'Set de cosmética' }).click();
  await expect(page.getByRole('button', { name: 'Set de cosmética' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('link', { name: 'Abrir en 3D Box Studio' })).toHaveAttribute('href', /\/studio\/editor\?template=mailer-box/);

  // The language switcher goes to the same page in English, which points back to the Spanish one.
  await page.locator('.marketing-header .language-switcher summary').click();
  await page.locator('.marketing-header .language-switcher').getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/box-templates\/mailer-box$/);
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute('href', /\/es\/box-templates\/mailer-box$/);
  await expect(page.getByRole('link', { name: 'Leer en español' })).toBeVisible();

  await page.goto('/es/box-dieline-generator');
  await expect(page.getByRole('heading', { level: 1, name: 'Generador de troqueles de cajas gratis' })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Caja americana de envío/ })).toBeVisible();
});

test('every page has the same header and footer, with every language', async ({ page }) => {
  for (const path of ['/', '/es', '/fr', '/zh', '/features', '/box-templates', '/box-templates/mailer-box', '/es/box-templates/mailer-box', '/es/box-dieline-generator', '/faq', '/blog']) {
    await page.goto(path);
    await expect(page.locator('header.marketing-header'), path).toHaveCount(1);
    await expect(page.locator('header.marketing-header .language-switcher'), path).toHaveCount(1);
    await expect(page.locator('footer.marketing-footer'), path).toHaveCount(1);
    await expect(page.locator('footer.marketing-footer .marketing-footer-languages a'), path).toHaveCount(7);
    await expect(page.locator('footer.marketing-footer .marketing-footer-links > div'), path).toHaveCount(4);
  }
  // A translated page's header and footer are in its language, and the switcher marks it.
  await page.goto('/fr');
  await expect(page.locator('header.marketing-header').getByRole('link', { name: 'Ouvrir le Studio' }).first()).toBeVisible();
  await expect(page.locator('.marketing-footer-languages a[aria-current="page"]')).toHaveText('Français');
  await expect(page.locator('.marketing-footer-languages a', { hasText: 'English' })).toHaveAttribute('href', '/');
  // An English page with a Spanish version links straight to it; one without links to the Spanish home page.
  await page.goto('/box-templates/mailer-box');
  await expect(page.locator('.marketing-footer-languages a', { hasText: 'Español (España)' })).toHaveAttribute('href', '/es/box-templates/mailer-box');
  await page.goto('/faq');
  await expect(page.locator('.marketing-footer-languages a', { hasText: 'Español (España)' })).toHaveAttribute('href', '/es');
});

test('the header has the same four items in every language, with menus for Features and Tools', async ({ page }) => {
  for (const [path, names] of [
    ['/', ['Features', 'Tools', 'Guides', 'FAQ']],
    ['/fr', ['Fonctionnalités', 'Outils', 'Guides', 'FAQ']],
    ['/es/box-templates/mailer-box', ['Funciones', 'Herramientas', 'Guías', 'Preguntas']],
  ] as const) {
    await page.goto(path);
    const nav = page.locator('.marketing-nav-links');
    await expect(nav.locator(':scope > a, :scope > .marketing-nav-menu > button'), path).toHaveText([...names]);
  }
  await page.goto('/');
  const nav = page.locator('.marketing-nav-links');
  const tools = nav.getByRole('button', { name: 'Tools' });
  await tools.click();
  await expect(tools).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(tools).toHaveAttribute('aria-expanded', 'false');
  await tools.click();
  await nav.getByRole('link', { name: 'Box dieline generator' }).click();
  await expect(page).toHaveURL(/\/box-dieline-generator$/);
  await nav.getByRole('button', { name: 'Features' }).click();
  await expect(nav.getByRole('link', { name: 'What’s new' })).toBeVisible();
});

test('the box sizes page is in the Tools menu and finds the standard box a product fits', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('.marketing-nav-links');
  await nav.getByRole('button', { name: 'Tools' }).click();
  await nav.getByRole('link', { name: 'Standard box sizes' }).click();
  await expect(page).toHaveURL(/\/box-sizes$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Standard box sizes' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Medium box 18 × 18 × 16 45\.7 × 45\.7 × 40\.6/ })).toBeVisible();

  // 7 × 5 × 3 in with 20 mm of cushioning on each side: the 10 × 8 × 6 in carton is the closest fit.
  const finder = page.getByRole('region', { name: 'Find a standard box that fits' });
  await finder.getByLabel('Length in in').fill('7');
  await finder.getByLabel('Width in in').fill('5');
  await finder.getByLabel('Height in in').fill('3');
  await finder.getByRole('radio', { name: 'Cushioned' }).click();
  const first = finder.locator('.bsc-styles a').first();
  await expect(first).toContainText('10 × 8 × 6 in');
  await expect(finder.getByText('8.57 × 6.57 × 4.57 in')).toBeVisible();
  await first.click();
  await expect(page).toHaveURL(/\/box-templates\/split-top-box\?style=shipping-box-rsc&l=10&w=8&d=6&u=in&mode=inner$/);
});

test('the box size calculator is in the Tools menu and the sitemap', async ({ page, request }) => {
  await page.goto('/');
  const nav = page.locator('.marketing-nav-links');
  await nav.getByRole('button', { name: 'Tools' }).click();
  await nav.getByRole('link', { name: 'Box size calculator' }).click();
  await expect(page).toHaveURL(/\/box-size-calculator$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Box size calculator' })).toBeVisible();
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/box-size-calculator</loc>');
  expect(sitemap).toContain('/box-sizes</loc>');
});
