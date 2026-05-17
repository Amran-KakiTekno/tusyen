# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-switch.spec.ts >> language switching - parent role >> parent role updates UI language across key modals and confirmations
- Location: tests\qaqc\language-switch.spec.ts:340:7

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
        - generic [ref=e12]: Ringkasan ibu bapa
        - generic [ref=e13]: Memantau Nur Aisyah Rahman
        - generic [ref=e14]:
          - generic [ref=e15]:
            - generic [ref=e16]: "1"
            - generic [ref=e17]: Anak dipaut
          - generic [ref=e18]:
            - generic [ref=e19]: 82%
            - generic [ref=e20]: Purata skor
          - generic [ref=e21]:
            - generic [ref=e22]: 45m
            - generic [ref=e23]: Masa minggu ini
        - button "Semak Kemajuan" [ref=e24] [cursor=pointer]
      - generic [ref=e26]:
        - generic [ref=e27]: EA
        - generic [ref=e28]:
          - generic [ref=e29]: Encik Azlan Rahman
          - generic [ref=e30]: parent
      - navigation "Navigasi utama" [ref=e31]:
        - button "Pemantauan / Monitoring" [ref=e32] [cursor=pointer]:
          - img [ref=e33]
          - generic [ref=e37]:
            - generic [ref=e38]: Pemantauan
            - generic [ref=e39]: Monitoring
        - button "Anak / Children" [ref=e41] [cursor=pointer]:
          - generic [ref=e42]: 👪
          - generic [ref=e43]:
            - generic [ref=e44]: Anak
            - generic [ref=e45]: Children
        - button "Kemajuan / Progress" [ref=e46] [cursor=pointer]:
          - img [ref=e47]
          - generic [ref=e50]:
            - generic [ref=e51]: Kemajuan
            - generic [ref=e52]: Progress
        - button "Pos Kelas / Class Posts" [ref=e53] [cursor=pointer]:
          - img [ref=e54]
          - generic [ref=e57]:
            - generic [ref=e58]: Pos Kelas
            - generic [ref=e59]: Class Posts
        - button "Amaran / Alerts" [ref=e60] [cursor=pointer]:
          - img [ref=e61]
          - generic [ref=e63]:
            - generic [ref=e64]: Amaran
            - generic [ref=e65]: Alerts
        - button "Tetapan / Settings" [ref=e66] [cursor=pointer]:
          - img [ref=e67]
          - generic [ref=e70]:
            - generic [ref=e71]: Tetapan
            - generic [ref=e72]: Settings
      - generic [ref=e73]:
        - group "Pilih tema warna" [ref=e74]:
          - button "Gelap" [ref=e75] [cursor=pointer]
          - button "Cerah" [pressed] [ref=e76] [cursor=pointer]
        - group "Pilih bahasa" [ref=e78]:
          - button "BM" [pressed] [ref=e79] [cursor=pointer]
          - button "EN" [ref=e80] [cursor=pointer]
        - button "Log keluar" [ref=e81] [cursor=pointer]: 🚪 Log Keluar
    - main "Pemantauan / Nur Aisyah Rahman" [ref=e82]:
      - generic [ref=e83]:
        - heading "Pemantauan / Nur Aisyah Rahman" [level=1] [ref=e84]
        - generic [ref=e85]:
          - generic [ref=e86]:
            - generic [ref=e87]: Assalamualaikum,
            - generic [ref=e88]: Encik 👋
          - generic [ref=e89]:
            - generic [ref=e90]:
              - generic [ref=e91]:
                - generic [ref=e92]: Perhatian Hari Ini
                - generic [ref=e93]: Apa yang perlu ibu bapa buat untuk Nur Aisyah Rahman
              - generic [ref=e94]: Stabil
            - generic [ref=e95]:
              - generic [ref=e96]:
                - generic [ref=e97]: Status
                - generic [ref=e98]: Purata 82% dengan rutin yang sedang berjalan.
              - generic [ref=e99]:
                - generic [ref=e100]: Kebimbangan
                - generic [ref=e101]: Kuiz Baharu Dihantar
              - generic [ref=e102]:
                - generic [ref=e103]: Tindakan ibu bapa
                - generic [ref=e104]: Baca pos kelas dan pastikan anak faham tugasan yang perlu disiapkan.
            - button "Lihat Kuiz" [ref=e105] [cursor=pointer]
          - generic [ref=e106]:
            - generic [ref=e107]:
              - generic [ref=e108]: NA
              - generic [ref=e109]:
                - generic [ref=e110]: Nur Aisyah Rahman
                - generic [ref=e111]: Tingkatan 5 • 3 kelas
                - generic [ref=e112]:
                  - generic [ref=e113]: 🔥 1 hari
                  - generic [ref=e114]: ⚡ 1725 XP
            - generic [ref=e115]:
              - button "Buka Kemajuan untuk melihat purata skor anak" [ref=e116] [cursor=pointer]:
                - generic [ref=e117]:
                  - generic [ref=e118]: 82%
                  - generic [ref=e119]: Purata Skor
                  - generic [ref=e120]: Purata rekod pelajaran dan kuiz
              - button "Buka Kemajuan untuk melihat aktiviti minggu ini" [ref=e121] [cursor=pointer]:
                - generic [ref=e122]:
                  - generic [ref=e123]: 45m
                  - generic [ref=e124]: Minggu Ini
                  - generic [ref=e125]: 11 Mei - 17 Mei
              - button "Buka profil anak untuk melihat ringkasan kelas" [ref=e126] [cursor=pointer]:
                - generic [ref=e127]:
                  - generic [ref=e128]: "#1"
                  - generic [ref=e129]: Kedudukan Kelas
                  - generic [ref=e130]: Berdasarkan papan markah kelas
          - button "✅ Stabil Tiada subjek di bawah 60% untuk data terkini." [ref=e131] [cursor=pointer]:
            - generic [ref=e132]: ✅ Stabil
            - generic [ref=e133]: Tiada subjek di bawah 60% untuk data terkini.
          - generic [ref=e134]: Makluman Terkini
          - generic [ref=e135]:
            - generic [ref=e136]:
              - generic [ref=e137]:
                - generic [ref=e138]:
                  - generic [ref=e139]: 📋
                  - generic [ref=e140]: Makluman
                - generic [ref=e141]: Kuiz Baharu Dihantar
              - generic [ref=e142]: 4m lepas
            - generic [ref=e143]: "Cikgu Farah Aziz hantar Latihan emel formal: Sediakan draf emel formal berdasarkan tugasan pelajaran 3. Pastikan jawapan bawah 120 pata"
            - generic [ref=e144]:
              - strong [ref=e145]: "Mengapa penting:"
              - text: Tugasan baharu ada tarikh dan arahan kelas; semak awal supaya anak tahu langkah seterusnya.
            - generic [ref=e146]:
              - strong [ref=e147]: "Tindakan dicadang:"
              - text: Baca pos kelas dan pastikan anak faham tugasan yang perlu disiapkan.
            - button "Lihat Kuiz" [ref=e148] [cursor=pointer]
          - generic [ref=e149]: 📊 Prestasi Subjek
          - generic [ref=e150]:
            - generic [ref=e151]:
              - generic [ref=e152]:
                - generic [ref=e153]: Bahasa Inggeris
                - generic [ref=e154]: 91% →
              - progressbar [ref=e155]
            - generic [ref=e157]:
              - generic [ref=e158]:
                - generic [ref=e159]: Matematik
                - generic [ref=e160]: 82% →
              - progressbar [ref=e161]
            - generic [ref=e163]:
              - generic [ref=e164]:
                - generic [ref=e165]: Sains
                - generic [ref=e166]: 74% →
              - progressbar [ref=e167]
          - generic [ref=e169]: 🕐 Aktiviti Anak
          - generic [ref=e170]:
            - generic [ref=e171]:
              - generic [ref=e172]: ✅
              - generic [ref=e173]:
                - generic [ref=e174]: Selesai Kecerunan dan Pintasan Graf Linear (82%)
                - generic [ref=e175]: 4m lepas
            - generic [ref=e176]:
              - generic [ref=e177]: 📘
              - generic [ref=e178]:
                - generic [ref=e179]: Kemajuan Mitosis dalam Sel (74%)
                - generic [ref=e180]: 4m lepas
            - generic [ref=e181]:
              - generic [ref=e182]: ✅
              - generic [ref=e183]:
                - generic [ref=e184]: Selesai Penulisan Emel Formal SPM (91%)
                - generic [ref=e185]: 4m lepas
          - generic [ref=e186]: 📣 Pengumuman Kelas
          - generic [ref=e187]:
            - generic [ref=e188]:
              - generic [ref=e189]: 📢
              - generic [ref=e190]:
                - generic [ref=e191]: Cabaran graf sebelum kelas
                - generic [ref=e192]: 4m lepas • Tingkatan 4 Matematik Fokus
            - generic [ref=e193]:
              - generic [ref=e194]: 💬
              - generic [ref=e195]:
                - generic [ref=e196]: Kad ulang kaji mitosis
                - generic [ref=e197]: 4m lepas • Tingkatan 4 Sains Eksperimen
            - generic [ref=e198]:
              - generic [ref=e199]: 📋
              - generic [ref=e200]:
                - generic [ref=e201]: Latihan emel formal
                - generic [ref=e202]: 4m lepas • Tingkatan 5 Bahasa Inggeris SPM
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