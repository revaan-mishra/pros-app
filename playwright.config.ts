import { defineConfig } from '@playwright/test';

const baseURL = process.env.PROS_E2E_BASE_URL || 'http://127.0.0.1:5173';
const node = process.env.PROS_NODE || process.execPath;

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/*.emulator.test.ts',
  outputDir: './test-results',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    channel: process.env.PROS_BROWSER_CHANNEL || 'chrome',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'phone', use: { viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
  webServer: process.env.PROS_E2E_BASE_URL ? undefined : {
    command: `${node} node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
