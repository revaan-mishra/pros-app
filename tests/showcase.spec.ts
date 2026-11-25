import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the showcase restoration opens only after practice and a result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/about.html#atelier');
  const practice = page.getByRole('checkbox', { name: 'Add 25 minutes of practice' });
  const recording = page.getByRole('checkbox', { name: 'Keep a finished recording' });
  const readout = page.getByRole('status');
  await expect(readout).toContainText('35 of 60 minutes');
  await recording.focus();
  await page.keyboard.press('Space');
  await expect(readout).toContainText('Finished results 1 of 1');
  await expect(page.locator('#room')).toHaveText('The waiting room');

  await practice.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('progressbar')).toHaveJSProperty('value', 60);
  await expect(readout).toContainText('Practice room open');
  await expect(page.locator('#room')).toHaveText('The practice room');
  await expect(page.locator('#restoration img')).toHaveCSS('transition-duration', '0s');

  await recording.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#room')).toHaveText('The waiting room');
  expect(await page.evaluate(() => localStorage.getItem('pros.activeProfile'))).toBeNull();
});

test('public pages work at the reference viewport and expose their main content to keyboard users', async ({ page, browserName }, info) => {
  if (info.project.name === 'phone') await page.setViewportSize({ width: 320, height: 568 });
  for (const [route, heading] of [
    ['/about.html', 'A world that keeps what you finish.'],
    ['/support.html', 'How can we help?'],
    ['/privacy.html', 'Your data in PROS'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(scan.violations.filter(item => ['serious', 'critical'].includes(item.impact || ''))).toEqual([]);
    await expect.poll(() => page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(images.map(image => {
        image.loading = 'eager';
        return image.decode().catch(() => {});
      }));
      return images.filter(image => !image.naturalWidth).length;
    })).toBe(0);
  }
});
