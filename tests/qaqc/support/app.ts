import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

export const demoUsers = {
  student: {
    email: 'student@tusyen.test',
    password: 'password123',
    homeText: 'Misi hari ini',
  },
  teacher: {
    email: 'teacher@tusyen.test',
    password: 'password123',
    homeText: 'Kelas Saya',
  },
  parent: {
    email: 'parent@tusyen.test',
    password: 'password123',
    homeText: 'Pemantauan',
  },
  admin: {
    email: 'admin@tusyen.test',
    password: 'password123',
    homeText: 'Panel Admin',
  },
} as const;

export type DemoRole = keyof typeof demoUsers;

export async function expectApiHealthy(request: APIRequestContext) {
  const response = await request.get('/api/health', { timeout: 10_000 });
  const body = await response.text();

  expect(
    response.ok(),
    `Expected /api/health to be reachable through Caddy. Response: ${body}`,
  ).toBeTruthy();

  const health = JSON.parse(body) as {
    status?: string;
    database?: string;
    redis?: string;
    timestamp?: string;
  };

  expect(health.database, 'database health').toBe('connected');
  expect(health.redis, 'redis health').toBe('connected');
  expect(health.timestamp, 'health timestamp').toBeTruthy();

  return health;
}

export async function gotoLogin(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('.login-card')).toBeVisible();
}

export async function loginAs(page: Page, role: DemoRole) {
  const user = demoUsers[role];

  await gotoLogin(page);
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.locator('button.login-submit').click();

  await expect(page.locator('.phone')).toBeVisible();
  await expect(page.locator('.role-view')).toContainText(user.homeText, { timeout: 15_000 });
}

export async function attachQaScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

export function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
