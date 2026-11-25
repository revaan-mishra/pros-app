import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type SavedEntity = { id: string; deleted?: boolean; [key: string]: unknown };

async function records(page: Page, kind: string): Promise<SavedEntity[]> {
  return page.evaluate(async (recordKind) => {
    const account = localStorage.getItem('pros.activeProfile');
    return new Promise<SavedEntity[]>((resolve, reject) => {
      const open = indexedDB.open('pros-local-v1');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('records', 'readonly');
        const request = tx.objectStore('records').getAll();
        request.onsuccess = () => resolve(request.result.filter(row => row.accountId === account && row.kind === recordKind).map(row => row.data));
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      };
    });
  }, kind);
}

async function createProfile(page: Page, name = 'Rowan') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Begin your journey' }).click();
  await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: 'Find your paths' }).click();
  await page.getByRole('button', { name: 'Choose a first project' }).click();
  await page.getByLabel('Your first project').fill('A small website worth finishing');
  await page.getByRole('button', { name: 'Step into your world' }).click();
  await expect(page.getByRole('heading', { name: `Welcome home, ${name.split(' ')[0]}.`, exact: true })).toBeVisible();
  await expect.poll(async () => (await records(page, 'profile'))[0]?.displayName).toBe(name);
  // Allow starter equipment normalization and the first local snapshot to settle.
  await page.waitForTimeout(250);
}

async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore a sample world' }).click();
  await expect(page.getByRole('heading', { name: /Welcome home,.*Alex/ })).toBeVisible();
  await page.waitForTimeout(250);
}

async function logActivity(page: Page, title: string, minutes = 25) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Log activity', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('spinbutton', { name: 'Minutes' }).fill(String(minutes));
  await dialog.getByText('Title, date and project', { exact: true }).click();
  await dialog.getByLabel('What did you do?').fill(title);
  await dialog.getByRole('button', { name: 'Record activity', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await records(page, 'activities')).filter(a => !a.deleted && a.title === title).length).toBe(1);
}

async function openFromHeader(page: Page, name: string) {
  const more = page.getByRole('button', { name: 'More', exact: true });
  const phone = await more.isVisible();
  if (phone) await more.click();
  const label = phone && name === 'Help and guided tour' ? 'Help & guided tour' : name;
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function noHorizontalOverflow(page: Page) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
}

test('the public install guide works before an account and offers manual steps on every device', async ({ page }) => {
  await page.goto('/?install=1');
  const guide = page.getByRole('dialog', { name: 'Install PROS', exact: true });
  await expect(guide).toBeVisible();
  await guide.getByRole('button', { name: 'Android', exact: true }).click();
  await expect(guide.getByRole('region', { name: 'Install on Android' })).toContainText('Install and create shortcut');
  await expect(guide.getByRole('link', { name: 'Android APK and checksum' })).toHaveAttribute('href', 'https://github.com/revaan-mishra/pros-app/releases');
  await guide.getByRole('button', { name: 'iPhone & iPad', exact: true }).click();
  await expect(guide.getByRole('link', { name: 'Android APK and checksum' })).toHaveCount(0);
  await expect(guide.getByRole('region', { name: /Install on iPhone/ })).toContainText('Add to Home Screen');
  await guide.getByRole('button', { name: 'Computer', exact: true }).click();
  await expect(guide.getByRole('region', { name: 'Install on Computer' })).toContainText('Add to Dock');
  await noHorizontalOverflow(page);
  const scan = await new AxeBuilder({ page }).include('.install-sheet').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(scan.violations.filter(violation => violation.impact === 'critical' || violation.impact === 'serious')).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('pros.activeProfile'))).toBeNull();
  await guide.getByRole('button', { name: 'Keep using the browser' }).click();
  await expect(guide).not.toBeVisible();
  await expect(page).not.toHaveURL(/install=1/);
  const trigger = page.getByRole('button', { name: 'Install PROS', exact: true });
  await trigger.click();
  await expect(guide).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(guide).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('an offered system install prompt is optional and can fall back to the browser menu', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The browser install event is Chromium-specific.');
  await page.goto('/?install=1');
  const guide = page.getByRole('dialog', { name: 'Install PROS', exact: true });
  await guide.getByRole('button', { name: 'Computer', exact: true }).click();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperty(event, 'prompt', { value: async () => ({ outcome: 'dismissed' }) });
    window.dispatchEvent(event);
  });
  await guide.getByRole('button', { name: 'Install on this device', exact: true }).click();
  await expect(guide.getByRole('status').filter({ hasText: 'install later' })).toBeVisible();
  await expect(guide.getByRole('button', { name: 'Install on this device', exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  await expect(guide.getByText('PROS is installed.', { exact: true })).toBeVisible();
  await guide.getByRole('button', { name: 'Back to PROS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Explore a sample world' })).toBeVisible();
});

