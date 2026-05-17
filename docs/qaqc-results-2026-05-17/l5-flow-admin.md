# L5 Admin Provisioning Flow QA/QC

- Repo: `D:\2026\tusyen`
- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `l5-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Base URL: `http://localhost`
- Env snapshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md`
- Evidence folder: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow`
- Browser: Codex in-app Browser plugin first; API fallback used only after the admin UI hit auth/listing blockers.
- No commits or environment edits were made.

## Overall result

**PARTIAL PASS / FLOW USABLE THROUGH API FALLBACK, WITH ADMIN UI AND EDGE-LOGIC DEFECTS.**

The complete provisioning chain succeeded through authenticated backend admin APIs after the browser admin UI initially failed with `Admin access required` on Users. The created teacher, student, and parent accounts logged in immediately; parent-student linking, classroom creation, enrollment, syllabus creation, lesson creation, assignment with due date, classroom rename, and parent-visible class post all validated. Browser role-view checks confirmed teacher/student/parent visibility for the renamed classroom and confirmed the student learning screen displays the assigned lesson due date.

Blocking or notable gaps remain in the admin UI/session behavior, teacher assignment presentation, syllabus deletion semantics, and dashboard stats coverage.

## Test data created

| Entity | Value |
|---|---|
| Teacher | `L5 Teacher df8dd38b yrg9k` / `l5.teacher.df8dd38b.yrg9k@qaqc.test` |
| Student | `L5 Student df8dd38b yrg9k` / `l5.student.df8dd38b.yrg9k@qaqc.test` |
| Parent | `L5 Parent df8dd38b yrg9k` / `l5.parent.df8dd38b.yrg9k@qaqc.test` |
| Classroom | `L5 Classroom Renamed df8dd38b yrg9k` |
| Classroom id | `186c15c5-e361-4884-836c-77d5d97ca17a` |
| Syllabus id | `0f1818e1-8f85-40a5-b9af-81f882319782` |
| Lesson | `L5 Lesson df8dd38b yrg9k` |
| Lesson id | `a10272f9-eae1-43f6-ab4b-2a2d31f9b3d7` |
| Post | `L5 Parent Visible Post df8dd38b yrg9k` |
| Due date | `2026-05-24T15:59:00.000Z`; rendered to student as `Tarikh akhir 24 Mei` |

## Flow checklist

