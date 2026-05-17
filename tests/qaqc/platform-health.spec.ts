import { expect, test } from '@playwright/test';
import { expectApiHealthy } from './support/app';

test.describe('platform health', () => {
  test('serves API health through the Caddy /api proxy', async ({ request }) => {
    const health = await expectApiHealthy(request);

    expect(health.status, 'overall health').toBe('healthy');
  });

  test('serves the React web app', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Tusyen/i);
    await expect(page.locator('.login-card')).toBeVisible();
    await expect(page.locator('.login-submit')).toBeVisible();
  });
});
