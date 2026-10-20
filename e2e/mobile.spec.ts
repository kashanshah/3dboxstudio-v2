import { test, expect, expectNoHorizontalScroll } from './support/fixtures';
import { ADMIN_STATE, USER_STATE } from './support/user';

// On a phone every page fits the screen: no sideways scrolling.

for (const path of ['/', '/box-templates', '/features', '/faq', '/contact', '/login', '/signup', '/es/box-templates', '/es/box-templates/mailer-box', '/es/box-dieline-generator', '/es', '/zh']) {
  test(`${path} fits a phone screen`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
}

test.describe('signed in', () => {
  test.use({ storageState: USER_STATE });

  test('the studio workspace fits a phone screen', async ({ page }) => {
    await page.goto('/studio');
    await expect(page.getByRole('link', { name: /New box design/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

test.describe('admin', () => {
  test.use({ storageState: ADMIN_STATE });

  test('the admin pages and a user popup fit a phone screen', async ({ page }) => {
    for (const path of ['/admin', '/admin/users', '/admin/designs', '/admin/media', '/admin/contacts']) {
      await page.goto(path);
      await expect(page.locator('.admin-main h1').first()).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
    await page.goto('/admin/users');
    await page.getByRole('row').nth(1).getByRole('link').first().click();
    await expect(page.locator('.admin-drawer .admin-profile')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
