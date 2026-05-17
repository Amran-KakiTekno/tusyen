import { expect, test } from '@playwright/test';
import { expectApiHealthy } from './support/app';
import { createQaActors, uniqueRunId, visibleRunSuffix } from './support/api';

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

  test('rate-limits classroom join-by-code attempts from one client', async ({ request }) => {
    const runId = uniqueRunId('rate');
    const suffix = visibleRunSuffix(runId);
    const qa = await createQaActors(request, runId);
    const classroom = await qa.teacher.api.postJson<{
      classroom: { id: string; joinCode: string };
    }>('/api/classroom', {
      name: `Kelas Had Join ${suffix}`,
      subject: `Matematik ${suffix}`,
      formLevel: 4,
    });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await qa.student.api.post('/api/classroom/join-by-code', {
        data: { joinCode: classroom.classroom.joinCode },
      });
      statuses.push(response.status());
    }

    const firstLimitedAttempt = statuses.indexOf(429);
    expect(firstLimitedAttempt).not.toBe(-1);
    expect([0, 10]).toContain(firstLimitedAttempt);
    if (firstLimitedAttempt === 10) {
      expect(statuses.slice(0, 10)).not.toContain(429);
    }
    expect(statuses.slice(firstLimitedAttempt).every(status => status === 429)).toBe(true);
  });
});
