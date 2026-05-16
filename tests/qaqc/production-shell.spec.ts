import { expect, test } from '@playwright/test';
import { attachQaScreenshot, collectPageErrors } from './support/app';

test.describe('production Flutter web shell', () => {
  test('loads the root web app without a blank shell', async ({ page }, testInfo) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/eduapp|Tusyen/i);
    await page.waitForSelector('flt-glass-pane, flutter-view, canvas', { timeout: 30_000 });
    await expect(page.locator('body')).toBeVisible();

    await attachQaScreenshot(page, testInfo, 'flutter-root-shell');
    expect(pageErrors, 'uncaught browser errors').toEqual([]);
  });
});
