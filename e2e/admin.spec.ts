import type { Page } from '@playwright/test';
import { test, expect, allowPageErrors, latestEmailTo } from './support/fixtures';
import { siteEnv } from './support/env';
import { ADMIN_STATE, TEST_USER, USER_STATE } from './support/user';

const DESIGN_NAME = 'E2E admin design';
let designId = '';

// A saved design for the test user, so the admin lists have something in them.
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: USER_STATE });
  const preview = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const state = {
    version: 1, templateId: 'reverse-tuck-carton', layoutVersion: 5,
    dimensions: { width: 60, height: 120, depth: 40, thickness: 0.5 },
    material: 'Kraft', opening: 0, measurementUnit: 'mm', artworkByPanel: {}, outsideArtworkLayers: [], insideArtworkLayers: [], mediaAssets: [],
    outsideColorMode: 'material', insideColorMode: 'material', outsideCustomColor: '#ffffff', insideCustomColor: '#ffffff',
  };
  const response = await context.request.post('/api/projects', { data: { name: DESIGN_NAME, state, preview } });
  expect(response.ok(), await response.text()).toBe(true);
  designId = (await response.json()).project.id;
  await context.close();
});

test('the admin area needs the password', async ({ page }) => {
  // Without the password the admin pages show the site's 404 page: nothing
  // says they exist. (The admin pages stream, so the HTTP status is 200.)
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'A box left unopened.' })).toBeVisible();
  await expect(page.locator('.admin-main')).toHaveCount(0);

  await page.goto('/admin?login=true');
  allowPageErrors(page, /401 \(Unauthorized\).*\/api\/admin\/login/);
  await page.locator('#admin-password').fill('wrong password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').or(page.locator('.admin-error')).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeHidden();
});

test.describe('signed in', () => {
  // global.setup.ts signs in once: admin sign-in is rate limited.
  test.use({ storageState: ADMIN_STATE });

  async function openAdmin(page: Page, path = '/admin') {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('.admin-main h1').first(), path).toBeVisible();
  }

  test('users: the list, and a user\'s popup with their designs and a preview link', async ({ page }) => {
    await openAdmin(page, '/admin/users');
    const row = page.getByRole('row').filter({ hasText: TEST_USER.email });
    await expect(row).toBeVisible();
    await row.getByRole('link').first().click();
    const drawer = page.locator('.admin-drawer');
    await expect(drawer.getByRole('heading', { name: TEST_USER.name })).toBeVisible();
    await expect(page).toHaveURL(/view=/);
    const card = drawer.locator('.admin-design-cards li').filter({ hasText: DESIGN_NAME }).first();
    await expect(card).toBeVisible();
    const preview = card.getByRole('link', { name: `Preview ${DESIGN_NAME} in 3D` });
    await expect(preview).toHaveAttribute('target', '_blank');
    expect((await page.request.get((await preview.getAttribute('href'))!)).status()).toBe(200);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/view=/);
  });

  test('Pro access: given in the user popup, it lets that account brand its share links', async ({ page, browser }) => {
    const user = await browser.newContext({ storageState: USER_STATE });
    const shared = await user.request.post('/api/shares', { data: { projectId: designId } });
    expect(shared.ok(), await shared.text()).toBe(true);
    const shareId = (await shared.json()).share.id;
    const brand = () => user.request.patch(`/api/shares/${shareId}`, { data: { brandName: 'Acme Packaging' } });
    expect((await brand()).status()).toBe(403);

    await openAdmin(page, '/admin/users');
    await page.getByRole('row').filter({ hasText: TEST_USER.email }).getByRole('link').first().click();
    const drawer = page.locator('.admin-drawer');
    await drawer.getByRole('button', { name: 'Give Pro access' }).click();
    await expect(drawer.getByText(/^Pro since /)).toBeVisible();
    const branded = await brand();
    expect(branded.status()).toBe(200);
    expect((await branded.json()).settings.brandName).toBe('Acme Packaging');

    await drawer.getByRole('button', { name: 'Remove Pro access' }).click();
    await expect(drawer.getByRole('button', { name: 'Give Pro access' })).toBeVisible();
    expect((await brand()).status()).toBe(403);
    await user.close();
  });

  test('emails: every template previews under Templates, and a test lands in the admin inbox', async ({ page }) => {
    await openAdmin(page, '/admin/emails?tab=templates');
    for (const label of ['Welcome', 'Welcome follow-up · no design yet', 'Welcome follow-up · has a design', 'Email verification', 'Password reset']) {
      await expect(page.getByRole('button', { name: new RegExp(`^${label}`) }).first()).toBeVisible();
    }
    await page.getByRole('button', { name: /^Welcome follow-up · has a design/ }).click();
    await expect(page.frameLocator('iframe.admin-template-preview').getByText('Share it')).toBeVisible();
    await page.getByRole('button', { name: 'Send a test to me' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Sent to' })).toBeVisible();
    const email = await latestEmailTo(siteEnv.ADMIN_EMAIL, /^\[Test\] Your box design/);
    expect(email.subject).toBe('[Test] Your box design: share it and export it');
  });

  test('designs and search find the design and its owner', async ({ page }) => {
    await openAdmin(page, '/admin/designs');
    await expect(page.getByRole('row').filter({ hasText: DESIGN_NAME }).first()).toBeVisible();
    await openAdmin(page, '/admin/search?q=e2e-tester');
    await expect(page.getByRole('link', { name: new RegExp(TEST_USER.name) }).first()).toBeVisible();
    await openAdmin(page, `/admin/search?q=${encodeURIComponent(DESIGN_NAME)}`);
    await expect(page.getByRole('link', { name: new RegExp(DESIGN_NAME) }).first()).toBeVisible();
  });

  test('a contact message reaches the admin inbox and the contacts page', async ({ page }) => {
    const subject = `E2E question ${Date.now()}`;
    await page.goto('/contact');
    const form = page.locator('#contact-form');
    await form.locator('input[name="name"]').fill('E2E Visitor');
    await form.locator('input[name="email"]').fill('visitor@e2e.test');
    await form.locator('#contact-subject').fill(subject);
    await form.locator('textarea[name="message"]').fill('Hello from the browser tests. This message is long enough.');
    await form.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Message sent' })).toBeVisible();

    const email = await latestEmailTo(siteEnv.ADMIN_EMAIL, new RegExp(subject));
    expect(email.html).toContain('visitor@e2e.test');

    await openAdmin(page, '/admin/contacts');
    await expect(page.getByText(subject).first()).toBeVisible();
  });

  test('the dashboard and every admin page load', async ({ page }) => {
    await openAdmin(page);
    for (const path of ['/admin/emails?tab=templates', '/admin/users', '/admin/designs', '/admin/media', '/admin/contacts', '/admin/feedback', '/admin/emails', '/admin/campaigns', '/admin/settings', '/admin/search']) {
      await openAdmin(page, path);
    }
  });
});
