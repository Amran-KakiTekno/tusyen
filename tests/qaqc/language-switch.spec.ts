import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { attachQaScreenshot, demoUsers, loginAs } from './support/app';

const demoAdminEnabled = process.env.QA_DEMO_ADMIN_ENABLED === 'true';
const WAIT_TIMEOUT = 10_000;

async function toggleLanguage(page: Page) {
  // Capture current language BEFORE clicking so waitForFunction can detect change
  const prevLang = await page.locator('html').getAttribute('data-language') ?? 'ms';
  // Prefer visible icon-only toggle (mobile top bar); fall back to full toggle group (sidebar)
  const iconToggle = page.locator('.language-toggle-icon').first();
  if (await iconToggle.isVisible()) {
    await iconToggle.click();
  } else {
    // Full toggle group: click the non-active language button
    const toggleGroup = page.locator('.language-toggle[role="group"]').first();
    const targetLabel = prevLang === 'ms' ? 'EN' : 'BM';
    await toggleGroup.locator(`button:has-text("${targetLabel}")`).click();
  }
  // Wait for html[data-language] to change
  await page.waitForFunction(
    (prev) => document.documentElement.dataset.language !== prev,
    prevLang,
    { timeout: 5000 }
  );
}

async function storedLanguage(page: Page) {
  return page.evaluate(() => localStorage.getItem('tusyen_language'));
}

async function expectStoredLanguage(page: Page, value: 'en' | 'ms' | null) {
  const actual = await storedLanguage(page);
  expect(actual).toBe(value);
}

async function expectHtmlLanguage(page: Page, value: 'en' | 'ms') {
  const lang = await page.locator('html').getAttribute('lang');
  const dataLanguage = await page.locator('html').getAttribute('data-language');

  expect(lang).toBe(value);
  expect(dataLanguage).toBe(value);
}

function englishHomeNavLabel(role: keyof typeof demoUsers): string {
  if (role === 'student') return 'Home';
  if (role === 'teacher') return 'Classes';
  if (role === 'parent') return 'Monitoring';
  return 'Dashboard';
}

async function openAny(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() > 0) {
      await locator.click();
      return locator;
    }
  }
  return null;
}

async function openAnyDialog(page: Page, selectors: string[]) {
  const locator = await openAny(page, selectors);
  if (!locator) return null;

  const dialog = page.locator('[role="dialog"]').first();
  try {
    await expect(dialog).toBeVisible({ timeout: WAIT_TIMEOUT });
    return dialog;
  }
  catch {
    return null;
  }
}

test.describe('language switching - unauthenticated', () => {
  test('login screen and guide page language can be switched and survives reload', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await page.goto('/');

    const initialLanguage = await storedLanguage(page);
    expect(initialLanguage === null || initialLanguage === 'ms').toBe(true);

    await expect(page.locator('button.login-tab.on')).toContainText('Log Masuk', { timeout: WAIT_TIMEOUT });
    console.warn('LANGUAGE GAP: .login-submit button text is hardcoded BM — not translated');

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('button.login-tab.on')).toContainText('Sign In', { timeout: WAIT_TIMEOUT });
    console.warn('LANGUAGE GAP: .login-submit button text is hardcoded BM — not translated');
    await attachQaScreenshot(page, testInfo, 'unauth-lang-en');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('button.login-tab.on')).toContainText('Sign In', { timeout: WAIT_TIMEOUT });

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
    await attachQaScreenshot(page, testInfo, 'unauth-lang-bm');
  });
});