| Check | Result | Evidence |
|---|---|---|
| Read env snapshot and use `http://localhost` | PASS | `_env-snapshot.md` shows healthy Caddy/API stack. |
| Admin login | PASS | `admin@tusyen.test` login succeeded in Browser. Screenshot: `16-admin-dashboard-after-flow.png`. |
| Admin creates teacher user | PASS via API fallback; initial UI attempt blocked | API create returned success and immediate login returned 200. Initial UI evidence: `01-admin-users-list-load-failure.png`, `03-admin-create-teacher-result.png`. Fresh admin search later showed the teacher. Screenshot: `21-admin-users-fresh-search.png`. |
| Admin creates student user | PASS via API fallback | API create returned success and immediate login returned 200. Fresh admin search showed student as `Tidak aktif` after disable audit. Screenshot: `21-admin-users-fresh-search.png`. |
| Admin creates parent user for parent verification | PASS via API fallback | API create returned success and immediate login returned 200. Fresh admin search showed parent active. Screenshot: `21-admin-users-fresh-search.png`. |
| Link parent-student | PASS | Parent UI monitored the created student and saw linked child summary. Screenshot: `11-parent-initial-view.png`. |
| Create classroom under teacher | PASS with backend validation defect | Numeric `formLevel: 4` succeeded. String `formLevel: "Form 4"` produced a backend 500. Screenshot: `18-admin-classrooms.png`. |
| Enroll student | PASS | Teacher and student role UIs showed 1 student / enrolled class. Screenshots: `04-teacher-renamed-classroom-lesson.png`, `09-student-classrooms-view.png`. |
| Create syllabus item | PASS via API fallback | Lesson and student learning surfaces showed `L5 Syllabus df8dd38b yrg9k`. Screenshot: `13-student-learning-focused.png`. |
| Create lesson under syllabus | PASS | Teacher catalog and student home/learning showed `L5 Lesson df8dd38b yrg9k`. Screenshots: `05-teacher-lessons-view.png`, `13-student-learning-focused.png`. |
| Assign lesson to classroom | PASS in API and student UI; PARTIAL in teacher UI | API returned assignment with due date. Student learning showed class assignment and due date. Teacher UI still labeled the lesson `Belum ditugaskan` and class detail student row said `No lessons yet`. Screenshots: `05-teacher-lessons-view.png`, `06-teacher-class-detail.png`, `13-student-learning-focused.png`. |
| Teacher sees classroom + lesson | PARTIAL | Teacher sees renamed classroom. Teacher sees lesson in catalog, but not as assigned to the classroom. Screenshots: `04-teacher-renamed-classroom-lesson.png`, `05-teacher-lessons-view.png`, `06-teacher-class-detail.png`. |
| Student sees lesson | PASS | Student Home and Learning showed the assigned lesson. Screenshots: `07-student-initial-view.png`, `13-student-learning-focused.png`. |
| Parent sees classroom posts | PASS | Parent Monitoring and Class Posts showed the classroom post and renamed class. Screenshots: `11-parent-initial-view.png`, `12-parent-class-posts-view.png`. |
| Created users log in immediately | PASS | Teacher/student/parent API logins returned 200 immediately after creation; Browser role sessions were opened for teacher, student, parent. |
| Disabling user blocks login but preserves data | PASS | Disabled created student. API login returned 403 `Account deactivated`; Browser login showed `Account deactivated`; admin detail retained 1 parent link and 1 classroom enrollment; classroom roster still contained the student. Screenshot: `15-disabled-student-login-blocked.png`. |
| Classroom rename propagates | PASS | API checks returned renamed class for teacher/student/parent. Browser checks showed renamed class in teacher, student, and parent UIs. Screenshots: `04-teacher-renamed-classroom-lesson.png`, `09-student-classrooms-view.png`, `12-parent-class-posts-view.png`. |
| Syllabus delete warns/blocks rather than silently vanishing lessons | FAIL | `DELETE /api/admin/syllabus/:id` returned `200 { success: true }` with no warning/block even though the lesson still referenced that syllabus id and stayed assigned. Screenshot context: `19-admin-content.png`; API evidence captured in this report. |
| Lesson assignment due date visible | PASS for student; PARTIAL for teacher | Student Learning showed `Tarikh akhir 24 Mei`. Teacher lesson/class detail did not show due date. Screenshots: `13-student-learning-focused.png`, `05-teacher-lessons-view.png`, `06-teacher-class-detail.png`. |
| Stats update after each provisioning step | PARTIAL | `/api/admin/stats` changed for users, classroom, enrollment, and lesson count. It had no dedicated counters for parent links, syllabus items, assignments, posts, or rename events. Shared-run concurrency also made absolute deltas noisy. Screenshots: `16-admin-dashboard-after-flow.png`, `20-admin-dashboard-return.png`. |

## Stats observations

The shared environment had other QA workers active, so absolute totals changed concurrently. Still, the API stats showed these relevant signals during the L5 flow:

| Step | Relevant observed stats behavior |
|---|---|
| Baseline | `total_students=26`, `total_teachers=18`, `total_parents=12`, `active_classrooms=20`, `total_enrollments=21`, `total_lessons=10`. |
| After teacher create | `total_teachers` increased to `19`; `active_users` increased to `58`. |
| After student create | `total_students` increased to `27`; `active_users` increased to `59`. |
| After parent create | `total_parents` increased to `13`; `active_users` increased to `60`. |
| After parent-student link | No stats field changed; there is no parent-link counter. |
| After classroom create / retry | `active_classrooms` increased; concurrent/shared-worker noise also affected user totals. |
| After student enrollment | `total_enrollments` increased to `23`. |
| After syllabus create | No stats field changed; there is no syllabus counter. |
| After lesson create | `total_lessons` increased to `11`. |
| After assignment, post, rename | No stats field changed; there are no assignment/post/rename counters. |
| After student disable | `inactive_users` increased and disabled login was blocked. |

## Defects

### 1. Admin Users can render admin shell but fail privileged actions with `Admin access required`

