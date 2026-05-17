# W18 Flutter Web All-Roles Smoke QA/QC

- Workstream: W18
- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w18-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Env snapshot read: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md`
- Base stack from snapshot: `http://localhost`
- Flutter build used: `D:\2026\tusyen\flutter_app\build\web`
- Flutter artifact observed: `main.dart.js`, 3,389,196 bytes, last write `2026-05-17T22:39:41.3892980+08:00`
- Result: PASS with setup caveats

## Summary

Legacy v1 Flutter web rendered successfully and the primary role dashboards loaded for student, teacher, parent, and admin demo accounts. One CRUD-style action was completed per role through the Flutter web UI.

The plain static server path is not sufficient because the built Flutter app calls relative `/api/*` routes. A temporary local QA proxy was used at `http://localhost:61819` to serve `flutter_app/build/web`, strip `/api` to the running backend at `127.0.0.1:3000`, and forward `/ws/*` WebSocket upgrades. No repo code or env files were edited.

## Accounts

| Role | Account | Result |
| --- | --- | --- |
| Student | `student@tusyen.test` / `password123` | PASS |
| Teacher | `teacher@tusyen.test` / `password123` | PASS |
| Parent | `parent@tusyen.test` / `password123` | PASS |
| Admin | `admin@tusyen.test` / `password123` | PASS |

## Role Smoke Results

| Role | Dashboard verification | CRUD verification | API evidence | Screenshots |
| --- | --- | --- | --- | --- |
| Student | Student dashboard loaded with assigned lessons, Learn/Classrooms/Quizzes/Posts/Progress nav, and user `Nur Aisyah Rahman`. | Submitted a reviewed lesson exercise with correct answers and reached `Exercise complete`, `Score 100`. | `POST /api/learning/lessons/5c43bc3d-5b6a-4349-8590-a3dbdcbe7c64/submit` returned `200`. | `screenshots/flutter/student/03-dashboard.png`, `screenshots/flutter/student/12-answers-selected.png`, `screenshots/flutter/student/13-submit-result.png` |
| Teacher | Teacher dashboard loaded with classroom counts, quiz room tools, and user `Cikgu Farah Aziz`. | Created a classroom feed post from the Posts tab. New post is visible in feed after scroll. | `POST /api/feed/posts` returned `200`. | `screenshots/flutter/teacher/01-dashboard.png`, `screenshots/flutter/teacher/04-create-post-filled.png`, `screenshots/flutter/teacher/07-post-feed-scrolled.png` |
| Parent | Parent dashboard loaded with linked learner `Nur Aisyah Rahman`, progress cards, and user `Encik Azlan Rahman`. | Added a parent comment to a classroom feed post. New comment is visible under the post. | `POST /api/feed/posts/bebf1de5-2520-4c6b-914b-a3b5ee4a6def/comments` returned `200`. | `screenshots/flutter/parent/01-dashboard.png`, `screenshots/flutter/parent/06-comment-filled-retry.png`, `screenshots/flutter/parent/07-comment-send-retry.png` |
| Admin | Admin dashboard loaded with platform stats, Users/Classrooms/Syllabus/Lessons/System nav, and user `Puan Nabila Hassan`. | Created a new active student user from Admin > Users. New user appears at the top of the Users list. | `POST /api/admin/users` returned `200`. | `screenshots/flutter/admin/01-dashboard.png`, `screenshots/flutter/admin/04-add-user-filled.png`, `screenshots/flutter/admin/06-add-user-created.png` |

## Visual Regressions / Deltas vs Current React App

| Area | React app reference | Flutter v1 observation | Severity |
| --- | --- | --- | --- |
| Visual system | React login uses a lighter, cleaner card layout with explicit API health, language toggle, and visible demo-role buttons. | Flutter uses the older dark game-style landing page with larger decorative panels and no visible API health/language/demo-role shortcuts. This is coherent with legacy v1, but visually less operationally clear. | P3 |
| Accessibility / automation surface | React exposes normal form fields and buttons to DOM/Playwright selectors. | Flutter web is canvas-heavy; Browser DOM snapshots were empty or only exposed transient hidden inputs. This makes QA automation and assistive inspection materially worse than React. | P2 |
| Density / viewport fit | React login is compact and centered. | Flutter desktop dashboards rely on a persistent left rail and dense cards; several flows require precise scrolling to reveal action buttons, especially student exercise and feed comments. | P3 |
| Role affordances | React login exposes role shortcuts directly. | Flutter requires credential entry for every role and does not surface admin demo affordance on the primary login screen. | P3 |

## Defects / Caveats

### 1. Flutter build needs an API proxy; plain static hosting breaks login

- Role/Screen: All roles / Flutter web build hosting
- Severity: P2
- Repro: Serve `flutter_app/build/web` with a plain static server, open the app, enter a demo account, and submit login.
- Expected: Flutter build can reach the backend API, or the run path clearly provides `/api/*` proxying.
- Actual: The app posts to `/api/auth/login` on the static origin. A plain static server returns `501 Unsupported method ('POST')`, leaving the user on the login page.
- Suspected file: `Caddyfile` / Flutter web deployment wiring
- Screenshot: `screenshots/flutter/student/02-after-login-submit.png`

### 2. Flutter web exposes poor semantic automation/accessibility surface compared with React

- Role/Screen: All roles / Flutter canvas UI
- Severity: P2
- Repro: Open Flutter web and inspect with Browser plugin DOM snapshots or locator-based automation.
- Expected: Login fields, nav items, and action buttons expose stable semantic controls comparable to the React app.
- Actual: Browser DOM snapshots were empty or limited to hidden/transient inputs and an `Enable accessibility` placeholder. UI testing required coordinate-based interaction.
- Suspected file: `flutter_app/lib/main.dart` / Flutter web renderer/accessibility configuration
- Screenshot: `screenshots/flutter/student/00-login.png`

## Additional Notes

- Browser plugin was attempted first. It could navigate and inspect limited Flutter state, but screenshot capture timed out on the Flutter canvas after login interaction, so Playwright was used for reliable screenshots and role interaction.
- WebSocket forwarding was added to the temporary QA proxy after initial student dashboard login exposed artificial `ws://localhost:61819/ws/classroom/...` handshake errors. After forwarding `/ws/*`, role checks proceeded without treating proxy-induced socket failures as product defects.
- Existing worktree changes were not reverted. No commits or env edits were made.