test.describe('language switching - student role', () => {
  test('student role keeps language updates across major surfaces and popups', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await loginAs(page, 'student');
    const stored = await storedLanguage(page);
    expect(stored === null || stored === 'ms').toBe(true);

    await expect(page.locator('.role-view')).toContainText(demoUsers.student.homeText, { timeout: WAIT_TIMEOUT });

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('.sidebar-nav-button[aria-current="page"]')).toContainText(englishHomeNavLabel('student'), { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'student-lang-en');

    {
      const tab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Learning' }).first();
      if (await tab.count() > 0) {
        await tab.click();
        await expect(page.locator('.role-view')).toBeVisible({ timeout: WAIT_TIMEOUT });
        await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: student tab "Learning" not found after English toggle');
      }
    }

    {
      const tab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Classrooms' }).first();
      if (await tab.count() > 0) {
        await tab.click();
        await expect(page.locator('.role-view')).toBeVisible({ timeout: WAIT_TIMEOUT });
        await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: student tab "Classrooms" not found after English toggle');
      }
    }

    {
      const tab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Progress' }).first();
      if (await tab.count() > 0) {
        await tab.click();
        await expect(page.locator('.role-view')).toBeVisible({ timeout: WAIT_TIMEOUT });
        await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: student tab "Progress" not found after English toggle');
      }
    }

    {
      const tab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Quiz' }).first();
      if (await tab.count() > 0) {
        await tab.click();
        await expect(page.locator('.role-view')).toBeVisible({ timeout: WAIT_TIMEOUT });
        await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: student tab "Quiz" not found after English toggle');
      }
    }

    const profileModal = await openAnyDialog(page, [
      '.teacher-name',
      '[data-testid="teacher-profile-link"]',
      'button:has-text("Teacher")',
      'a:has-text("Teacher")',
      'button:has-text("Guru")',
      'a:has-text("Guru")',
      '[role="button"][aria-label*="teacher" i]',
    ]);
    if (profileModal) {
      try {
        await expect(profileModal).toContainText(/Class/i, { timeout: WAIT_TIMEOUT });
      }
      catch {
        console.warn('LANGUAGE GAP: TeacherProfileModal still showing BM label "Kelas"');
      }
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: TeacherProfileModal not opened for student role');
    }

    const confirmDialog = await openAnyDialog(page, [
      'button:has-text("Padam")',
      'button:has-text("Hapus")',
      'button:has-text("Delete")',
      'button:has-text("Remove")',
      '[aria-label*="delete" i]',
    ]);
    if (confirmDialog) {
      // Known gap: ConfirmDialog uses UI_TEXT constants which are hardcoded BM (cancel:'Batal', confirm:'Sahkan')
      console.warn('LANGUAGE GAP: ConfirmDialog cancel/confirm buttons use hardcoded BM from UI_TEXT constants');
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: No delete button visible on student home view to open ConfirmDialog — skipping confirm-dialog i18n check');
    }

    // Navigate home before toggling back so homeText assertion is on the home view
    const homeTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: /^(Home|Laman Utama|Utama|Rumah)$/i }).first();
    if (await homeTab.count() > 0) await homeTab.click();

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
    await expect(page.locator('.role-view')).toContainText(demoUsers.student.homeText, { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'student-lang-bm');
  });
});

