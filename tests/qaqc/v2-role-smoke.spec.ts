import { expect, test } from '@playwright/test';
import { attachQaScreenshot, demoUsers, loginAs, type DemoRole } from './support/app';

const demoAdminEnabled = process.env.QA_DEMO_ADMIN_ENABLED === 'true';
const roles = (Object.keys(demoUsers) as DemoRole[])
  .filter((role) => demoAdminEnabled || role !== 'admin');

test.describe('role smoke', () => {
  for (const role of roles) {
    test(`${role} demo account can sign in and render its home view`, async ({ page }, testInfo) => {
      await loginAs(page, role);

      await attachQaScreenshot(page, testInfo, `${role}-home`);
    });
  }

  test('role navigation does not expose demo-only role switching by default', async ({ page }, testInfo) => {
    await loginAs(page, 'student');

    await expect(page.locator('.role-switcher')).toHaveCount(0);
    await expect(page.locator('.roles .role-btn')).toHaveCount(0);
    await expect(page.locator('.role-view')).toContainText(demoUsers.student.homeText);

    await attachQaScreenshot(page, testInfo, 'role-navigation-no-demo-controls');
  });

  test('student home and learning surfaces expose complete subject and progress states', async ({ page }) => {
    const streakCheck = page.waitForResponse(
      response => response.url().includes('/api/progress/streak/check') && response.request().method() === 'POST',
      { timeout: 15_000 },
    );

    await loginAs(page, 'student');
    await streakCheck;

    await expect(page.locator('.role-view')).toContainText('Geografi');
    await expect(page.locator('.role-view')).toContainText('Kamu');

    await page.getByRole('button', { name: 'Belajar' }).first().click();
    await page.getByRole('button', { name: /Geografi/ }).click();

    await expect(page.locator('.role-view')).toContainText('Semasa');
    await expect(page.locator('.role-view')).toContainText('Terkunci');
  });
});
