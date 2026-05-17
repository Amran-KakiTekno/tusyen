# W17 React Admin UI QA/QC

- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w17-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Env snapshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md`
- Base URL: `http://localhost`
- Date/time: `2026-05-17`, Asia/Singapore
- Desktop viewport: Browser plugin, `1366x900`
- Mobile viewport: Browser plugin attempted at `375x812`; Browser `Page.captureScreenshot` timed out even for `120x120`, so required mobile screenshots were captured with standalone Playwright at `375x812` after the Browser path was exercised.
- Result: **FAIL / BLOCKED** for full admin pass criteria. Users CRUD passed; parent-links, classrooms, syllabus, lessons publish/advanced question types, and cache clear have blocking defects.

## Scope covered

| Screen / flow | Desktop result | Mobile result | Notes |
|---|---:|---:|---|
| Home stats / dashboard health | PASS | PASS via Playwright fallback | Dashboard showed live stats and DB/Redis/notification connected on desktop. Mobile admin dashboard captured after fresh admin login. |
| Users create/edit/disable/role filters | PASS | Visual smoke captured | Created `w17.admin.student.df8dd38b@qaqc.test`, edited to `W17 Edited Student df8dd38b`, disabled it, and confirmed Student filter. |
| Parent-links create/delete | FAIL | FAIL evidence captured | Parent/student candidate comboboxes show zero results, so create/delete cannot start. |
| Classrooms create/edit/enroll/remove student | FAIL | FAIL evidence captured | List load fails; create form has zero teacher candidates; edit/enroll/remove are blocked. |
| Syllabus CRUD | FAIL | FAIL evidence captured | List load fails; publish confirmation returns `Admin access required` while logged in as admin. |
| Lessons CRUD and question types | FAIL | FAIL evidence captured | Basic MCQ can be added to draft, but only `MCQ` and `Benar/Salah` are available; required advanced types are missing; publish blocked by missing syllabus. |
| System health/cache clear | FAIL on cache clear | PASS health visual, FAIL cache clear path | Dashboard health passes. System cache clear confirmation returns `Admin access required`. |
| Console health | PASS | PASS | Browser console logs and standalone Playwright console/pageerror listeners reported no relevant errors/warnings. |
| Dark contrast/mobile/layout | PARTIAL | PARTIAL | Dark mode renders across desktop/mobile, but major mobile admin validation used fallback screenshots because Browser screenshot capture failed. |
| Keyboard/focus | PARTIAL | PARTIAL | Visible focus/active states are present on buttons/dialogs; exhaustive keyboard traversal was not completed because multiple CRUD flows are blocked. |

## Defects

### 1. Parent-links candidates do not load

- Role/Screen: Admin / Parent Links
- Severity: High
- Repro: Open Parent Links, type existing parent/student search terms such as `parent`, `student`, `W7 Parent A`, or `W7 Student A`.
- Expected: Existing parent and student users are selectable so an admin can create and then delete a parent-student link.
- Actual: Both comboboxes show `0 hasil` / `Tiada ibu bapa ditemui` / `Tiada pelajar ditemui`, and `Tambah Pautan` remains disabled.
- Suspected file: `web_app/components/admin.jsx` or `backend/src/admin/routes.ts` parent-link candidate loading.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\07-parent-links-list.png`

### 2. Classrooms list fails to load

- Role/Screen: Admin / Classrooms
- Severity: Critical
- Repro: Open Admin > Classrooms, then click Retry after the load error.
- Expected: Classrooms list loads and exposes create/edit/enroll/remove-student controls.
- Actual: Screen shows `Tidak dapat memuat kelas` and only Retry; classroom list persistence and row actions are blocked.
- Suspected file: `web_app/components/admin.jsx` classroom loader or `backend/src/admin/routes.ts` classroom admin endpoints.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\defect-classrooms-load-failed.png`

### 3. Classroom create cannot select teacher

