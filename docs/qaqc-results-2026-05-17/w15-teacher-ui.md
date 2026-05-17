# W15 React Teacher UI QA/QC

Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
Namespace: w15-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
Repo: D:\2026\tusyen
Base URL: http://localhost
Role: Teacher, teacher@tusyen.test
Viewport coverage: desktop 1366x900, mobile 375x812
Browser path: Codex Browser plugin, in-app browser, with viewport override
Build Web Apps workflow: rendered UI checks, DOM snapshots, console checks, interaction proof, screenshots

## Executive result

Status: FAIL for release gate.

Primary blockers:

- Teacher auth/session state is unstable. Several teacher actions surfaced `Invalid refresh token`, and a mobile reload switched the active UI from teacher to parent.
- Teacher CRUD is not reliably persistent or safely editable. Classroom create showed immediately but did not survive cleanly into later teacher selectors/re-login state; profile edit opened blank fields; posts lacked edit/delete on a newly-created teacher post; quiz edit blanked questions and delete/live start surfaced server/auth errors.
- Live quiz pass criterion failed. No live PIN was displayed or copyable because starting the W15 quiz deck returned auth/server errors before host controls appeared.
- Whiteboard replay pass criterion partially passed. Replay playback worked, but ending the session showed `Not authorized`, the list contradicted itself about recording availability, and no recording upload control was visible.

## Environment checks

| Check | Result | Evidence |
|---|---:|---|
| Page identity | PASS | `http://localhost`, title `Tusyen - EduApp Malaysia` |
| Non-blank app shell | PASS | Teacher shell rendered after teacher login on desktop and mobile |
| Framework overlay | PASS | No Vite/React/framework overlay observed |
| Console health | PASS | Browser console errors/warnings returned `[]` at final check |
| Network health | FAIL by UI evidence | UI surfaced `Invalid refresh token`, `Internal Server Error`, and `Not authorized` during API-backed actions |
| Desktop viewport | PASS | 1366x900 screenshots captured |
| Mobile viewport | FAIL | Teacher mobile screenshots captured after re-login, but mobile reload first switched into parent shell |

## Pass criteria

| Criterion | Result | Notes |
|---|---:|---|
| CRUD persists | FAIL | Class/post/quiz create paths worked immediately, but class availability and post/quiz edit/delete were inconsistent or broken. |
| Live PIN displayed/copyable | FAIL | Quiz start did not reach host state; no PIN appeared. |
| Recording playback works | PARTIAL PASS | Whiteboard replay opened and `Main semula` changed to playing state. Upload/end states failed or were missing. |

## Defects

### 1. Teacher auth state breaks across actions and mobile reload

Role/Screen: Teacher / Classrooms, Quiz, Mobile shell

Severity: P0

Repro:

1. Log in as `teacher@tusyen.test`.
2. Navigate teacher desktop screens and perform API-backed actions like opening class creation or starting a quiz.
3. Switch to 375px mobile and reload.

Expected: The teacher remains authenticated as teacher, with teacher routes and teacher data only.

Actual: Classrooms and Quiz showed `Invalid refresh token`; mobile reload opened the parent shell (`Pemantauan / Ibu bapa`, Encik Azlan Rahman) before sign-out/re-login.

Suspected file: `web_app/app.js`, `web_app/components/teacher.jsx`, `backend/src/auth/session.ts`, `backend/src/auth/routes.ts`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\defect-refresh-token-classrooms.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\mobile\defect-mobile-role-switched-parent.png`

### 2. Created classroom is inconsistent across teacher surfaces

Role/Screen: Teacher / Classrooms, Posts, Lessons, Quiz, Whiteboard

Severity: P1

Repro:

1. Create class from Teacher > Classes with title `W15 Teacher QA Class df8dd38b`.
2. Observe the class detail and join code.
3. Navigate Posts, Lessons assignment modal, Quiz class selector, and Whiteboard class selector.
4. Sign out and back in on mobile.

Expected: The created classroom should persist and be available wherever a teacher selects a class.

Actual: The class displayed immediately as sanitized `W15 Df8dd38b` with join code `79DLDH`, but later class selectors only showed seeded/other classes. After mobile re-login the W15 class was not visible in the teacher class list.

Suspected file: `web_app/components/teacher.jsx`, `backend/src/classroom/routes.ts`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\03-classrooms-created-share-code.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\mobile\02-teacher-home-mobile.png`

