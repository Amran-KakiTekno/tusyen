# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-switch.spec.ts >> language switching - unauthenticated >> login screen and guide page language can be switched and survives reload
- Location: tests\qaqc\language-switch.spec.ts:78:7

# Error details

```
TimeoutError: page.waitForFunction: Timeout 5000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - main "Learn with Tusyen" [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7]: T
        - generic [ref=e8]:
          - generic [ref=e9]: Tusyen Online
          - heading "Learn with Tusyen" [level=1] [ref=e10]
        - group "Choose language" [ref=e12]:
          - button "BM" [ref=e13] [cursor=pointer]
          - button "EN" [active] [pressed] [ref=e14] [cursor=pointer]
      - status [ref=e15]: API healthy · DB connected
      - link "View User Guide" [ref=e16] [cursor=pointer]:
        - /url: http://localhost/?guide=1
      - generic [ref=e17]:
        - button "Sign In" [ref=e18] [cursor=pointer]
        - button "Register" [ref=e19] [cursor=pointer]
      - generic [ref=e20]:
        - generic [ref=e21]:
          - text: Email
          - textbox "Email" [ref=e22]
        - generic [ref=e23]:
          - text: Password
          - textbox "Password" [ref=e24]
        - button "Sign In" [ref=e25] [cursor=pointer]
      - generic [ref=e26]:
        - generic [ref=e27]: "Demo accounts (password: password123)"
        - generic [ref=e28]:
          - button "Student demo account" [ref=e29] [cursor=pointer]: 🎓 Student
          - button "Teacher demo account" [ref=e30] [cursor=pointer]: 👨‍🏫 Teacher
          - button "Parent demo account" [ref=e31] [cursor=pointer]: 👪 Parent
```

# Test source

