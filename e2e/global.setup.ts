import { test as setup } from '@playwright/test';
import { expect, latestEmailTo } from './support/fixtures';
import { ADMIN_PASSWORD } from './support/env';
import { ADMIN_STATE, TEST_USER, USER_STATE } from './support/user';

// Sign up the test user through the real sign-up form, confirm the
// verification email arrives and its link works, and keep the signed-in
// session for the other tests.
setup('sign up and verify the email address', async ({ page }) => {
  await page.goto('/signup');
  await page.getByLabel('Display name').fill(TEST_USER.name);
  await page.getByLabel('Email').fill(TEST_USER.email);
  await page.locator('#auth-password').fill(TEST_USER.password);
  await page.locator('#auth-confirm').fill(TEST_USER.password);
  await page.getByRole('button', { name: /Create account/i }).click();
  await expect(page.getByRole('link', { name: /Continue to studio/i })).toBeVisible();

  const email = await latestEmailTo(TEST_USER.email, /verify|confirm/i);
  const link = email.html.match(/href="([^"]*verify-email[^"]*)"/)?.[1]?.replaceAll('&amp;', '&');
  expect(link, 'a verification link in the email').toBeTruthy();
  await page.goto(new URL(link!).pathname + new URL(link!).search);
  const submit = page.getByRole('button', { name: /Verify email/i });
  if (await submit.isVisible().catch(() => false)) await submit.click();
  await expect(page.getByText(/verified/i).first()).toBeVisible();

  // The studio tour has its own test (studio.spec.ts); the other tests
  // start with it already seen.
  await page.evaluate(() => localStorage.setItem('bx-studio-tour', 'done'));
  await page.context().storageState({ path: USER_STATE });
});

// One admin sign-in for every admin test: sign-in is limited to five tries
// in 15 minutes.
setup('sign in to the admin area', async ({ page }) => {
  await page.goto('/admin?login=true');
  await page.locator('#admin-password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
