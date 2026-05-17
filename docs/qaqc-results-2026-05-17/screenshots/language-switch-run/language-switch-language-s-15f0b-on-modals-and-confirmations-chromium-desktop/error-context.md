# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-switch.spec.ts >> language switching - teacher role >> teacher role updates UI language across navigation, modals, and confirmations
- Location: tests\qaqc\language-switch.spec.ts:215:7

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
      - generic [ref=e12]:
        - generic [ref=e13]: CF
        - generic [ref=e14]:
          - generic [ref=e15]: Cikgu Farah Aziz
          - generic [ref=e16]: teacher
      - navigation "Navigasi utama" [ref=e17]:
        - button "Kelas / Classes" [ref=e18] [cursor=pointer]:
          - img [ref=e19]
          - generic [ref=e22]:
            - generic [ref=e23]: Kelas
            - generic [ref=e24]: Classes
        - button "Pos / Posts" [ref=e26] [cursor=pointer]:
          - img [ref=e27]
          - generic [ref=e30]:
            - generic [ref=e31]: Pos
            - generic [ref=e32]: Posts
        - button "Pelajaran / Lessons" [ref=e33] [cursor=pointer]:
          - img [ref=e34]
          - generic [ref=e37]:
            - generic [ref=e38]: Pelajaran
            - generic [ref=e39]: Lessons
        - button "Kuiz / Quiz" [ref=e40] [cursor=pointer]:
          - img [ref=e41]
          - generic [ref=e43]:
            - generic [ref=e44]: Kuiz
            - generic [ref=e45]: Quiz
        - button "Papan Putih / Whiteboard" [ref=e46] [cursor=pointer]:
          - img [ref=e47]
          - generic [ref=e50]:
            - generic [ref=e51]: Papan Putih
            - generic [ref=e52]: Whiteboard
        - button "Profil / Profile" [ref=e53] [cursor=pointer]:
          - img [ref=e54]
          - generic [ref=e57]:
            - generic [ref=e58]: Profil
            - generic [ref=e59]: Profile
      - generic [ref=e60]:
        - group "Pilih tema warna" [ref=e61]:
          - button "Gelap" [ref=e62] [cursor=pointer]
          - button "Cerah" [pressed] [ref=e63] [cursor=pointer]
        - group "Pilih bahasa" [ref=e65]:
          - button "BM" [pressed] [ref=e66] [cursor=pointer]
          - button "EN" [ref=e67] [cursor=pointer]
        - generic [ref=e68]:
          - generic [ref=e69]:
            - generic [ref=e70]: "3"
            - generic [ref=e71]: Kelas
          - generic [ref=e72]:
            - generic [ref=e73]: "3"
            - generic [ref=e74]: Pelajar
        - button "Log keluar" [ref=e75] [cursor=pointer]: 🚪 Log Keluar
    - main "Kelas Saya / My Classes" [ref=e76]:
      - generic [ref=e77]:
        - heading "Kelas Saya / My Classes" [level=1] [ref=e78]
        - generic [ref=e79]:
          - generic [ref=e80]:
            - generic [ref=e81]: FA
            - generic [ref=e82]:
              - generic [ref=e83]: Cikgu Aziz
              - generic [ref=e84]: Farah Aziz • Matematik KSSM & Sains KSSM & Ulang kaji SPM
          - generic [ref=e85]:
            - generic [ref=e86]:
              - generic [ref=e87]: 🏫
              - generic [ref=e88]: "3"
              - generic [ref=e89]: Kelas
            - generic [ref=e90]:
              - generic [ref=e91]: 👥
              - generic [ref=e92]: "3"
              - generic [ref=e93]: Pelajar
            - generic [ref=e94]:
              - generic [ref=e95]: 📊
              - generic [ref=e96]: 95%
              - generic [ref=e97]: Purata Siap
            - generic [ref=e98]:
              - generic [ref=e99]: ⚠️
              - generic [ref=e100]: "0"
              - generic [ref=e101]: Pelajar Berisiko
          - generic [ref=e103]: Purata siap dikira daripada 3/3 kelas yang sudah ada rekod kemajuan. Kelas tanpa rekod belum dikira.
          - generic [ref=e104]:
            - generic [ref=e105]: ⚠️ Perlu Perhatian
            - generic [ref=e106]: Tiada amaran kelas berdasarkan data semasa.
          - generic [ref=e107]: Kelas Saya
          - 'button "Tingkatan 4 Matematik Fokus 📐 Matematik • Tingkatan 4 Kod Kelas MATH42 Salin Kongsi 👥 1 pelajar 📊 Purata Siap 100% Aktiviti terakhir: Belum ada aktiviti direkod 100 Lihat kelas" [ref=e108] [cursor=pointer]':
            - generic [ref=e110]:
              - generic [ref=e111]: Tingkatan 4 Matematik Fokus
              - generic [ref=e112]: 📐 Matematik • Tingkatan 4
            - generic [ref=e113]:
              - generic [ref=e114]:
                - generic [ref=e115]: Kod Kelas
                - generic [ref=e116]: MATH42
              - button "Salin" [ref=e117]
              - button "Kongsi" [ref=e118]
            - generic [ref=e119]:
              - generic [ref=e120]: 👥 1 pelajar
              - generic [ref=e121]: 📊 Purata Siap 100%
              - generic [ref=e122]: "Aktiviti terakhir: Belum ada aktiviti direkod"
            - progressbar [ref=e123]
            - button "Lihat kelas" [ref=e125]
          - 'button "Tingkatan 4 Sains Eksperimen 🔬 Sains • Tingkatan 4 Kod Kelas SCI442 Salin Kongsi 👥 1 pelajar 📊 Purata Siap 85% Aktiviti terakhir: Belum ada aktiviti direkod 85 Lihat kelas" [ref=e126] [cursor=pointer]':
            - generic [ref=e128]:
              - generic [ref=e129]: Tingkatan 4 Sains Eksperimen
              - generic [ref=e130]: 🔬 Sains • Tingkatan 4
            - generic [ref=e131]:
              - generic [ref=e132]:
                - generic [ref=e133]: Kod Kelas
                - generic [ref=e134]: SCI442
              - button "Salin" [ref=e135]
              - button "Kongsi" [ref=e136]
            - generic [ref=e137]:
              - generic [ref=e138]: 👥 1 pelajar
              - generic [ref=e139]: 📊 Purata Siap 85%
              - generic [ref=e140]: "Aktiviti terakhir: Belum ada aktiviti direkod"
            - progressbar [ref=e141]
            - button "Lihat kelas" [ref=e143]
          - 'button "Tingkatan 5 Bahasa Inggeris SPM BI Bahasa Inggeris • Tingkatan 5 Kod Kelas ENG552 Salin Kongsi 👥 1 pelajar 📊 Purata Siap 100% Aktiviti terakhir: Belum ada aktiviti direkod 100 Lihat kelas" [ref=e144] [cursor=pointer]':
            - generic [ref=e146]:
              - generic [ref=e147]: Tingkatan 5 Bahasa Inggeris SPM
              - generic [ref=e148]: BI Bahasa Inggeris • Tingkatan 5
            - generic [ref=e149]:
              - generic [ref=e150]:
                - generic [ref=e151]: Kod Kelas
                - generic [ref=e152]: ENG552
              - button "Salin" [ref=e153]
              - button "Kongsi" [ref=e154]
            - generic [ref=e155]:
              - generic [ref=e156]: 👥 1 pelajar
              - generic [ref=e157]: 📊 Purata Siap 100%
              - generic [ref=e158]: "Aktiviti terakhir: Belum ada aktiviti direkod"
            - progressbar [ref=e159]
            - button "Lihat kelas" [ref=e161]
          - button "+ Cipta kelas baharu" [ref=e162] [cursor=pointer]
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