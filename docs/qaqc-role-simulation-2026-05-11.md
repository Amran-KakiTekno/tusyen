# QAQC Role Simulation - 2026-05-11

## Scope

This QAQC pass covered the self-hosted Tusyen stack through API simulations, database checks, Flutter web UI smoke tests, mobile viewport smoke tests, and build/test verification.

Roles covered:

- Student
- Teacher
- Parent
- Admin, included because several teacher/parent/student features depend on admin-managed users, classrooms, syllabus, and lessons

Environment checked:

- Docker Compose stack at `http://localhost`
- API through Caddy at `http://localhost/api`
- Flutter web app served by Caddy
- PostgreSQL, Redis, MinIO, Centrifugo, Keycloak, ntfy containers

The in-app browser pane was unavailable during this run, so frontend verification used Dockerized Playwright against the live local web app. The Flutter web app renders mainly through canvas, so UI smoke was screenshot and click-coordinate based, while CRUD correctness was verified through API transactions.

## Verification Summary

| Area | Result | Notes |
| --- | --- | --- |
| Docker stack | Pass | API, Caddy, PostgreSQL, Redis, MinIO, Keycloak, Centrifugo, and ntfy containers were running. |
| API health | Pass | `/api/health` returned `healthy`, database `connected`, Redis `connected`. |
| Docker API build | Pass | `docker compose build api` completed successfully. |
| Backend build/tests | Pass | `npm run build` and Vitest passed in a fresh Node container: 3 test files, 7 tests. |
| Flutter tests | Pass with warnings | 4 tests passed. `file_picker` desktop plugin metadata warnings remain. |
| Full API role simulation | Pass | 14/14 simulated flows passed: auth, admin CRUD, classroom, lesson, feed, quiz, whiteboard, parent, sync, and system checks. |
| Frontend role smoke | Pass | Student, teacher, parent, and admin pages rendered with no application console errors. |
| Mobile viewport smoke | Pass with UX notes | Student login/home works, but content is very large and requires deep scrolling. |
| ntfy integration | Pass after fix | API now publishes to internal `http://ntfy`, host access maps `localhost:2586` to container port `80`, and classroom events publish real ntfy messages. |

## What Is Working

### Student

- Demo student login works.
- Home dashboard shows live learning stats: attempted lessons, completed lessons, average score, streak, and quiz XP.
- Learn page now follows the desired flow: choose subject, choose topic, then view content and exercises.
- Content-first lessons are visible, including teacher-authored content blocks.
- Lesson completion gating works at API level: exercise submission is rejected before content review, then accepted after the lesson content is marked reviewed.
- Student progress updates after completed exercises and is visible in progress views.
- Student classroom list shows enrolled classrooms, latest classroom posts, teacher profile entry point, and leave class action.
- Student can see teacher posts inside classroom context and in the global posts feed.
- Student can see rich posts with GIF and embedded media cards. I created a temporary pinned post with a Giphy GIF and YouTube attachment, confirmed it rendered in the student feed, then deleted it.
- Student can comment on teacher posts and react to posts at API level.
- Student quiz history and quiz XP render in the UI.
- Student quiz access control works: enrolled students can join classroom quiz sessions, non-enrolled authenticated students are rejected, and guest joins remain available where allowed.
- Student can see whiteboard availability/history at API level when enrolled.

### Teacher

- Demo teacher login works.
- Teacher dashboard renders.
- Teacher profile page works and shows the public-facing teacher summary, tags, years, location, classes, students, and posts.
- Teacher profile update API works, and students can view the updated public teacher profile.
- Teacher classroom page renders active classes, join codes, student counts, latest posts, and post/profile actions.
- Teacher classroom CRUD works at API level.
- Teacher lesson page renders lesson list with create, preview, assign, edit, and delete controls.
- Teacher-authored lesson CRUD works at API level, including update and delete.
- Lesson assignment and unassignment to classrooms works at API level.
- Lesson preview opens and shows section/text/embed content blocks.
- Teacher posts page renders create, edit, delete, comments, reactions, and media cards.
- Teacher can create rich posts with image/file/GIF/embed attachments at API level.
- Realtime feed event works through Redis/WebSocket; the simulation received `CONNECTED`, `AUTH_SUCCESS`, `PRESENCE`, and `NEW_POST`.
- Teacher quiz page renders deck creation, deck edit/delete, live room start, and join controls.
- Quiz deck CRUD and live session flow work at API level.
- Teacher whiteboard page renders active sessions, recent sessions, attach recording, end session, and start session controls.
- Whiteboard session start, duplicate prevention, student access, recording attachment, ending, and history retrieval work at API level.

### Parent

