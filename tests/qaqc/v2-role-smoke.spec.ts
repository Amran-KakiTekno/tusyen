import { expect, test } from '@playwright/test';
import { attachQaScreenshot, demoUsers, loginToV2, type DemoRole } from './support/app';

const roles = Object.keys(demoUsers) as DemoRole[];

test.describe('v2 role smoke', () => {
  for (const role of roles) {
    test(`${role} demo account can sign in and render its home view`, async ({ page }, testInfo) => {
      await loginToV2(page, role);

      await attachQaScreenshot(page, testInfo, `v2-${role}-home`);
    });
  }

  test('demo account can switch between all role previews', async ({ page }, testInfo) => {
    await loginToV2(page, 'student');

    const roleExpectations = [
      { label: 'Guru', text: demoUsers.teacher.homeText },
      { label: 'Ibu Bapa', text: demoUsers.parent.homeText },
      { label: 'Admin', text: demoUsers.admin.homeText },
      { label: 'Pelajar', text: demoUsers.student.homeText },
    ];

    for (const roleView of roleExpectations) {
      await page.locator('.roles .role-btn').filter({ hasText: roleView.label }).click();
      await expect(page.locator('.role-view')).toContainText(roleView.text, { timeout: 15_000 });
    }

    await attachQaScreenshot(page, testInfo, 'v2-role-switching');
  });
});