test('onboarding creates a private local profile and survives reload', async ({ page }) => {
  await createProfile(page);
  const profile = (await records(page, 'profile'))[0];
  expect(profile.displayName).toBe('Rowan');
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  expect((await records(page, 'projects')).filter(a => !a.deleted)).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome home,.*Rowan/ })).toBeVisible();
  await noHorizontalOverflow(page);
});

test('the sample world has working destinations and leaves real play empty', async ({ page }) => {
  await enterDemo(page);
  const demoCount = (await records(page, 'activities')).filter(a => !a.deleted).length;
  expect(demoCount).toBeGreaterThan(5);
  const routes = [
    ['/quests', 'Give the work a direction'],
    ['/skills', 'A little more capable.'],
    ['/world', 'A world with your work in it.'],
    ['/character', 'A portrait of your practice.'],
    ['/journal', 'Your story, in your words'],
    ['/library', 'Ideas worth carrying.'],
    ['/insights', 'See how far you’ve come.'],
    ['/history', 'Every little chapter.'],
    ['/settings', 'Your app, your way.'],
  ];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, title] of routes) {
    await page.goto(route);
    if (title) await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
    else await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    await expect(page.getByText('Let’s find your place again.')).not.toBeVisible();
  }
  expect(errors).toEqual([]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create your world' }).click();
  await createProfile(page, 'Mira');
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  expect((await records(page, 'profile'))[0].displayName).toBe('Mira');
});

test('logging, editing and undo use the same saved activity', async ({ page }) => {
  await createProfile(page);
  await logActivity(page, 'A deliberate practice', 25);
  await page.goto('/history');
  await page.getByRole('button', { name: 'Edit A deliberate practice', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Minutes' }).fill('15');
  await dialog.getByRole('button', { name: 'Save correction' }).click();
  await expect.poll(async () => (await records(page, 'activities')).find(a => a.title === 'A deliberate practice')?.seconds).toBe(900);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await records(page, 'activities')).find(a => a.title === 'A deliberate practice')?.seconds).toBe(1500);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A deliberate practice', exact: true })).toBeVisible();
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(1);
});