- Demo parent login works.
- Parent dashboard shows linked child and live child progress.
- Children page shows linked student account and student ID.
- Parent progress page shows child stats by subject.
- Parent posts page shows teacher classroom posts for the linked child.
- Parent can engage with classroom posts at API level, including reactions and comments.
- Parent visibility is correctly scoped through active parent-student links and child classroom enrollments.

### Admin

- Demo admin login works.
- Admin system page shows API, database, Redis health, and platform totals.
- Admin users page renders filters, role filters, add user, edit, and disable controls.
- Admin user CRUD works at API level, including role, status, password update, and parent-student links.
- Admin classroom page renders active classrooms, edit, students/enrollment, disable controls, and class totals.
- Admin classroom CRUD and enrollment management work at API level.
- Admin syllabus page renders add/edit/delete controls.
- Admin syllabus CRUD works at API level.
- Admin lessons page renders create, preview, assign, edit, and delete controls.
- Admin lesson CRUD and assignment flow work at API level.
- Admin system health and cache clear work at API level.

### Platform Services

- PostgreSQL and Redis are connected from the API.
- MinIO health check passes and storage upload/list/delete works at API level.
- Centrifugo health check passes.
- Keycloak health endpoint responds.
- Caddy serves the Flutter web app and proxies `/api`.
- Sync endpoints work for push/pull/device registration at API level.

## What Is Not Fully Working Or Needs Improvement

### 1. ntfy Notification Publishing

Status: Production-ready backend publishing added after this QA finding.

Findings:

- `http://ntfy/v1/health` and `http://ntfy:80/v1/health` are healthy from inside Docker.
- API container now uses `NTFY_URL=http://ntfy` instead of the host-mapped port.
- Host `localhost:2586` is mapped to container port `80` for local ntfy browser/app access.
- Backend notification publishing now covers classroom post creation, lesson assignment, quiz lobby/start, and whiteboard session start.
- Admin notification health and smoke-test endpoints are available at `/admin/notifications/health` and `/admin/notifications/test`.

Impact:

- ntfy is now a real platform notification channel for classroom activity.
- Mobile subscription UX, notification preferences, and iOS/APNS tradeoffs remain separate product work.

Operational notes:

- Students and parents can subscribe to classroom topics using the configured `NTFY_PUBLIC_URL` and `NTFY_TOPIC_PREFIX`.
- Keep classroom topic names hard to guess and restrict ntfy auth if this is exposed beyond local/demo use.

### 2. Media Access Control Is Still MVP-Level

Status: Working for demos, not strong enough for private classroom media.

Findings:

- Upload and delete are authenticated.
- Public media streaming uses `/api/storage/public/:id` without authentication.
- The file ID is random and hard to guess, but access is not checked against classroom enrollment, parent-child links, or teacher ownership.

Impact:

- Good enough for temporary demo content.
- Not good enough for real student/teacher uploads if private classroom media matters.

Operational notes:

- Replace public classroom media URLs with authenticated download URLs or signed short-lived URLs.
- Check access based on post/classroom ownership before streaming private media.

### 3. Whiteboard Recording Is Partially Verified

Status: API flow works; real browser recording/playback still needs deeper QA.

Findings:

- API simulation verified session start, duplicate active-session prevention, student access, recording attachment, session end, and history retrieval.
- The current demo database has multiple active whiteboard sessions from prior QA/demo runs.
- UI shows an active session and recent sessions, but this pass did not record an actual canvas session through `MediaRecorder` and play it back.

Impact:

- Whiteboard session management is alive.
- Recording should not yet be considered production-grade until browser recording, upload progress, playback, and cleanup are tested end-to-end.

Operational notes:

- Add a browser E2E test that draws on the whiteboard, records a short clip, uploads it, ends the session, and replays the saved recording.
- Add a cleanup/admin control for stale active whiteboard sessions.

### 4. External Video Embed UI Has A Layout Bug

Status: Functional, but visually flawed.

Findings:

- External video parsing tests pass for YouTube and supported providers.
- Teacher lesson preview rendered a YouTube embed successfully.
- The preview also left a large white region below the video iframe in the full-page capture.

Impact:

- Students/teachers can see embedded videos, but the preview looks unfinished and can create excessive scrolling.

Recommended fix:

- Constrain embeds with a stable aspect ratio and maximum height.
- Clip or theme iframe backgrounds so white provider space does not dominate the dark UI.
- Add visual regression screenshots for lesson preview embeds.

### 5. Database Hygiene Needs A Reset/Cleanup Strategy

Status: App works, but QA/demo data can become noisy.

Findings:

