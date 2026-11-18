import { chromium } from '@playwright/test';
import { createServer } from 'vite';

process.env.VITE_REQUIRE_CLOUD = 'false';
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const base = new URL(`http://127.0.0.1:${address.port}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1344, height: 806 },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    serviceWorkers: 'block',
  });
  await context.route('**/*', (route) => {
    return new URL(route.request().url()).origin === base.origin
      ? route.continue()
      : route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', error => console.error(error.message));
  await page.goto(base.href, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Explore a sample world' }).click();
  await page.locator('.today-experience').waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
  });
  await page.screenshot({
    path: 'docs/assets/field-guide/today-sample.jpg',
    type: 'jpeg',
    quality: 88,
    animations: 'disabled',
  });
  console.log('Captured Today from a fresh browser profile in the sample world.');
} finally {
  await browser?.close();
  await server.close();
}
