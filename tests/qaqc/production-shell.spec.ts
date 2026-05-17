import { expect, test } from '@playwright/test';
import { attachQaScreenshot, collectPageErrors } from './support/app';

test.describe('production web shell', () => {
  test('loads the root React app without a blank shell', async ({ page }, testInfo) => {
    const pageErrors = collectPageErrors(page);

    await page.goto('/');
    await expect(page).toHaveTitle(/eduapp|Tusyen/i);
    await expect(page.locator('#root')).not.toBeEmpty();
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('.login-demo')).not.toContainText('Admin');

    await attachQaScreenshot(page, testInfo, 'react-root-shell');
    expect(pageErrors, 'uncaught browser errors').toEqual([]);
  });
});