### 3. Profile edit is unsafe because teacher profile data can load as blank

Role/Screen: Teacher / Profile edit

Severity: P0

Repro:

1. Open Teacher > Profile.
2. After auth/session churn, click `Edit`.

Expected: Teacher profile should load current persisted headline, bio, specialties, credentials, years, and location before saving.

Actual: The screen showed `Only teachers have profile pages` for a teacher account. Edit mode opened blank fields and 0 years, which could wipe existing profile data if saved.

Suspected file: `web_app/components/teacher.jsx`, `backend/src/profile/routes.ts` if present, `backend/src/auth/session.ts`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\30-profile-edit-error-state.png`

### 4. Lesson preview and assignment are not reliable

Role/Screen: Teacher / Lessons browse, preview, assign

Severity: P1

Repro:

1. Open Teacher > Lessons.
2. Click `Pratonton Kecerunan dan Pintasan Graf Linear`.
3. Open assignment modal for the same lesson.
4. Submit assignment with due date `2026-05-25`.

Expected: Preview loads lesson content; assignment class dropdown includes current teacher classes; submit gives success and assigned state persists.

Actual: Preview panel showed `Internal Server Error`. Assignment dropdown omitted the W15-created class and only listed seeded classes. After submit, the catalog still showed `Belum ditugaskan` with no clear success state.

Suspected file: `web_app/components/teacher.jsx`, `backend/src/learning/routes.ts`, `backend/src/classroom/routes.ts`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\07-lessons-preview.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\08-lessons-assign-modal.png`

### 5. Post media/embed and own-post CRUD are broken

Role/Screen: Teacher / Posts create, pin, edit, delete

Severity: P1

Repro:

1. Open Teacher > Posts.
2. Create pinned post `W15 Media Post df8dd38b` with image URL, GIF URL, and YouTube URL.
3. Inspect the created post actions.

Expected: Image/GIF/YouTube content should render as media/embed previews or clear attachment cards. Newly-created teacher-owned post should expose edit/delete actions.

Actual: Image/GIF/YouTube URLs rendered as sanitized plain text plus one plain link. The newly-created post did not expose an edit/delete kebab; only the seeded post had a `...` menu.

Suspected file: `web_app/components/teacher.jsx`, `backend/src/feed/routes.ts` if present, media rendering helpers in `web_app/components/shared.jsx`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\12-posts-created-pinned-media.png`

### 6. Quiz deck edit/live/delete flows fail

Role/Screen: Teacher / Quiz deck CRUD and live hosting

Severity: P0

Repro:

1. Create quiz deck `W15 Deck df8dd38b` with MCQ and numeric-answer question.
2. Click Start on the created deck.
3. Open Edit on the created deck.
4. Open More actions > Delete deck and confirm.

Expected: Deck create/edit/delete persists; Start opens host view with visible/copyable PIN, advance, and end controls.

Actual: Deck creation succeeded. Start surfaced `Invalid refresh token` and never showed a PIN. Edit opened with blank question fields and `Add at least one complete question`. Delete confirmation closed but immediately showed `Internal Server Error`; later relogin no longer showed the deck, so delete persistence and list refresh are inconsistent.

Suspected file: `web_app/components/quiz.jsx`, `web_app/components/teacher.jsx`, `backend/src/quiz/routes.ts`, `backend/src/quiz/store.ts`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\15-quiz-deck-created.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\defect-quiz-edit-loses-questions.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\21-quiz-deleted-result.png`

### 7. Quiz summary metric is malformed

Role/Screen: Teacher / Quiz dashboard

Severity: P2

Repro:

1. Open Teacher > Quiz on desktop and mobile.
2. Read `Total Questions` metric.

Expected: Metric should display a normal integer total.