- Role/Screen: Admin / Classrooms Create
- Severity: High
- Repro: Open Admin > Classrooms, click `+ Cipta`, attempt to create a class.
- Expected: Teacher combobox lists existing teacher users and create form validates/creates a classroom.
- Actual: Teacher combobox shows `0 hasil`; submitting surfaces `Pilih guru untuk kelas.` and no class can be created.
- Suspected file: `web_app/components/admin.jsx` teacher candidate combobox or `backend/src/admin/routes.ts` users query.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\defect-classrooms-load-failed.png`

### 4. Syllabus list fails to load

- Role/Screen: Admin / Content / Syllabus
- Severity: High
- Repro: Open Admin > Content with Silibus tab selected.
- Expected: Existing syllabus list loads so admins can verify create/edit/delete persistence.
- Actual: The list shows `Silibus tidak dapat dimuat` with Retry; CRUD persistence cannot be confirmed in the list.
- Suspected file: `web_app/components/admin.jsx` syllabus loader or `backend/src/learning/routes.ts` syllabus endpoint.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\09-content-syllabus-lessons-list.png`

### 5. Syllabus publish returns admin authorization error

- Role/Screen: Admin / Content / Syllabus Publish
- Severity: Critical
- Repro: Admin > Content > Silibus: fill syllabus form, click `Semak & Terbitkan Silibus`, then `Terbitkan Silibus`.
- Expected: Admin user can publish the syllabus item and see it in the syllabus list.
- Actual: UI shows alert `Admin access required` while logged in as `Puan Nabila Hassan / Admin`; confirmation dialog remains open.
- Suspected file: `backend/src/learning/routes.ts` admin authorization or `web_app/components/admin.jsx` auth token handling.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\defect-syllabus-admin-access-required.png`

### 6. Required lesson question types are missing

- Role/Screen: Admin / Content / Lessons Question Types
- Severity: Critical
- Repro: Open Admin > Content > Lessons and inspect the `Jenis` dropdown in `Pembina Kuiz`.
- Expected: At least five question types are available, including matching pairs, step ordering, numeric, diagram labeling, and scenario.
- Actual: `Jenis` dropdown exposes only `MCQ` and `Benar/Salah`, so required STEM question types cannot be authored from admin UI.
- Suspected file: `web_app/components/admin.jsx` lesson quiz builder question type options.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\12-lessons-list-question-types.png`

### 7. Published lessons list fails to load

- Role/Screen: Admin / Content / Lessons List
- Severity: High
- Repro: Open Admin > Content > Lessons.
- Expected: Published lessons list loads for edit/delete/persistence verification.
- Actual: The list shows `Pelajaran tidak dapat dimuat` with Retry.
- Suspected file: `web_app/components/admin.jsx` lessons loader or `backend/src/learning/routes.ts` lessons endpoint.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\12-lessons-list-question-types.png`

### 8. Lesson publish blocked by missing syllabus selector

- Role/Screen: Admin / Content / Lessons Publish
- Severity: High
- Repro: Admin > Content > Lessons: enter lesson title/summary, add one MCQ, click `Semak & Terbitkan Pelajaran`.
- Expected: Admin can select a syllabus item, preview, publish, then see the lesson in the published list.
- Actual: `Item Silibus` has only placeholder option `Pilih silibus terkini`; publish dialog says `Lengkapkan perkara berikut sebelum terbit: - Pilih item silibus.`
- Suspected file: `web_app/components/admin.jsx` lesson publish form or `backend/src/learning/routes.ts` lesson/syllabus endpoints.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\14-lesson-publish-attempt.png`

### 9. System summary can fail in same admin session after content auth errors

- Role/Screen: Admin / System Summary
- Severity: High
- Repro: After the failed syllabus publish/admin access flow, open Admin > System and click Retry on the system summary error.
- Expected: System summary loads DB/Redis/notification/storage statuses consistently with dashboard health.
- Actual: System screen shows `Ringkasan sistem tidak dapat dimuat` and service cards remain `Belum disemak`. A fresh mobile admin login later showed the summary can load, so this may be flow/session-state dependent.
- Suspected file: `web_app/components/admin.jsx` system summary loader or `backend/src/admin/routes.ts` system summary endpoint.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\15-system-health-cache.png`

### 10. Cache clear returns admin authorization error

- Role/Screen: Admin / System Cache Clear
- Severity: Critical
- Repro: Admin > System > Penyelenggaraan: click `Bersih`, confirm `Bersih Cache`.
- Expected: Admin can clear Redis/report/leaderboard cache and sees a success state.
- Actual: UI returns `Admin access required` despite active admin shell/session.
- Suspected file: `backend/src/admin/routes.ts` cache-clear authorization or `web_app/components/admin.jsx` auth token handling.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\17-system-cache-clear-confirmed.png`

