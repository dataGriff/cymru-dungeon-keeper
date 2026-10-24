/**
 * Visual regression tests (task visual). They screenshot the built game in
 * its ?still mode and the style guide, and compare with the baselines in
 * tests/visual/__screenshots__. After a deliberate visual change, run
 * `task visual:update` and commit the new baselines with the change.
 */
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

export default defineConfig({
  testDir: 'tests/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]] : 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1180, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    contextOptions: { reducedMotion: 'reduce' },
    launchOptions: {
      // The same text rasterisation on every machine: greyscale, unhinted (tests/visual/fonts.conf).
      env: { ...process.env, FONTCONFIG_FILE: resolve('tests/visual/fonts.conf') },
      args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning', '--disable-lcd-text'],
    },
  },
  expect: {
    // Small anti-aliasing differences between machines pass; a moved pixel of art does not.
    toHaveScreenshot: { maxDiffPixelRatio: 0.003, threshold: 0.15, animations: 'disabled', caret: 'hide' },
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env['CI'],
  },
});
