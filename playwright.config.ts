import { defineConfig, devices } from '@playwright/test';

// Browser tests: a real browser against the production build (`npm run
// build` first), with the database, S3 and email replaced by local
// stand-ins (e2e/support/services.mjs). Run with `npm run test:e2e`.

import { BASE_URL, DB_PORT, MAIL_PORT, PORT, S3_PORT, siteEnv } from './e2e/support/env';

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/e2e',
  // The studio is heavy: WebGL runs in software (SwiftShader) on CI machines.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    launchOptions: {
      // A locally installed Chromium, when Playwright's own download is not available.
      ...(process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {}),
      args: (process.env.E2E_CHROME_ARGS ?? '--enable-unsafe-swiftshader').split(' ').filter(Boolean),
    },
  },
  projects: [
    { name: 'setup', testMatch: /global\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, dependencies: ['setup'], testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'], testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'node e2e/support/services.mjs',
      env: { E2E_DB_PORT: String(DB_PORT), E2E_S3_PORT: String(S3_PORT), E2E_MAIL_PORT: String(MAIL_PORT) },
      wait: { stdout: /e2e services ready/ },
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npx next start -p ${PORT}`,
      url: `${BASE_URL}/robots.txt`,
      env: siteEnv,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