test('quest completion awards no duplicated effort and can be reopened', async ({ page }) => {
  await createProfile(page);
  await page.goto('/quests');
  await page.getByRole('button', { name: 'New quest', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Next action', { exact: true }).fill('Read one useful page');
  await dialog.getByRole('button', { name: 'Save quest' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Complete Read one useful page', exact: true }).click();
  await expect.poll(async () => (await records(page, 'quests')).find(q => q.title === 'Read one useful page')?.status).toBe('completed');
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  const filters = page.getByRole('button', { name: 'Filters', exact: true });
  const useSheet = await filters.isVisible();
  if (useSheet) await filters.click();
  await page.getByRole('button', { name: 'Completed', exact: true }).click();
  if (useSheet) await page.getByRole('button', { name: 'Show quests' }).click();
  await page.getByRole('button', { name: 'Reopen Read one useful page', exact: true }).click();
  await expect.poll(async () => (await records(page, 'quests')).find(q => q.title === 'Read one useful page')?.status).toBe('pending');
});

test('focus survives reload and only awards time after confirmation', async ({ page }) => {
  await createProfile(page);
  await page.goto('/focus');
  await page.getByRole('button', { name: 'Start focus', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Record activity' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await records(page, 'focusSessions')).find(s => s.status === 'completed')?.status).toBe('completed');
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(1);
});

test('journal drafts, books and outcomes survive real user flows', async ({ page }) => {
  await createProfile(page);
  await page.goto('/journal');
  await page.getByRole('button', { name: 'New entry' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('A useful beginning');
  await dialog.getByLabel('Your words').fill('I made time for one thing that mattered.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'New entry' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Your words')).toHaveValue('I made time for one thing that mattered.');
  await dialog.getByRole('button', { name: 'Save entry' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'A useful beginning' })).toBeVisible();
  await page.goto('/library');
  await page.getByRole('button', { name: 'Add a book', exact: true }).first().click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title', { exact: true }).fill('The Art of Paying Attention');
  await dialog.getByLabel('Author', { exact: true }).fill('A. Reader');
  await dialog.getByLabel('Total pages (optional)').fill('80');
  await dialog.getByRole('button', { name: 'Save book' }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await page.getByRole('button', { name: 'Mark finished' }).click();
  await expect.poll(async () => (await records(page, 'books')).find(b => b.title === 'The Art of Paying Attention')?.status).toBe('completed');
  expect((await records(page, 'outputs')).filter(o => !o.deleted)).toHaveLength(1);
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  await page.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect.poll(async () => (await records(page, 'books')).find(b => b.title === 'The Art of Paying Attention')?.status).toBe('reading');
});

test('portable backup export/import previews changes and keeps data', async ({ page }) => {
  await createProfile(page);
  await logActivity(page, 'Practice worth keeping', 15);
  await page.goto('/settings?section=data');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^PROS-backup-.*\.json$/);
  const file = await download.path();
  expect(file).toBeTruthy();
  await page.getByLabel('Choose PROS backup').setInputFiles(file!);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Review your backup' })).toBeVisible();
  for (const select of await dialog.getByRole('combobox').all()) await select.selectOption('keep-local');
  await dialog.getByRole('button', { name: 'Import records' }).click();
  await expect(dialog).not.toBeVisible();
  expect((await records(page, 'activities')).filter(a => !a.deleted && a.title === 'Practice worth keeping')).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your app, your way.' })).toBeVisible();
});

test('earned landmarks and equipment re-lock together after a factual correction', async ({ page }) => {
  await createProfile(page);
  await logActivity(page, 'The first hour in the foundry', 60);
  await page.goto('/world?region=foundry');
  await page.getByRole('button', { name: 'Record output', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Finished result', { exact: true }).fill('A small accessible page');
  await dialog.getByRole('button', { name: 'Record output' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('1 / 18 restored')).toBeVisible();
  await page.goto('/character?view=wardrobe');
  await expect(page.getByText('Available', { exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Preview Ember Emblem', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Currently saved appearance')).toBeVisible();
  await dialog.getByRole('button', { name: 'Equip this piece', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => ((await records(page, 'profile'))[0].equipment as Record<string,string>)?.emblem).toBe('foundry-emblem');
  await page.goto('/history');
  await page.getByRole('button', { name: 'Edit The first hour in the foundry', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton', { name: 'Minutes' }).fill('15');
  await expect(dialog.getByText(/This correction will re-lock/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Save correction' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => ((await records(page, 'profile'))[0].equipment as Record<string,string>)?.emblem).toBe('');
  await page.goto('/world?region=foundry');
  await expect(page.getByText('0 / 18 restored')).toBeVisible();
  await page.goto('/character?view=wardrobe');
  await expect(page.getByText('Available', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Preview Ember Emblem', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Preview only · locked', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Equip this piece' })).toHaveCount(0);
});

test('offline edits persist locally and resume without fake sync claims', async ({ page, context }) => {
  await createProfile(page);
  await page.getByRole('button', { name: 'Log activity', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await context.setOffline(true);
  await dialog.getByRole('spinbutton', { name: 'Minutes' }).fill('5');
  await dialog.getByText('Title, date and project', { exact: true }).click();
  await dialog.getByLabel('What did you do?').fill('An offline practice');
  await dialog.getByRole('button', { name: 'Record activity' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(async () => (await records(page, 'activities')).find(a => a.title === 'An offline practice')?.seconds).toBe(300);
  await context.setOffline(false);
  await page.reload();
  expect((await records(page, 'activities')).filter(a => !a.deleted && a.title === 'An offline practice')).toHaveLength(1);
});

test('core screens have no serious accessibility violations and fit the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createProfile(page);
  for (const route of ['/', '/quests', '/skills', '/world', '/character', '/settings']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await noHorizontalOverflow(page);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const important = scan.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    expect(important.map(v => ({ id: v.id, description: v.description, elements: v.nodes.map(n => n.target) }))).toEqual([]);
  }
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Log activity', exact: true })).toBeVisible();
  await page.keyboard.press('l');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('installed production shell reloads offline with saved progress', async ({ page, context }) => {
  test.skip(!process.env.PROS_E2E_PRODUCTION, 'Service-worker verification requires a production preview.');
  test.setTimeout(80_000);
  await page.goto('/?install=1');
  const guide = page.getByRole('dialog', { name: 'Install PROS', exact: true });
  await expect(guide.getByText('Ready offline.', { exact: true })).toBeVisible({ timeout: 45_000 });
  await guide.getByRole('button', { name: 'Keep using the browser' }).click();
  await enterDemo(page);
  await logActivity(page, 'Ready for a quiet offline day', 5);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Welcome home,.*Alex/ })).toBeVisible();
  expect((await records(page, 'activities')).filter(a => !a.deleted && a.title === 'Ready for a quiet offline day')).toHaveLength(1);
  await openFromHeader(page, 'Help and guided tour');
  await expect(page.getByText(/^Ready offline\./)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Install PROS', exact: true }).click();
  await expect(guide.getByText('Ready offline.', { exact: true })).toBeVisible();
  await guide.getByRole('button', { name: 'Keep using the browser' }).click();
  await expect(guide).not.toBeVisible();
});

test('guided tour is optional, routed, and never manufactures progress', async ({ page }) => {
  await createProfile(page, 'Tour reader');
  const beforeQuests = await records(page, 'quests');
  await page.getByRole('button', { name: 'Show me around', exact: true }).click();
  for (let step = 0; step < 2; step++) {
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Make it your own', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page).toHaveURL(/\/world(?:\?.*)?$/);
  expect((await records(page, 'activities')).filter(a => !a.deleted)).toHaveLength(0);
  expect((await records(page, 'outputs')).filter(a => !a.deleted)).toHaveLength(0);
  expect(await records(page, 'quests')).toEqual(beforeQuests);
  await openFromHeader(page, 'Help and guided tour');
  await page.getByRole('button', { name: 'Open the full reference guide', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your story starts with what you do.', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('sound choices stay silent until explicitly played and persist with the profile',async({page})=>{
  await createProfile(page,'Quiet reader');
  await openFromHeader(page, 'Soundtrack library');
  let dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:/Quiet focus/}).click();
  await dialog.getByRole('combobox',{name:'Score',exact:true}).selectOption('woodlands');
  await dialog.getByRole('button',{name:'Save choices',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Play selected sound',exact:true})).toBeVisible();
  await expect(dialog.getByText('Sound is off',{exact:true})).toBeVisible();
  expect(await page.locator('audio').count()).toBe(0);
  await dialog.getByRole('button',{name:'Close dialog',exact:true}).click();
  const more = page.getByRole('button', { name: 'More', exact: true });
  if (await more.isVisible()) await more.click();
  await expect(page.getByRole('button',{name:'Play selected sound',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.reload();
  await openFromHeader(page, 'Soundtrack library');
  dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('combobox',{name:'Score',exact:true})).toHaveValue('woodlands');
  await expect(dialog.getByText('Sound is off',{exact:true})).toBeVisible();
});


test.describe('phone workflows', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'phone', 'Touch viewport checks run in the phone project.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('finished results keep their title width and the Library caption fits on a narrow phone', async ({ page }) => {
    await enterDemo(page);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 780 });
      await page.goto('/outputs');
      const record = page.locator('.output-record').first();
      const title = await record.getByRole('heading', { level: 2 }).boundingBox();
      const actions = await record.getByRole('button', { name: 'Correct' }).boundingBox();
      const card = await record.boundingBox();
      expect(title!.width).toBeGreaterThanOrEqual(card!.width * .8);
      expect(actions!.y).toBeGreaterThan(title!.y + title!.height);
      await noHorizontalOverflow(page);

      await page.goto('/library');
      const scene = page.getByRole('region', { name: 'The Archive' });
      const caption = await scene.getByText('A book finished. An idea kept. A useful thought you can return to.').boundingBox();
      const frame = await scene.boundingBox();
      expect(caption!.y + caption!.height).toBeLessThanOrEqual(frame!.y + frame!.height);
      await noHorizontalOverflow(page);
    }
  });

  test('the opening actions and five full-size tabs fit portrait and landscape', async ({ page }) => {
    await enterDemo(page);
    for (const viewport of [
      { width: 320, height: 568 }, { width: 390, height: 844 },
      { width: 430, height: 932 }, { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport);
      const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
      await expect(nav).toBeInViewport({ ratio: 1 });
      await expect(nav.getByRole('link')).toHaveCount(5);
      await expect(nav.getByRole('link', { name: 'Today', exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
      for (const link of await nav.getByRole('link').all()) {
        const box = await link.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        expect(box?.width).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByRole('button', { name: 'Log activity', exact: true })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Start focus', exact: true })).toBeInViewport({ ratio: 1 });
      await noHorizontalOverflow(page);
    }
  });

  test('a short phone can log in three taps and undo exactly one activity', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await enterDemo(page);
    const before = (await records(page, 'activities')).filter(a => !a.deleted).length;
    await page.getByRole('button', { name: 'Log activity', exact: true }).tap();
    const sheet = page.getByRole('dialog', { name: 'Log activity' });
    const preset = sheet.getByRole('button', { name: '15 min', exact: true });
    const save = sheet.getByRole('button', { name: 'Record activity' });
    await expect(preset).toBeInViewport({ ratio: 1 });
    await expect(save).toBeInViewport({ ratio: 1 });
    await preset.tap();
    await save.tap();
    await expect(sheet).not.toBeVisible();
    await expect.poll(async () => (await records(page, 'activities')).filter(a => !a.deleted).length).toBe(before + 1);
    await expect(page.getByRole('button', { name: 'Log activity', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Undo', exact: true }).tap();
    await expect.poll(async () => (await records(page, 'activities')).filter(a => !a.deleted).length).toBe(before);
  });

  test('tab return remembers filters, scroll and the originating view for details', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);
    const nav = page.getByRole('navigation', { name: 'Mobile navigation' });
    const quests = nav.getByRole('link', { name: 'Quests', exact: true });
    const skills = nav.getByRole('link', { name: 'Skills', exact: true });
    const today = nav.getByRole('link', { name: 'Today', exact: true });
    await quests.tap();
    await page.getByRole('button', { name: 'Filters', exact: true }).tap();
    const filters = page.getByRole('dialog', { name: 'Quest filters' });
    await filters.getByRole('button', { name: 'Completed', exact: true }).tap();
    await filters.getByRole('button', { name: 'Show quests', exact: true }).tap();
    await skills.tap();
    await quests.tap();
    await expect(page).toHaveURL(/view=completed/);
    await expect(page.getByRole('heading', { name: 'Completed steps' })).toBeVisible();

    await skills.tap();
    await page.getByRole('button', { name: 'Library', exact: true }).tap();
    const cards = page.locator('.skill-card-title');
    await expect(cards).toHaveCount(12);
    await page.getByRole('button', { name: /Show 12 more/ }).tap();
    const link = cards.nth(13);
    await link.scrollIntoViewIfNeeded();
    const scroller = page.locator('#main-content');
    const position = await scroller.evaluate(el => el.scrollTop);
    expect(position).toBeGreaterThan(200);
    await today.tap();
    await skills.tap();
    await expect.poll(async () => scroller.evaluate(el => el.scrollTop)).toBeCloseTo(position, 0);
    await expect(link).toBeInViewport();
    await link.tap();
    await page.getByRole('link', { name: 'Back to Skills', exact: true }).tap();
    await expect(page).toHaveURL(/skills\?.*view=all.*shown=24/);
    await expect(link).toBeInViewport();
    const detailHref = await link.getAttribute('href');
    await page.goto(detailHref!);
    await expect(page.getByRole('link', { name: 'Back to Skills', exact: true })).toHaveAttribute('href', '/skills');
  });

  test('secondary destinations and regional picker remain reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);
    for (const [name, path] of [
      ['Journal', '/journal'], ['Chronicle', '/chronicle'], ['Library', '/library'],
      ['Insights', '/insights'], ['Activity history', '/history'], ['Settings', '/settings'],
    ]) {
      await page.getByRole('button', { name: 'More', exact: true }).tap();
      await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name, exact: true }).tap();
      await expect(page).toHaveURL(new RegExp(path + '$'));
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'World' }).tap();
    const region = page.getByRole('button', { name: /Change region/ });
    await region.tap();
    const picker = page.getByRole('dialog', { name: 'Choose a region' });
    await expect(picker.getByRole('button', { name: 'Close dialog' })).toBeVisible();
    await expect(picker.getByRole('navigation').getByRole('button')).toHaveCount(6);
    await picker.getByRole('button', { name: /Foundry/ }).tap();
    await expect(page).toHaveURL(/region=foundry/);
    await expect(region).toBeFocused();
    await expect(page.getByRole('complementary', { name: 'Foundry requirements and actions' })).toBeVisible();
  });

  test('activity save stays in a shortened visual viewport and an open draft survives rotation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterDemo(page);
    await page.getByRole('button', { name: 'Log activity', exact: true }).tap();
    const sheet = page.getByRole('dialog', { name: 'Log activity' });
    await sheet.getByText('Title, date and project', { exact: true }).tap();
    const title = sheet.getByLabel('What did you do?');
    await title.fill('A draft written on the phone');
    const save = sheet.getByRole('button', { name: 'Record activity' });
    // Model the viewport bounds while a keyboard is present. Native keyboard behavior is a device check.
    await page.evaluate(() => {
      const viewport = window.visualViewport!;
      Object.defineProperty(viewport, 'height', { value: 420, configurable: true });
      viewport.dispatchEvent(new Event('resize'));
    });
    await expect.poll(async () => (await save.boundingBox())!.y + (await save.boundingBox())!.height).toBeLessThanOrEqual(420);
    await expect(title).toBeFocused();
    await page.evaluate(() => {
      const viewport = window.visualViewport!;
      Reflect.deleteProperty(viewport, 'height');
      viewport.dispatchEvent(new Event('resize'));
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(title).toHaveValue('A draft written on the phone');
    await expect(save).toBeInViewport({ ratio: 1 });
    await sheet.getByRole('button', { name: 'Close dialog' }).tap();
    await expect(sheet).not.toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Log activity', exact: true }).tap();
    await sheet.getByText('Title, date and project', { exact: true }).tap();
    await expect(title).toHaveValue('A draft written on the phone');
  });
});
