# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-switch.spec.ts >> language switching - student role >> student role keeps language updates across major surfaces and popups
- Location: tests\qaqc\language-switch.spec.ts:109:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('.language-toggle-icon').first()
    - locator resolved to <button type="button" title="Tukar bahasa" aria-label="Tukar bahasa kepada English" class="language-toggle language-toggle-icon">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    19 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Langkau ke kandungan utama" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e5]:
    - complementary "Bar sisi aplikasi" [ref=e6]:
      - generic [ref=e8]:
        - generic [ref=e9]: T
        - generic [ref=e10]: Tusyen
      - generic [ref=e11]:
        - generic [ref=e12]:
          - generic [ref=e13]: NA
          - generic [ref=e14]:
            - generic [ref=e15]: Nur Aisyah Rahman
            - generic [ref=e16]: student
        - generic [ref=e17]:
          - generic [ref=e18]: ⚡
          - text: Tahap 7
      - navigation "Navigasi utama" [ref=e19]:
        - button "Utama / Home" [ref=e20] [cursor=pointer]:
          - img [ref=e21]
          - generic [ref=e25]:
            - generic [ref=e26]: Utama
            - generic [ref=e27]: Home
        - button "Belajar / Learn" [ref=e29] [cursor=pointer]:
          - img [ref=e30]
          - generic [ref=e32]:
            - generic [ref=e33]: Belajar
            - generic [ref=e34]: Learn
        - button "Kelas / Classes" [ref=e35] [cursor=pointer]:
          - img [ref=e36]
          - generic [ref=e39]:
            - generic [ref=e40]: Kelas
            - generic [ref=e41]: Classes
        - button "Pos / Posts" [ref=e42] [cursor=pointer]:
          - img [ref=e43]
          - generic [ref=e46]:
            - generic [ref=e47]: Pos
            - generic [ref=e48]: Posts
        - button "Kemajuan / Progress" [ref=e49] [cursor=pointer]:
          - img [ref=e50]
          - generic [ref=e53]:
            - generic [ref=e54]: Kemajuan
            - generic [ref=e55]: Progress
        - button "Pelajaran / Lesson" [ref=e56] [cursor=pointer]:
          - img [ref=e57]
          - generic [ref=e60]:
            - generic [ref=e61]: Pelajaran
            - generic [ref=e62]: Lesson
        - button "Kuiz / Quiz" [ref=e63] [cursor=pointer]:
          - img [ref=e64]
          - generic [ref=e66]:
            - generic [ref=e67]: Kuiz
            - generic [ref=e68]: Quiz
        - button "Papan Putih / Whiteboard" [ref=e69] [cursor=pointer]:
          - img [ref=e70]
          - generic [ref=e73]:
            - generic [ref=e74]: Papan Putih
            - generic [ref=e75]: Whiteboard
        - button "Profil / Profile" [ref=e76] [cursor=pointer]:
          - img [ref=e77]
          - generic [ref=e80]:
            - generic [ref=e81]: Profil
            - generic [ref=e82]: Profile
      - generic [ref=e83]:
        - generic [ref=e84]:
          - generic [ref=e85]:
            - generic [ref=e86]: 🔥 1
            - generic [ref=e87]: Hari Streak
          - generic [ref=e88]:
            - generic [ref=e89]: ⚡ 1.7k
            - generic [ref=e90]: XP Total
        - group "Pilih tema warna" [ref=e91]:
          - button "Gelap" [ref=e92] [cursor=pointer]
          - button "Cerah" [pressed] [ref=e93] [cursor=pointer]
        - group "Pilih bahasa" [ref=e95]:
          - button "BM" [pressed] [ref=e96] [cursor=pointer]
          - button "EN" [ref=e97] [cursor=pointer]
        - button "Log keluar" [ref=e98] [cursor=pointer]: 🚪 Log Keluar
    - main "Utama" [ref=e99]:
      - generic [ref=e100]:
        - heading "Utama" [level=1] [ref=e101]
        - generic [ref=e102]:
          - generic [ref=e104]:
            - generic [ref=e105]: Selamat Malam
            - generic [ref=e106]: Nur 👋
          - generic [ref=e107]:
            - generic [ref=e108]:
              - generic [ref=e109]:
                - generic [ref=e110]: 🔥
                - generic [ref=e111]: "1"
              - generic [ref=e112]: Rentetan hari
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e115]: ⚡
                - generic [ref=e116]: 1,725
              - generic [ref=e117]: XP
            - generic [ref=e118]:
              - generic [ref=e119]:
                - generic [ref=e120]: 📚
                - generic [ref=e121]: "2"
              - generic [ref=e122]: Pelajaran
          - generic [ref=e123]: Nyawa digunakan sebagai penanda fokus latihan, bukan ukuran pencapaian akademik.
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]:
                - generic [ref=e127]: 🎯
                - generic [ref=e128]:
                  - generic [ref=e129]: Misi hari ini
                  - generic [ref=e130]: Sasaran 10 pelajaran
              - generic [ref=e131]: 2/10
            - progressbar [ref=e132]
            - generic [ref=e134]: 8 pelajaran lagi untuk Bonus XP.
          - generic [ref=e135] [cursor=pointer]:
            - generic [ref=e136]: ▶ Sambung seterusnya
            - generic [ref=e137]:
              - generic [ref=e138]: 🌿
              - generic [ref=e139]:
                - generic [ref=e140]: Mitosis dalam Sel
                - generic [ref=e141]: Pembahagian Sel
                - progressbar [ref=e142]
                - generic [ref=e144]: 85% siap
              - generic [ref=e145]: ›
          - generic [ref=e146]:
            - generic [ref=e147]:
              - generic [ref=e148]: Subjek
              - generic [ref=e149]:
                - button "🌿 Biologi Biology 85 85%" [ref=e150] [cursor=pointer]:
                  - generic [ref=e151]:
                    - generic [ref=e152]: 🌿
                    - generic [ref=e153]:
                      - generic [ref=e154]: Biologi
                      - generic [ref=e155]: Biology
                  - progressbar [ref=e156]
                  - generic [ref=e158]: 85%
                - button "⚡ Fizik Physics 0 Belum mula" [ref=e159] [cursor=pointer]:
                  - generic [ref=e160]:
                    - generic [ref=e161]: ⚡
                    - generic [ref=e162]:
                      - generic [ref=e163]: Fizik
                      - generic [ref=e164]: Physics
                  - progressbar [ref=e165]
                  - generic [ref=e166]: Belum mula
                - button "🧪 Kimia Chemistry 0 Belum mula" [ref=e167] [cursor=pointer]:
                  - generic [ref=e168]:
                    - generic [ref=e169]: 🧪
                    - generic [ref=e170]:
                      - generic [ref=e171]: Kimia
                      - generic [ref=e172]: Chemistry
                  - progressbar [ref=e173]
                  - generic [ref=e174]: Belum mula
                - button "📜 Sejarah Sejarah 0 Belum mula" [ref=e175] [cursor=pointer]:
                  - generic [ref=e176]:
                    - generic [ref=e177]: 📜
                    - generic [ref=e178]:
                      - generic [ref=e179]: Sejarah
                      - generic [ref=e180]: Sejarah
                  - progressbar [ref=e181]
                  - generic [ref=e182]: Belum mula
                - button "🌏 Geografi Geography 0 Belum mula" [ref=e183] [cursor=pointer]:
                  - generic [ref=e184]:
                    - generic [ref=e185]: 🌏
                    - generic [ref=e186]:
                      - generic [ref=e187]: Geografi
                      - generic [ref=e188]: Geography
                  - progressbar [ref=e189]
                  - generic [ref=e190]: Belum mula
                - button "📐 Matematik Mathematics 100 Selesai" [ref=e191] [cursor=pointer]:
                  - generic [ref=e192]:
                    - generic [ref=e193]: 📐
                    - generic [ref=e194]:
                      - generic [ref=e195]: Matematik
                      - generic [ref=e196]: Mathematics
                  - progressbar [ref=e197]
                  - generic [ref=e199]: Selesai
            - generic [ref=e200]:
              - generic [ref=e201]: 🏆 Ranking kelas
              - generic [ref=e203]:
                - generic [ref=e204]: 🥇
                - generic [ref=e205]: NA
                - generic [ref=e206]: Kamu
                - generic [ref=e207]: 1,725 XP
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
> 11  |     await iconToggle.click();
      |                      ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  12  |   } else {
  13  |     // Full toggle group: click the non-active language button
  14  |     const toggleGroup = page.locator('.language-toggle[role="group"]').first();
  15  |     const currentLang = await page.locator('html').getAttribute('data-language') ?? 'ms';
  16  |     const targetLabel = currentLang === 'ms' ? 'EN' : 'BM';
  17  |     await toggleGroup.locator(`button:has-text("${targetLabel}")`).click();
  18  |   }
  19  |   // Wait for html[data-language] to change
  20  |   const prevLang = await page.locator('html').getAttribute('data-language') ?? 'ms';
  21  |   await page.waitForFunction(
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
```