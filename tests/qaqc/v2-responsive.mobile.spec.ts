import { expect, test } from '@playwright/test';
import { attachQaScreenshot, loginAs } from './support/app';

test.describe('mobile smoke', () => {
  test('student home remains usable on a mobile viewport', async ({ page }, testInfo) => {
    await loginAs(page, 'student');

    await expect(page.locator('.phone')).toBeVisible();
    await expect(page.locator('.role-view')).toContainText('Misi hari ini');
    await attachQaScreenshot(page, testInfo, 'mobile-student-home');
  });
});
