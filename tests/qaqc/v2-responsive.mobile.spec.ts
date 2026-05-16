import { expect, test } from '@playwright/test';
import { attachQaScreenshot, loginToV2 } from './support/app';

test.describe('v2 mobile smoke', () => {
  test('student home remains usable on a mobile viewport', async ({ page }, testInfo) => {
    await loginToV2(page, 'student');

    await expect(page.locator('.phone')).toBeVisible();
    await expect(page.locator('.role-view')).toContainText('Misi Hari Ini');
    await attachQaScreenshot(page, testInfo, 'v2-mobile-student-home');
  });
});