Actual: Desktop displayed `0332`; mobile displayed `04`, suggesting concatenated/incorrect formatting.

Suspected file: `web_app/components/quiz.jsx`, `web_app/components/teacher.jsx`

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\13-quiz-list.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\mobile\05-quiz-mobile.png`

### 8. Whiteboard end/upload/recording states are contradictory

Role/Screen: Teacher / Whiteboard

Severity: P1

Repro:

1. Open Teacher > Whiteboard.
2. Enter active whiteboard, draw, return, and click `Tamat Sesi`.
3. Click replay controls.
4. Look for recording upload control.

Expected: Teacher can start, draw, end, upload recording, and replay recording with consistent recorded/not-recorded states.

Actual: Drawing worked and replay playback worked (`154/154 aktiviti`, then `Memainkan...`). Ending showed `Not authorized` and the session still appeared active until later relogin. List said `Tidak dirakam`, but replay was still available. No recording upload control was visible.

Suspected file: `web_app/components/teacher.jsx`, `backend/src/websocket/handlers.ts`, whiteboard route/storage code

Screenshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\24-whiteboard-drawn-disconnected.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\25-whiteboard-ended.png`; `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop\27-whiteboard-replay-playing.png`

## Screen coverage

| Screen | Desktop | Mobile | Result |
|---|---:|---:|---|
| Home / Classes count | Captured | Captured | Partial fail: no deck summary on home; class state inconsistent |
| Profile edit | Captured | Captured | Fail: blank edit state after profile auth error |
| Classrooms create/share/students | Captured | Captured | Partial fail: create/share worked immediately, persistence/selectors inconsistent |
| Lessons browse/preview/assign | Captured | Captured | Fail: preview 500 and assignment state unclear |
| Posts create/media/pin/edit/delete | Captured | Captured | Fail: media not embedded, no edit/delete for new post |
| Quiz CRUD/live | Captured | Captured | Fail: live PIN absent, edit/delete broken/inconsistent |
| Whiteboard start/draw/end/replay | Captured | Captured | Partial fail: start/draw/replay worked, end/upload state failed |

## Screenshot inventory

Desktop directory: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\desktop`

- `01-home-classes-counts.png`
- `02-profile-before-edit.png`
- `03-classrooms-created-share-code.png`
- `04-classrooms-share-students.png`
- `05-classrooms-student-roster.png`
- `06-lessons-browse.png`
- `07-lessons-preview.png`
- `08-lessons-assign-modal.png`
- `09-lessons-assigned-result.png`
- `10-posts-list.png`
- `11-posts-create-media-form.png`
- `12-posts-created-pinned-media.png`
- `13-quiz-list.png`
- `15-quiz-deck-created.png`
- `16-quiz-live-session-pin.png`
- `17-quiz-start-retry.png`
- `20-quiz-delete-confirm.png`
- `21-quiz-deleted-result.png`
- `22-whiteboard-list.png`
- `23-whiteboard-canvas-before-draw.png`
- `24-whiteboard-drawn-disconnected.png`
- `25-whiteboard-ended.png`
- `26-whiteboard-replay-not-recorded.png`
- `27-whiteboard-replay-playing.png`
- `28-profile-view.png`
- `30-profile-edit-error-state.png`
- `defect-refresh-token-classrooms.png`
- `defect-quiz-edit-loses-questions.png`

Mobile directory: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\teacher\mobile`

- `02-teacher-home-mobile.png`
- `03-posts-mobile.png`
- `04-lessons-mobile.png`
- `05-quiz-mobile.png`
- `06-whiteboard-mobile.png`
- `07-profile-mobile.png`
- `08-whiteboard-started-mobile.png`
- `defect-mobile-role-switched-parent.png`
- `defect-mobile-parent-settings.png`

## Notes

- I did not edit repo source files, environment files, or commits.
- I wrote only the requested QA markdown and screenshots under `docs\qaqc-results-2026-05-17`.
- The final browser console check returned no warnings/errors, so the defects above are based on visible UI/API states rather than console exceptions.
- Browser resource timing was not useful in this runtime; network failures are reported from visible app error states.