- The database currently contains inactive QA rows from previous runs.
- Current counts included inactive users, inactive classrooms, inactive posts, and multiple whiteboard sessions.
- Admin UI correctly filters active records, but old evaluation accounts and soft-deleted rows make manual QA harder to interpret.

Impact:

- Not a user-facing bug when filters are correct.
- It makes QA confusing and can inflate admin/system totals.

Recommended fix:

- Add `npm run db:reset-demo` or `npm run db:clean-qaqc`.
- Make QA simulations tag all generated records and hard-delete those records after the run, or run them against a separate test database.
- Add an admin-only stale session cleanup action.

### 6. Frontend CRUD Needs Automated E2E Coverage

Status: UI controls exist; API CRUD is verified; full UI form save automation is not complete.

Findings:

- Create/edit/delete controls render for teacher lessons, teacher posts, teacher quizzes, admin users, admin classrooms, admin syllabus, and admin lessons.
- CRUD behavior passed through API simulations.
- Because Flutter web renders mostly as canvas, normal Playwright selectors cannot inspect or fill most controls reliably.

Impact:

- The app can be manually operated, and backend behavior is solid.
- Regression testing the actual forms will be harder until the app exposes semantic labels/test hooks or uses Flutter integration tests.

Recommended fix:

- Add Flutter integration tests for the most important create/edit/delete forms.
- Enable semantics/test labels where practical for web E2E.
- Prioritize UI E2E for teacher lesson creation, teacher post creation with attachments, admin user creation, and admin classroom enrollment.

### 7. Mobile UX Is Functional But Heavy

Status: Working, needs refinement.

Findings:

- Mobile login and student home work.
- The mobile student dashboard uses very large cards and typography; only a small portion of useful learning content appears above the fold.
- Bottom navigation is clear, but the full-page capture shows the nav sitting over a light strip at the bottom.

Impact:

- Usable, but it feels less like a fast daily-learning app on mobile.

Recommended fix:

- Tighten mobile card heights and stat cards.
- Show next lesson/action earlier on the mobile home page.
- Verify bottom safe-area/background styling on mobile web and mobile app builds.

### 8. Keycloak Auth Integration

Status: Production-ready integration added after this QA finding.

Findings:

- Keycloak service responds.
- Flutter web has a `Continue with Keycloak` path.
- The API starts authorization-code + PKCE login, stores verifier state in Redis, exchanges the callback code, verifies Keycloak JWKS-signed tokens, links/provisions a local user, and returns the normal app JWT.
- Existing email/password login remains available for local/demo accounts.
- Protected backend routes can resolve either the app JWT or a valid Keycloak bearer token issued for the configured client.

Impact:

- Keycloak can now be documented as a current web-auth feature, not just future infrastructure.
- Existing local users are preserved and can be linked by email or Keycloak subject.

Operational notes:

- Rebuild/restart Docker after the Caddy and Keycloak `/auth` proxy changes.
- Existing Keycloak volumes may need the `eduapp-api` client redirect URI updated to include `/keycloak-callback`, or the realm recreated/imported.

## Current Database Snapshot

From the live Docker database during QA:

| Record | Count |
| --- | ---: |
| Active admins | 3 |
| Active parents | 2 |
| Active students | 3 |
| Active teachers | 2 |
| Inactive parents | 4 |
| Inactive students | 8 |
| Inactive teachers | 4 |
| Active classrooms | 4 |
| Inactive classrooms | 15 |
| Lessons | 21 |
| Active posts | 5 |
| Inactive posts | 10 |
| Progress rows | 8 |
| Media files | 7 |
| Active whiteboard sessions | 7 |
| Ended whiteboard sessions | 7 |

This confirms the app has live data, but also confirms the need for a repeatable QA cleanup/reset command.

## Priority Fix List

1. Fix ntfy URL/port configuration and implement real notification publishing.
2. Tighten media access control for private classroom files.
3. Fix embedded video sizing in lesson preview and student lesson view.
4. Add stale whiteboard session cleanup and a real recording/playback E2E test.
5. Add Flutter integration tests for teacher/admin CRUD forms.
6. Add a demo/test database reset command to remove stale QA residue.
7. Improve mobile dashboard density so students reach the next learning action faster.

## Verdict

The system is no longer just a static prototype. Core role flows are functional across backend and web UI:

- Students can learn, see content, complete gated exercises, join classrooms, see posts, engage, and track progress.
- Teachers can manage profile, classrooms, lessons, posts, quizzes, and whiteboard sessions.
- Parents can monitor linked children and classroom activity.
- Admins can manage users, classrooms, syllabus, lessons, and system state.

The biggest remaining gaps are not the core CRUD flows. They are production-readiness issues around notification wiring, private media access, embedded media polish, whiteboard recording depth, and automated UI regression coverage.
