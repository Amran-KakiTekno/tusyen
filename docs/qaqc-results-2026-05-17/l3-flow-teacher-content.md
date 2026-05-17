# L3 Teacher Content Authoring Flow Logic QA/QC

Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
Namespace: l3-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
Repo: D:\2026\tusyen
Base URL: http://localhost
Browser path: Codex in-app Browser plugin
Date: 2026-05-17

## Result

Status: FAIL release gate.

The teacher can create a classroom, post to its feed, and the student can join with the invite code and see the post. The teacher cannot publish a newly authored lesson despite being logged in as a teacher, and assigned lessons used as fallback did not appear in the student Lesson or Learning catalog.

Only deliverables/screenshots were written. No source, env, git, or dependency edits were made.

## Flow executed

| Step | Result | Evidence |
|---|---:|---|
| Read env snapshot | PASS | Base URL confirmed as http://localhost; Docker/API healthy in snapshot. |
| Teacher login | PASS | Teacher demo account, Cikgu Farah Aziz. |
| Create classroom | PASS | Created `L3 DF8DD Teacher Flow 59F0`, code `9OS3M3`. |
| Create lesson info/content | PARTIAL | Added syllabus, title, summary, two content blocks. |
| Save partial unsaved question | PASS | Unsaved MCQ prompt/options/explanation remained after `Simpan draf`. |
| Add every question type | FAIL | Authoring dropdown exposed only `MCQ` and `Benar/Salah`. |
| Publish authored lesson | FAIL | Alert: `Only teachers and admins can create lessons`. |
| Preview fallback all-types lesson | PARTIAL | Existing `W7 All Question Types w7df8dd38b153211` preview loaded after relogin, but preview only showed content and 14-question count, not question details/widgets. |
| Assign fallback all-types lesson | PARTIAL | Teacher UI accepted assignment to L3 class, but student did not see it. |
| Publish class post | PASS | Teacher post appeared immediately in teacher feed. |
| Invite/join student | PASS | Student joined class using `9OS3M3`. |
| Student sees post | PASS | Student Posts page showed the full L3 post. |
| Student sees assigned lesson | FAIL | `W7 All Question Types` absent from student Lesson and Learning views, before and after post-enrollment reassignment retry. |
| Student all-types exercise modal | BLOCKED | All-types lesson never surfaced to student. Only reachable seeded History lesson modal was checked. |
| Reorder content/questions persists | BLOCKED/FAIL | No visible reorder controls appeared after multiple content blocks/questions. |
| Edit assigned lesson updates student view | BLOCKED | New authored lesson could not publish; fallback assignment never surfaced to student. |
| Removing assignment removes lesson | BLOCKED | Could not establish a visible assigned lesson in student catalog. |

## Defects

### Defect 1

| Field | Detail |
|---|---|
| Role/Screen | Teacher / Lessons / Create guided lesson / Publish |
| Severity | P0 - core authoring flow blocked |
| Repro | Log in with Teacher demo account. Open `Pelajaran / Lessons`. Click `Cipta`. Fill required info, two content blocks, MCQ and True/False questions. Click `Pratonton disemak, terbitkan`. |
| Expected | Teacher can publish the valid lesson draft. |
| Actual | The UI shows alert `Only teachers and admins can create lessons` while the sidebar shows the account role as `teacher`. Lesson does not publish. |
| Suspected file | `web_app/components/teacher.jsx`, `backend/src/learning/routes.ts`, `backend/src/auth/session.ts` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/02-teacher-lesson-publish-role-blocker.png` |

### Defect 2

| Field | Detail |
|---|---|
| Role/Screen | Teacher / Lessons / Questions authoring |
| Severity | P1 - cannot author required content coverage |
| Repro | In the guided lesson creator, reach step `3. Questions`. Open the `Jenis` dropdown. |
| Expected | All supported lesson question types are available for authoring, matching the all-types exercise support. |
| Actual | Only `MCQ` and `Benar/Salah` are available. Existing catalog fixture `W7 All Question Types...` has 14 questions, so the authoring UI is not feature-complete. |
| Suspected file | `web_app/components/teacher.jsx` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/01-teacher-lesson-authoring-limited-types.png` |

### Defect 3

| Field | Detail |
|---|---|
| Role/Screen | Teacher / Lessons / Questions authoring |
| Severity | P1 - math content can be corrupted |
| Repro | Add a True/False prompt containing symbols and negative numbers: `Q2 DF8DD True/False: In y = -2x + 5, the gradient is -2.` |
| Expected | Saved question text preserves exact teacher-authored symbols, casing, slash, and negative signs. |
| Actual | Saved list displayed normalized text similar to `Q2 Df8dd True False: In Y = 2x + 5, The Gradient Is 2.`, removing the slash and negative signs. |
| Suspected file | `web_app/components/teacher.jsx`, possibly shared formatting/title-case helper in `web_app/app.js` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/01-teacher-lesson-authoring-limited-types.png` |

### Defect 4

| Field | Detail |
|---|---|
| Role/Screen | Teacher assignment -> Student Lesson/Learning catalog |
| Severity | P1 - assigned class lesson not visible to student |
| Repro | Teacher assigns `W7 All Question Types w7df8dd38b153211` to `L3 DF8DD Teacher Flow 59F0`. Student joins the class with code `9OS3M3`. Open Student `Pelajaran / Lesson` and `Belajar / Learning`. Retry assignment after student is enrolled. |
| Expected | Student sees the assigned class lesson in catalog/learning surfaces and can start it. If subject/form mismatch is invalid, teacher should be blocked before assignment. |
| Actual | Teacher UI accepts assignment, but student never sees `W7 All Question Types` in Lesson or Learning views. |
| Suspected file | `web_app/components/teacher.jsx`, `web_app/components/student.jsx`, `backend/src/learning/routes.ts`, `backend/src/classroom/routes.ts` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/08-student-lesson-catalog-after-join.png`, `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/12-student-after-post-enrollment-reassign.png` |