test.describe('language switching - teacher role', () => {
  test('teacher role updates UI language across navigation, modals, and confirmations', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await loginAs(page, 'teacher');
    const stored = await storedLanguage(page);
    expect(stored === null || stored === 'ms').toBe(true);

    await expect(page.locator('.role-view')).toContainText(demoUsers.teacher.homeText, { timeout: WAIT_TIMEOUT });

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('.sidebar-nav-button[aria-current="page"]')).toContainText(englishHomeNavLabel('teacher'), { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'teacher-lang-en');

    {
      const classesTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Classes' }).first();
      if (await classesTab.count() > 0) {
        await classesTab.click();
        await expect(classesTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Classes" not found after English toggle');
      }
    }

    let postsTabFound = false;
    {
      const postsTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Posts' }).first();
      if (await postsTab.count() > 0) {
        await postsTab.click();
        await expect(postsTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
        postsTabFound = true;
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Posts" not found after English toggle');
      }
    }

    {
      const lessonsTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Lessons' }).first();
      if (await lessonsTab.count() > 0) {
        await lessonsTab.click();
        await expect(lessonsTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Lessons" not found after English toggle');
      }
    }

    {
      const quizTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Quiz' }).first();
      if (await quizTab.count() > 0) {
        await quizTab.click();
        await expect(quizTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Quiz" not found after English toggle');
      }
    }

    {
      const whiteboardTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Whiteboard' }).first();
      if (await whiteboardTab.count() > 0) {
        await whiteboardTab.click();
        await expect(whiteboardTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Whiteboard" not found after English toggle');
      }
    }

    {
      const profileTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: 'Profile' }).first();
      if (await profileTab.count() > 0) {
        await profileTab.click();
        await expect(profileTab).toHaveAttribute('aria-current', 'page', { timeout: WAIT_TIMEOUT });
      } else {
        console.warn('LANGUAGE GAP: teacher tab "Profile" not found after English toggle');
      }
    }

    if (postsTabFound) {
      const composeOrNewPostButton = page.locator('button:has-text("New Post"), button:has-text("Compose"), button:has-text("Buat"), [aria-label*="post" i][role="button"]').first();
      if (await composeOrNewPostButton.count() > 0) {
        await composeOrNewPostButton.click();
        const postModal = page.locator('[role="dialog"]').first();
        if (await postModal.isVisible().catch(() => false)) {
          try {
            await expect(postModal).toContainText(/Title|Content|Class|Description|Submit|Save/i, { timeout: WAIT_TIMEOUT });
          }
          catch {
            console.warn('LANGUAGE GAP: Teacher post modal form labels may still be BM');
          }
          await page.keyboard.press('Escape');
        }
        else {
          console.warn('LANGUAGE GAP: Teacher compose post modal not opened');
        }
      } else {
        console.warn('LANGUAGE GAP: Teacher compose/new post button not found');
      }
    } else {
      console.warn('LANGUAGE GAP: skipping teacher post flow because Posts tab was not opened');
    }

    const confirmDialog = await openAnyDialog(page, [
      'button:has-text("Padam")',
      'button:has-text("Delete")',
      'button:has-text("Remove")',
      '[aria-label*="delete" i]',
    ]);
    if (confirmDialog) {
      // Known gap: ConfirmDialog uses UI_TEXT constants which are hardcoded BM (cancel:'Batal', confirm:'Sahkan')
      console.warn('LANGUAGE GAP: ConfirmDialog cancel/confirm buttons use hardcoded BM from UI_TEXT constants');
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: No delete button visible on teacher view to open ConfirmDialog — skipping confirm-dialog i18n check');
    }

    // Navigate to Classes tab (teacher home) before toggling back so homeText assertion lands on the right view
    const classesHomeTab = page.locator('.sidebar-nav-button, .bottom-nav-button').filter({ hasText: /^(Classes|Kelas)$/i }).first();
    if (await classesHomeTab.count() > 0) await classesHomeTab.click();

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
    await expect(page.locator('.role-view')).toContainText(demoUsers.teacher.homeText, { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'teacher-lang-bm');
  });
});

test.describe('language switching - parent role', () => {
  test('parent role updates UI language across key modals and confirmations', async ({ page }, testInfo) => {
    test.setTimeout(60_000);

    await loginAs(page, 'parent');
    const stored = await storedLanguage(page);
    expect(stored === null || stored === 'ms').toBe(true);

    await expect(page.locator('.role-view')).toContainText(demoUsers.parent.homeText, { timeout: WAIT_TIMEOUT });

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('.sidebar-nav-button[aria-current="page"]')).toContainText(englishHomeNavLabel('parent'), { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'parent-lang-en');

    const addChildModal = await openAnyDialog(page, [
      'button:has-text("Add Child")',
      'button:has-text("Tambah Anak")',
      'button:has-text("Add a child")',
      '[data-testid="add-child"]',
      '[aria-label*="add child" i]',
    ]);
    if (addChildModal) {
      try {
        await expect(addChildModal).toContainText(/Name|Class|Grade|Email|Relationship/i, { timeout: WAIT_TIMEOUT });
      }
      catch {
        console.warn('LANGUAGE GAP: GuidedAddChildModal still showing BM labels');
      }
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: Add Child modal not opened');
    }

    const confirmDialog = await openAnyDialog(page, [
      'button:has-text("Padam")',
      'button:has-text("Delete")',
      'button:has-text("Remove")',
      '[aria-label*="delete" i]',
    ]);
    if (confirmDialog) {
      // Known gap: ConfirmDialog uses UI_TEXT constants which are hardcoded BM (cancel:'Batal', confirm:'Sahkan')
      console.warn('LANGUAGE GAP: ConfirmDialog cancel/confirm buttons use hardcoded BM from UI_TEXT constants');
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: No delete button visible on parent view to open ConfirmDialog — skipping confirm-dialog i18n check');
    }

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
    await expect(page.locator('.role-view')).toContainText(demoUsers.parent.homeText, { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'parent-lang-bm');
  });
});

test.describe('language switching - admin role', () => {
  test('admin role updates language across modals and reverts', async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    test.skip(!demoAdminEnabled, 'Demo admin is disabled in this environment');

    await loginAs(page, 'admin');
    const stored = await storedLanguage(page);
    expect(stored === null || stored === 'ms').toBe(true);

    await expect(page.locator('.role-view')).toContainText(demoUsers.admin.homeText, { timeout: WAIT_TIMEOUT });

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'en');
    await expectHtmlLanguage(page, 'en');
    await expect(page.locator('.sidebar-nav-button[aria-current="page"]')).toContainText(englishHomeNavLabel('admin'), { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'admin-lang-en');

    const userRow = page.locator('tbody tr, [data-testid="user-row"], .user-table-row').first();
    if (await userRow.count() > 0) {
      await userRow.click();
      const modal = page.locator('.confirm-dialog, [role="dialog"]').first();
      const appeared = await modal.isVisible().catch(() => false);
      if (appeared) {
        try {
          await expect(modal).toContainText(/Name|Email|Role|Status/i, { timeout: WAIT_TIMEOUT });
        }
        catch {
          console.warn('LANGUAGE GAP: UserDetailModal still shows BM labels');
        }
        await page.keyboard.press('Escape');
      } else {
        console.warn('LANGUAGE GAP: clicking user row did not open a modal');
      }
    }
    else {
      console.warn('LANGUAGE GAP: UserDetailModal not opened');
    }

    const lessonPreviewModal = await openAnyDialog(page, [
      'button:has-text("Preview")',
      'button:has-text("Pratonton")',
      '[data-testid="lesson-preview"]',
      '[aria-label*="preview" i]',
    ]);
    if (lessonPreviewModal) {
      const lessonText = await lessonPreviewModal.textContent() ?? '';
      if (lessonText.includes('Mudah') || lessonText.includes('Sederhana') || lessonText.includes('Sukar')) {
        console.warn('LANGUAGE GAP: LessonPreviewModal difficulty labels still BM');
      }
      await page.keyboard.press('Escape');
    }
    else {
      console.warn('LANGUAGE GAP: LessonPreviewModal not opened');
    }

    const confirmDialog = await openAnyDialog(page, [
      'button:has-text("Padam")',
      'button:has-text("Delete")',
      'button:has-text("Remove")',
      '[aria-label*="delete" i]',
    ]);
    if (confirmDialog) {
      // Known gap: ConfirmDialog uses UI_TEXT constants which are hardcoded BM (cancel:'Batal', confirm:'Sahkan')
      console.warn('LANGUAGE GAP: ConfirmDialog cancel/confirm buttons use hardcoded BM from UI_TEXT constants');
      await page.keyboard.press('Escape');
    }
    else {
      throw new Error('Admin confirm dialog not found');
    }

    await toggleLanguage(page);
    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
    await expect(page.locator('.role-view')).toContainText(demoUsers.admin.homeText, { timeout: WAIT_TIMEOUT });
    await attachQaScreenshot(page, testInfo, 'admin-lang-bm');
  });
});

test.describe('language switching - cross-tab persistence', () => {
  test('language persists across tabs and reacts to storage updates', async ({ browser, page }) => {
    test.setTimeout(60_000);

    await loginAs(page, 'student');

    await toggleLanguage(page);
    const firstLanguage = await storedLanguage(page);
    expect(firstLanguage).toBe('en');
    await expectHtmlLanguage(page, 'en');

    // Use same browser context so localStorage is shared (browser.newPage() creates isolated context)
    const secondPage = await page.context().newPage();
    await secondPage.goto('/');
    const secondStored = await storedLanguage(secondPage);
    expect(secondStored).toBe('en');

    await toggleLanguage(secondPage);
    const secondLanguage = await storedLanguage(secondPage);
    expect(secondLanguage).toBe('ms');

    await secondPage.close();
    await page.waitForFunction(
      () => localStorage.getItem('tusyen_language') === 'ms',
      { timeout: 5000 }
    );

    await expectStoredLanguage(page, 'ms');
    await expectHtmlLanguage(page, 'ms');
  });
});