### 11. Browser mobile reload switched out of admin role

- Role/Screen: Admin / Mobile Session
- Severity: Critical
- Repro: Log in as admin at desktop, switch Browser viewport to `375x812`, reload.
- Expected: Admin shell remains active and renders admin mobile navigation/screens.
- Actual: Browser DOM reloaded into Parent Monitoring for `Nur Aisyah Rahman`; admin mobile screens were not reachable in that Browser session without re-authentication. Browser screenshot capture also timed out at mobile, so DOM snapshot is the evidence for this item.
- Suspected file: `web_app/app.js` auth/session role persistence or responsive shell bootstrapping.
- Screenshot: Browser mobile screenshot timed out; fallback mobile login screenshot is `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\00-mobile-initial-landing.png`

## Positive checks

- Admin login with `admin@tusyen.test` / `password123` succeeded on desktop Browser and mobile Playwright fallback.
- Dashboard stats and health cards rendered on desktop without console errors.
- Users create/edit/disable persisted visibly in the admin table.
- Users role filter narrowed rows to `Student` records.
- Lessons builder can add a basic MCQ draft question and updates the count to `1 soalan`.
- Mobile admin screens can render after fresh admin login in standalone Playwright at `375x812`.
- No relevant browser console errors/warnings were captured in Browser plugin logs or standalone Playwright fallback listeners.

## Screenshots

### Desktop Browser screenshots

- Home stats: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\01-dashboard-home-stats.png`
- Users list/filter: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\02-users-list-role-filters.png`
- Users created: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\03-users-created-search-result.png`
- Users edited: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\04-users-edited-result.png`
- Users disabled: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\05-users-disabled-result.png`
- Users Student filter: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\06-users-student-role-filter.png`
- Parent links: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\07-parent-links-list.png`
- Classrooms load failed: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\defect-classrooms-load-failed.png`
- Content/Syllabus: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\09-content-syllabus-lessons-list.png`
- Syllabus create attempt: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\10-syllabus-create-attempt.png`
- Syllabus publish result: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\11-syllabus-publish-result.png`
- Syllabus admin access defect: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\defect-syllabus-admin-access-required.png`
- Lessons question types: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\12-lessons-list-question-types.png`
- Lesson MCQ added: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\13-lesson-mcq-question-added.png`
- Lesson publish blocked: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\14-lesson-publish-attempt.png`
- System health/cache screen: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\15-system-health-cache.png`
- Cache clear dialog/result: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\16-system-cache-clear-result.png`
- Cache clear admin access defect: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\desktop\17-system-cache-clear-confirmed.png`

### Mobile 375 screenshots

- Initial mobile login landing: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\00-mobile-initial-landing.png`
- Admin dashboard: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\02-mobile-admin-dashboard.png`
- Users: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\03-mobile-users.png`
- Parent links: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\04-mobile-parent-links.png`
- Classrooms: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\05-mobile-classrooms.png`
- Content/Syllabus: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\06-mobile-content-syllabus.png`
- Lessons: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\07-mobile-lessons.png`
- System: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin\mobile\08-mobile-system.png`

## Pass criteria assessment

The pass criterion was not met: every admin action does not persist and appear in subsequent role views. Only Users CRUD persisted visibly in admin. Parent-links, classrooms, syllabus, lesson publish, advanced question authoring, and system cache clear are blocked before subsequent role-view verification can be completed.

## Residual risk

- Subsequent Student/Teacher/Parent role-view persistence was not fully validated because parent-link, classroom, syllabus, and lesson publish flows are blocked in admin.
- Browser mobile screenshots failed due Browser `Page.captureScreenshot` timeout; mobile visual evidence used standalone Playwright fallback after Browser DOM validation exposed the role-switch issue.
- I did not change repo code, env files, migrations, or git state.