- Role/Screen: Admin / Users
- Severity: P1
- Repro: In Browser, log out from a parent session, log in as `admin@tusyen.test`, open Admin > Users, click `Tambah`, enter a teacher, and click `Save`.
- Expected: Users list loads and admin can create a user in the same authenticated admin session.
- Actual: Users list showed `Senarai pengguna tidak dapat dimuat`; Save returned `Admin access required` while the sidebar/header still showed `Puan Nabila Hassan / Admin`. A later fresh admin session recovered and displayed the API-created users, so this appears session/auth-state dependent.
- Suspected file: `web_app/components/admin.jsx` auth/session handling around admin API calls, or `backend/src/admin/routes.ts` auth middleware response handling.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\01-admin-users-list-load-failure.png`, `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\03-admin-create-teacher-result.png`

### 2. Admin classroom creation can 500 on form-level shape instead of validating

- Role/Screen: Admin / Classrooms API and any UI path that submits `formLevel` as display text
- Severity: P1
- Repro: Submit `POST /api/admin/classrooms` with `formLevel: "Form 4"` while authenticated as admin.
- Expected: Either accept normalized display values or return a 400 validation error without side effects.
- Actual: API returned `500` with `invalid input syntax for type integer: "NaN"`. Retrying with numeric `formLevel: 4` succeeded.
- Suspected file: `backend/src/admin/routes.ts` classroom create/update form-level normalization.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\18-admin-classrooms.png`

### 3. Teacher UI does not show admin-assigned lesson as assigned to the classroom

- Role/Screen: Teacher / Lessons and Teacher / Class Detail
- Severity: P1
- Repro: Admin/API create lesson, assign it to the teacher classroom with due date, log in as the teacher, open Lessons and the classroom detail.
- Expected: Teacher sees the lesson attached to the classroom, assignment state, and due date.
- Actual: Teacher Lessons shows `L5 Lesson df8dd38b yrg9k` but marks it `Belum ditugaskan`; class detail student row says `No lessons yet`; due date is not visible in teacher views.
- Suspected file: `web_app/components/teacher.jsx` assignment/classroom lesson mapping, or `/api/classroom/:id/lessons` integration in the teacher UI.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\05-teacher-lessons-view.png`, `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\06-teacher-class-detail.png`

### 4. Syllabus delete silently deactivates a syllabus that still has lessons

- Role/Screen: Admin / Content / Syllabus delete
- Severity: P1
- Repro: Create a syllabus, create a lesson under it, assign the lesson to a classroom, then call `DELETE /api/admin/syllabus/:id`.
- Expected: Warn or block deletion while lessons still reference the syllabus, or require an explicit force/archive flow that explains lesson impact.
- Actual: API returned `200 { success: true }` with no warning. The lesson still fetched and remained assigned while retaining the deleted syllabus id.
- Suspected file: `backend/src/admin/routes.ts` syllabus delete logic and `web_app/components/admin.jsx` syllabus delete UX.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\19-admin-content.png`

### 5. Admin stats do not cover every provisioning step

- Role/Screen: Admin / Dashboard stats
- Severity: P2
- Repro: Capture `/api/admin/stats` after each L5 provisioning step: parent link, syllabus create, lesson assignment, post create, classroom rename.
- Expected: Stats or audit indicators update after every admin provisioning step, or the dashboard explains which events are not counted.
- Actual: User/classroom/enrollment/lesson counters update, but parent links, syllabus items, lesson assignments, posts, and classroom rename have no visible stats counter. In this shared run, concurrent workers also made absolute totals noisy.
- Suspected file: `backend/src/admin/routes.ts` `/stats` response and `web_app/components/admin.jsx` dashboard cards.
- Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\16-admin-dashboard-after-flow.png`, `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\20-admin-dashboard-return.png`

## Screenshots captured

- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\01-admin-users-list-load-failure.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\02-admin-create-teacher-attempt.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\03-admin-create-teacher-result.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\04-teacher-renamed-classroom-lesson.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\05-teacher-lessons-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\06-teacher-class-detail.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\07-student-initial-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\08-student-learning-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\09-student-classrooms-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\10-student-posts-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\11-parent-initial-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\12-parent-class-posts-view.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\13-student-learning-focused.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\14-student-lesson-screen-focused.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\15-disabled-student-login-blocked.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\16-admin-dashboard-after-flow.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\17-admin-parent-links.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\18-admin-classrooms.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\19-admin-content.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\20-admin-dashboard-return.png`
- `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\admin-flow\21-admin-users-fresh-search.png`
