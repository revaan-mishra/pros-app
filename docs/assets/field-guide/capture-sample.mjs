import { fileURLToPath } from 'node:url';
import { copyFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

process.env.VITE_REQUIRE_CLOUD = 'false';
const server = await createServer({
  logLevel: 'error',
  server: { host: '127.0.0.1', port: 0, strictPort: true },
});
const shots = [
  { file: 'today-sample.jpg', width: 1344, height: 806 },
  { file: 'today-mobile.jpg', width: 412, height: 740 },
  { file: 'world-atelier.jpg', width: 1344, height: 925, route: '/world?region=atelier', ready: '.atlas-page' },
];
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  const base = new URL(`http://127.0.0.1:${address.port}`);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const { file, width, height, route, ready = '.today-experience' } of shots) {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: 'reduce',
      colorScheme: 'dark',
      serviceWorkers: 'block',
    });
    await context.route('**/*', route => {
      return new URL(route.request().url()).origin === base.origin
        ? route.continue()
        : route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', error => console.error(error.message));
    await page.goto(base.href, { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Explore a sample world' }).click();
    await page.locator('.today-experience').waitFor();
    if (route) await page.goto(new URL(route, base).href);
    await page.locator(ready).waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})));
    });
    await page.screenshot({
      path: fileURLToPath(new URL(file, import.meta.url)),
      type: 'jpeg',
      quality: 88,
      animations: 'disabled',
    });
    if (file === 'today-mobile.jpg') {
      await copyFile(new URL(file, import.meta.url), new URL('../../../public/showcase/today.jpg', import.meta.url));
    }
    await context.close();
    console.log(`Captured ${file} at ${width}×${height} in a fresh sample profile.`);
  }
} finally {
  await browser?.close();
  await server.close();
}