### Defect 5

| Field | Detail |
|---|---|
| Role/Screen | Teacher / Lesson preview |
| Severity | P2 - preview parity not trustworthy |
| Repro | Teacher previews `W7 All Question Types w7df8dd38b153211`. |
| Expected | Teacher preview matches the student lesson/exercise view 1:1, including question prompts and answer widgets for each question type. |
| Actual | Preview shows content blocks, metadata, and `14 soalan`, but not the 14 questions or answer widgets. Student exercise modal renders questions only after start, so parity cannot be confirmed from teacher preview. |
| Suspected file | `web_app/components/teacher.jsx`, `web_app/components/student.jsx` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/04-teacher-preview-all-types-after-relogin.png`, `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/13-student-exercise-modal-reachable-lesson.png` |

### Defect 6

| Field | Detail |
|---|---|
| Role/Screen | Teacher / Lesson content and question authoring |
| Severity | P2 - requested reorder persistence cannot be verified |
| Repro | Add two content sections and two questions in the guided lesson creator. Inspect available controls. |
| Expected | Teacher can reorder content/questions and the new order persists after save/publish. |
| Actual | No visible move up/down or drag handles appeared for content sections or questions. Only `Buang` controls were visible. |
| Suspected file | `web_app/components/teacher.jsx` |
| Screenshot | `docs/qaqc-results-2026-05-17/screenshots/teacher-flow/01-teacher-lesson-authoring-limited-types.png` |

## Positive observations

| Area | Evidence |
|---|---|
| Classroom creation | Class persisted after relogin and showed 1 student after join. |
| Partial draft save | Unsaved MCQ form content remained after `Simpan draf`. |
| Class invite | Student joined successfully with code `9OS3M3`. |
| Feed propagation | Teacher post appeared immediately in teacher feed and later in full on student Posts page. |
| Console health | Browser console checks during the pass did not show relevant error/warn entries. |

## Screenshots

| File | Purpose |
|---|---|
| `screenshots/teacher-flow/01-teacher-lesson-authoring-limited-types.png` | Teacher authoring step with limited types and saved question list. |
| `screenshots/teacher-flow/02-teacher-lesson-publish-role-blocker.png` | Publish blocker alert. |
| `screenshots/teacher-flow/03-teacher-preview-all-types.png` | Initial all-types preview attempt before relogin. |
| `screenshots/teacher-flow/04-teacher-preview-all-types-after-relogin.png` | All-types teacher preview after relogin. |
| `screenshots/teacher-flow/05-teacher-assigned-all-types-to-class.png` | Assignment success message in preview modal. |
| `screenshots/teacher-flow/06-teacher-class-feed-post.png` | Teacher feed post visible. |
| `screenshots/teacher-flow/07-student-joined-class.png` | Student joined class and sees post preview. |
| `screenshots/teacher-flow/08-student-lesson-catalog-after-join.png` | Student Lesson view missing assigned all-types lesson. |
| `screenshots/teacher-flow/09-student-learning-after-assignment.png` | Student Learning view missing assigned all-types lesson. |
| `screenshots/teacher-flow/10-student-posts-after-join.png` | Student Posts page shows full L3 post. |
| `screenshots/teacher-flow/11-teacher-reassign-after-student-joined.png` | Teacher assignment retry after student enrollment. |
| `screenshots/teacher-flow/12-student-after-post-enrollment-reassign.png` | Student still missing all-types lesson after retry. |
| `screenshots/teacher-flow/13-student-exercise-modal-reachable-lesson.png` | Reachable student exercise modal for existing seeded lesson only. |

## Environment caveat

During the run, a browser reload unexpectedly landed in the Parent demo account. I recovered using the visible sign-out/login UI and continued with Teacher and Student demo accounts. This looked like shared browser/session interference in the multi-agent QA environment, not a filesystem change.

## Blocked audit items

| Audit item | Blocker |
|---|---|
| Lesson preview matches student all-types view 1:1 | All-types assignment never surfaced to student; teacher preview lacks question widgets. |
| All question types render in student exercise modal | All-types lesson not visible to student. |
| Editing already assigned lesson updates student view without breaking in-progress attempts | Newly authored lesson cannot publish; fallback assignment not visible to student. |
| Removing assignment removes lesson from student catalog | No assigned fallback lesson was visible in student catalog to remove. |
| Reorder content/questions persists | Reorder controls were absent. |
