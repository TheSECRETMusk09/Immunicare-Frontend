/**
 * Playwright Configuration for Guardian Dashboard Mobile Testing
 * Comprehensive mobile UI testing across standard device breakpoints
 *
 * @see https://playwright.dev/docs/test-configuration
 */
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e/tests',
  outputDir: './e2e/test-results',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: './e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: './e2e/test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },

  projects: [
    // ===== MOBILE VIEWPORTS (320px - 480px) =====
    {
      name: 'Mobile - iPhone SE (320x568)',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: 'Mobile - iPhone 12/13 Mini (375x812)',
      use: {
        ...devices['iPhone 12 Mini'],
        viewport: { width: 375, height: 812 },
      },
    },
    {
      name: 'Mobile - iPhone 12/13/14 (390x844)',
      use: {
        ...devices['iPhone 12'],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'Mobile - Samsung Galaxy S23 (360x780)',
      use: {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        viewport: { width: 360, height: 780 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile - Google Pixel 7 (412x915)',
      use: {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      },
    },

    // ===== TABLET VIEWPORTS (768px - 1024px) =====
    {
      name: 'Tablet - iPad Mini (768x1024)',
      use: {
        ...devices['iPad Mini'],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'Tablet - iPad Air (820x1180)',
      use: {
        ...devices['iPad Air'],
        viewport: { width: 820, height: 1180 },
      },
    },

    // ===== CROSS-BROWSER MOBILE TESTING =====
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 14'],
        browserName: 'webkit',
      },
    },

    // ===== ACCESSIBILITY TESTING =====
    {
      name: 'Mobile - Accessibility',
      use: {
        ...devices['iPhone 12'],
      },
      grep: /@a11y/,
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