```ts
  1   | import { expect, test, type Page, type TestInfo } from '@playwright/test';
  2   | import { attachQaScreenshot, demoUsers, loginAs } from './support/app';
  3   | 
  4   | const demoAdminEnabled = process.env.QA_DEMO_ADMIN_ENABLED === 'true';
  5   | const WAIT_TIMEOUT = 10_000;
  6   | 
  7   | async function toggleLanguage(page: Page) {
  8   |   // Try icon-only toggle first (top app bar on mobile layout)
  9   |   const iconToggle = page.locator('.language-toggle-icon').first();
  10  |   if (await iconToggle.count() > 0) {
  11  |     await iconToggle.click();
  12  |   } else {
  13  |     // Full toggle group: click the non-active language button
  14  |     const toggleGroup = page.locator('.language-toggle[role="group"]').first();
  15  |     const currentLang = await page.locator('html').getAttribute('data-language') ?? 'ms';
  16  |     const targetLabel = currentLang === 'ms' ? 'EN' : 'BM';
  17  |     await toggleGroup.locator(`button:has-text("${targetLabel}")`).click();
  18  |   }
  19  |   // Wait for html[data-language] to change
  20  |   const prevLang = await page.locator('html').getAttribute('data-language') ?? 'ms';
> 21  |   await page.waitForFunction(
      |              ^ TimeoutError: page.waitForFunction: Timeout 5000ms exceeded.
  22  |     (prev) => document.documentElement.dataset.language !== prev,
  23  |     prevLang,
  24  |     { timeout: 5000 }
  25  |   );
  26  | }
  27  | 
  28  | async function storedLanguage(page: Page) {
  29  |   return page.evaluate(() => localStorage.getItem('tusyen_language'));
  30  | }
  31  | 
  32  | async function expectStoredLanguage(page: Page, value: 'en' | 'ms' | null) {
  33  |   const actual = await storedLanguage(page);
  34  |   expect(actual).toBe(value);
  35  | }
  36  | 
  37  | async function expectHtmlLanguage(page: Page, value: 'en' | 'ms') {
  38  |   const lang = await page.locator('html').getAttribute('lang');
  39  |   const dataLanguage = await page.locator('html').getAttribute('data-language');
  40  | 
  41  |   expect(lang).toBe(value);
  42  |   expect(dataLanguage).toBe(value);
  43  | }
  44  | 
  45  | function englishHomeNavLabel(role: keyof typeof demoUsers): string {
  46  |   if (role === 'student') return 'Home';
  47  |   if (role === 'teacher') return 'Classes';
  48  |   if (role === 'parent') return 'Monitoring';
  49  |   return 'Dashboard';
  50  | }
  51  | 
  52  | async function openAny(page: Page, selectors: string[]) {
  53  |   for (const selector of selectors) {
  54  |     const locator = page.locator(selector).first();
  55  |     if (await locator.count() > 0) {
  56  |       await locator.click();
  57  |       return locator;
  58  |     }
  59  |   }
  60  |   return null;
  61  | }
  62  | 
  63  | async function openAnyDialog(page: Page, selectors: string[]) {
  64  |   const locator = await openAny(page, selectors);
  65  |   if (!locator) return null;
  66  | 
  67  |   const dialog = page.locator('[role="dialog"]').first();
  68  |   try {
  69  |     await expect(dialog).toBeVisible({ timeout: WAIT_TIMEOUT });
  70  |     return dialog;
  71  |   }
  72  |   catch {
  73  |     return null;
  74  |   }
  75  | }
  76  | 
  77  | test.describe('language switching - unauthenticated', () => {
  78  |   test('login screen and guide page language can be switched and survives reload', async ({ page }, testInfo) => {
  79  |     test.setTimeout(60_000);
  80  | 
  81  |     await page.goto('/');
  82  | 
  83  |     const initialLanguage = await storedLanguage(page);
  84  |     expect(initialLanguage === null || initialLanguage === 'ms').toBe(true);
  85  | 
  86  |     await expect(page.locator('button.login-tab.on')).toContainText('Log Masuk', { timeout: WAIT_TIMEOUT });
  87  |     console.warn('LANGUAGE GAP: .login-submit button text is hardcoded BM — not translated');
  88  | 
  89  |     await toggleLanguage(page);
  90  |     await expectStoredLanguage(page, 'en');
  91  |     await expectHtmlLanguage(page, 'en');
  92  |     await expect(page.locator('button.login-tab.on')).toContainText('Sign In', { timeout: WAIT_TIMEOUT });
  93  |     console.warn('LANGUAGE GAP: .login-submit button text is hardcoded BM — not translated');
  94  |     await attachQaScreenshot(page, testInfo, 'unauth-lang-en');
  95  | 
  96  |     await page.reload({ waitUntil: 'domcontentloaded' });
  97  |     await expectStoredLanguage(page, 'en');
  98  |     await expectHtmlLanguage(page, 'en');
  99  |     await expect(page.locator('button.login-tab.on')).toContainText('Sign In', { timeout: WAIT_TIMEOUT });
  100 | 
  101 |     await toggleLanguage(page);
  102 |     await expectStoredLanguage(page, 'ms');
  103 |     await expectHtmlLanguage(page, 'ms');
  104 |     await attachQaScreenshot(page, testInfo, 'unauth-lang-bm');
  105 |   });
  106 | });
  107 | 
  108 | test.describe('language switching - student role', () => {
  109 |   test('student role keeps language updates across major surfaces and popups', async ({ page }, testInfo) => {
  110 |     test.setTimeout(60_000);
  111 | 
  112 |     await loginAs(page, 'student');
  113 |     const stored = await storedLanguage(page);
  114 |     expect(stored === null || stored === 'ms').toBe(true);
  115 | 
  116 |     await expect(page.locator('.role-view')).toContainText(demoUsers.student.homeText, { timeout: WAIT_TIMEOUT });
  117 | 
  118 |     await toggleLanguage(page);
  119 |     await expectStoredLanguage(page, 'en');
  120 |     await expectHtmlLanguage(page, 'en');
  121 |     await expect(page.locator('.sidebar-nav-button[aria-current="page"]')).toContainText(englishHomeNavLabel('student'), { timeout: WAIT_TIMEOUT });
```