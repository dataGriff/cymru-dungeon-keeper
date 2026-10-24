/**
 * The game and the style guide, pixel for pixel. The game runs in ?still
 * mode (seed 1, the sim run to a fixed moment, a fixed clock, no motion);
 * the style guide renders once on a fixed clock.
 */
import { type Page, expect, test } from '@playwright/test';

/** A fresh profile: the installer has run, nothing else remembered. */
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('annwn.installed.v1', '1');
  });
});

async function openGame(page: Page, query: string): Promise<void> {
  await page.goto(`/?${query}`);
  await page.locator('canvas.board').waitFor();
  await page.evaluate(() => document.fonts.ready);
  // A few frames, so the board, HUD and manual have drawn the held moment.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
}

test.describe('the game', () => {
  test('the whole page at the start of the Cairn', async ({ page }) => {
    await openGame(page, 'start=cairn&still=0');
    await expect(page).toHaveScreenshot('game-start.png', { fullPage: true });
  });

  for (const theme of ['hall', 'contrast', 'hunt']) {
    test(`the board mid-wave, ${theme}`, async ({ page }) => {
      await openGame(page, `start=cairn&still=50&theme=${theme}`);
      await expect(page.locator('.board-wrap')).toHaveScreenshot(`board-wave-${theme}.png`);
      await expect(page.locator('.hud')).toHaveScreenshot(`hud-${theme}.png`);
    });
  }

  test('a phone, 360px at 2x', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('annwn.installed.v1', '1'));
    const page = await context.newPage();
    await openGame(page, 'start=cairn&still=0');
    await expect(page).toHaveScreenshot('game-phone.png');
    await context.close();
  });
});

test.describe('the style guide', () => {
  const sections = ['colour', 'type', 'buttons', 'hud', 'manual', 'scene', 'figures', 'tiles', 'pixels'];
  for (const theme of ['hall', 'contrast', 'hunt']) {
    test(`every section, ${theme}`, async ({ page }) => {
      await page.goto(`/styleguide.html?theme=${theme}`);
      await page.locator('body[data-ready]').waitFor();
      const which = theme === 'hall' ? sections : ['colour', 'buttons', 'scene'];
      for (const id of which) await expect(page.locator(`#${id}`)).toHaveScreenshot(`styleguide-${theme}-${id}.png`);
    });
  }
});
