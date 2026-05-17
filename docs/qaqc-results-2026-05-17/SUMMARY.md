# Tusyen Full QA/QC Summary - 2026-05-17

- Repository: `D:\2026\tusyen`
- Base URL tested: `http://localhost`
- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Environment snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Workstream reports: `docs/qaqc-results-2026-05-17/w*.md` and `docs/qaqc-results-2026-05-17/l*.md`
- Screenshots: `docs/qaqc-results-2026-05-17/screenshots/`

## Overall status

RED. The platform is not release-ready.

The stack booted, migrations 001-015 were applied, the React bundle built, backend unit tests passed, Flutter tests/build passed, and the smoke suite passed. The deeper QA pass found release-blocking issues in auth/session stability, Keycloak callback, teacher/admin UI, live quiz, storage/sync, authorization, and learning/quiz review flows.

## Severity normalization and counts

| Source labels | Normalized release severity |
|---|---|
| `Critical`, `P0`, `Blocker` | Blocker |
| `High`, `P1`, `Major` | Major |
| `Medium`, `P2`, `Minor` | Minor |
| `Cosmetic` | Cosmetic |

| Severity | Count |
|---|---:|
| Blocker-equivalent | 10 |
| Major-equivalent | 53 |
| Blocker + Major total | 63 |
| Minor-equivalent | 107 |
| Cosmetic | 0 |

## Coverage matrix

| Workstream | Result | Key issues |
|---|---|---|
| W1 Backend unit/integration | PASS | 14 files and 57 tests passed. npm audit warnings only. |
| W2 Flutter tests/build | PASS | `flutter pub get`, `flutter test`, CRUD E2E, and web build passed. |
| W3 Playwright smoke | PASS | 9 smoke tests passed; language switch 5 passed, 1 skipped by spec. |
| W4 Full regression | FAIL | Browser regression passed, but four QA users leaked in DB. |
| W5 Auth/Keycloak | FAIL | Keycloak PKCE happy callback returns 401 after real auth code. |
| W6 Admin API | PASS | 34/34 routes covered, 88 request assertions passed. |
| W7 Learning/progress API | FAIL | Catalog metadata, best-score retention, and streak harness failed. |
| W8 Feed/realtime API | PARTIAL | WebSocket event names mismatch and per-reaction counts missing. |
| W9 Classroom lifecycle | PASS | 26/26 checks passed. |
| W10 Live quiz API | NOT READY | Student session list 500, hearts not deducted, WS contract mismatch. |
| W11 Whiteboard | FAIL | Student ended-session history not visible; draw payload order mismatch. |
| W12 Storage/sync | FAIL | Internal MinIO URLs, bad MIME accepted, oversize accepted, sync pull mismatch. |
| W13 PWA/SW | FAIL | Missing 192/512 PNG icons break A2HS; SW/offline shell passed. |
| W14 Student UI | FAIL | Exercise render/submit, quiz PIN auth, posts, realtime update issues. |
| W15 Teacher UI | FAIL | Session instability, profile, lessons, posts, quiz, whiteboard blockers. |
| W16 Parent UI | FAIL | Reaction state, teacher profile link, auth-state inconsistency, media previews. |
| W17 Admin UI | FAIL/BLOCKED | Parent links, classrooms, syllabus, lessons, system cache, mobile blockers. |
| W18 Flutter web smoke | PASS WITH CAVEATS | CRUD smoke passed; static hosting and semantic accessibility caveats. |
| W19 i18n | FAIL | Language state persists, but English mode still exposes BM literals across roles. |
| L1 Student learning flow | FAIL | Empty topic state, missing attempts/best score/time, incomplete review. |
| L2 Quiz flow | NOT READY | PIN copy missing, hearts not deducted, summary defect confirmed, rejoin broken. |
| L3 Teacher content flow | FAIL | Teacher lesson publish blocked; only two question types exposed; student visibility broken. |
| L4 Parent flow | PARTIAL | Most checks passed; teacher post UI does not reveal parent comment body. |
| L5 Admin provisioning flow | PARTIAL | Backend provisioning works via API fallback; admin UI/session and propagation defects remain. |
| W20 Authorization matrix | FAIL | 107 routes, 749 cells, 102 mismatches, 11 high-severity bypass candidates. |
| W21 Production hardening | PASS WITH DEFECT | Required toggles passed in isolated env; Keycloak allows localhost in production allowlist. |
| W22 WebSocket security | FAIL | No-token classroom WS upgrades and remains idle instead of rejecting promptly. |
| W23 Input validation/abuse | FAIL | Oversize upload accepted/truncated; presigned URL preserves `../`. XSS render checks passed. |

## Blocker defects

| ID | Source | Defect | Expected | Actual | File/route | Owner |
|---|---|---|---|---|---|---|
| B1 | W5 | Keycloak PKCE callback returns 401 after real authorization code | Exchange code, provision/link local user, return JWT and refresh token | `/api/auth/keycloak/callback` returns 401 | `backend/src/auth/keycloak.ts`, `backend/src/auth/routes.ts`, Keycloak client config | Backend/auth |
| B2 | W7 | Streak coverage blocked by wrong DB role in harness | W7 streak checks complete | `eduuser` role missing, coverage aborted | W7 harness DB command | QA automation |
| B3 | W15 | Teacher session instability and role-shell switch | Teacher remains teacher across desktop/mobile reloads | `Invalid refresh token`, mobile reload switches into parent shell | `web_app/app.js`, `web_app/components/teacher.jsx` | Web/auth |
| B4 | W15 | Teacher profile edit unsafe | Teacher profile loads and saves safely | Blank/error profile state with `Only teachers have profile pages` | `web_app/components/teacher.jsx` | Web/teacher |
| B5 | W15 | Teacher live quiz host path blocked | PIN displayed/copyable, session start/edit/delete work | No copyable PIN, auth/start errors, edit blanks questions, delete errors | `web_app/components/quiz.jsx`, `web_app/components/teacher.jsx`, `backend/src/quiz/routes.ts` | Web/quiz, backend quiz |
| B6 | W17 | Admin classrooms tab fails to load | Existing classrooms load and admin can manage them | Classroom surface fails to load | `web_app/components/admin.jsx`, `/api/admin/classrooms` | Web/admin |
| B7 | W17 | Admin syllabus CRUD blocked | Authenticated admin can create/publish syllabus | `Admin access required` from visible admin shell | `web_app/components/admin.jsx`, `backend/src/admin/routes.ts` | Web/admin, backend/admin |
| B8 | W17 | Admin advanced lesson authoring/publish blocked | Required question types and publish path work | Advanced types/publish path blocked | `web_app/components/admin.jsx` | Web/admin content |
| B9 | W17 | Admin cache clear blocked | Cache clear succeeds with controlled result | Admin-access failure in UI | `web_app/components/admin.jsx`, `/api/admin/cache/clear` | Web/admin |
| B10 | W17 | Admin mobile pass blocked by instability | Mobile admin reaches same critical CRUD actions | Mobile admin validation blocked/partial | `web_app/components/admin.jsx` | Web/admin |

## Major defect groups

| Group | Sources | Defects |
|---|---|---|
| Learning/progress | W7, L1, W14 | Missing catalog metadata, best-score regression, empty History topic, missing attempt/best-score/time details, exercise options render as A/B/C/D only, student exercise submit rejected by role. |
| Live quiz | W10, L2, W14, W20 | Student classroom session listing returns 500, wrong answers do not decrement hearts, WS event contract mismatch, PIN copy confirmation missing, finished-session rejoin errors, non-student quiz summaries accessible. |
| Baseline quiz review | L2 | Student post-game summary omits the student's selected answer, correct answer, and explanation per question. Fix around `web_app/components/quiz.jsx:1027`, where `ResultsScreen` renders aggregate `questionAccuracy`; backend likely needs participant-specific review payload from `backend/src/quiz/routes.ts` or `backend/src/quiz/store.ts`. |
| Feed/realtime/posts | W8, W14, W16, L4 | `NEW_COMMENT`/`REACTION_UPDATED` contract mismatch, missing per-reaction counts, student post discussion server error, realtime feed requires reload, parent reactions stale, teacher profile link from parent posts fails, teacher cannot expand parent comment body. |
| Storage/sync/security | W12, W23 | Signed download URL points to internal `http://minio:9000`, executable MIME accepted, oversized upload accepted/truncated, `student_notes` sync pull misses pushed note, presigned upload URL preserves `../`. |
| Whiteboard/WebSocket | W11, W22 | Ended whiteboard sessions not visible in student UI, rapid draw payload order mismatch, no-token classroom WS upgrades and idles. |
| Teacher content/UI | W15, L3, L5 | Lesson preview/assign broken, media/edit/delete controls broken, whiteboard end/upload incomplete, teacher cannot publish authored lesson, only MCQ/true-false exposed, true/false text normalization changes meaning, assigned lessons not visible as assigned. |
| Admin UI/provisioning | W17, L5 | Parent-link comboboxes empty, classrooms/enrollment blocked, system health incomplete, privileged admin actions can fail with `Admin access required`, classroom create can 500 on `formLevel`, syllabus delete silently deactivates referenced syllabus. |
| Authorization | W20 | 11 high-severity bypass candidates: learning catalog accessible where matrix expected denial, foreign progress access returns 200, quiz summary leakage, `/quiz/me/summary` available to non-students, and `/broadcast/:classroomId` accepts student/parent/foreign scope. |
| Production hardening | W21 | Production redirect allowlist still permits localhost defaults even when exact production origins are configured. |
| i18n/PWA/caveats | W13, W18, W19 | A2HS fails due missing PNG icons; Flutter web passes smoke but has proxy/accessibility caveats; English mode still exposes many Bahasa Malaysia literals. |

## Baseline known defect and fix proposal

The required baseline defect was confirmed in L2.

- Role/Screen: Student / Live quiz final summary (`Tamat` result screen)
- Severity: Major
- Repro: Teacher hosts a live quiz, student answers, teacher ends session, student views final summary.
- Expected: Each question shows the student's selected answer, the correct answer, correctness, and explanation when present.
- Actual: Student sees aggregate leaderboard/accuracy style summary, but not per-question selected/correct answer review.
- Current frontend location: `web_app/components/quiz.jsx:1027` through `web_app/components/quiz.jsx:1044` renders `Accuracy By Question` from `results.questionAccuracy` with only question text, percent, correct count, answer count, and no-answer count.
- Fix proposal: Extend quiz results payload with participant-specific review rows containing `questionText`, `selectedAnswerText`, `correctAnswerText`, `isCorrect`, and `explanation`; render those rows in `ResultsScreen` for students. Keep aggregate accuracy for teachers. Backend likely needs changes in `backend/src/quiz/routes.ts` or `backend/src/quiz/store.ts` so the frontend does not infer answers from incomplete deck/session state.

## Recommended next actions

1. Fix auth/session foundations first: teacher/admin role persistence, refresh-token handling, admin shell API auth, and Keycloak PKCE callback.
2. Fix quiz end-to-end: student session listing, PIN copy, hearts decrement, finished-session rejoin, WS event contract, and the required answer review.
3. Fix storage/sync security: external signed URLs, MIME rejection, truncated-upload rejection, presigned-key sanitization, and `student_notes` pull.
4. Fix role UI blockers: teacher lesson authoring/publishing, admin classroom/syllabus/lesson/system surfaces, student exercise submit, parent reactions/profile links.
5. Re-run W20 after core fixes with a cleaned matrix harness, then rerun W1/W3/W4/W10/W12/W14-W17/L1-L5 as release gates.

## Untested / out-of-scope / partial boundaries

- No workstream was intentionally skipped.
- Maximum sub-agent concurrency was 6 due runtime thread limit, so workstreams ran in a rolling queue instead of 28-way parallel execution.
- W4 full regression browser test passed, but step timings were lost because shared Playwright artifacts were overwritten by concurrent suites; W4 failed on leaked QA users.
- W7 streak-specific checks did not complete because the harness used DB role `eduuser`, which does not exist in this stack.
- W18 Flutter smoke passed, but automation quality is limited by Flutter canvas semantics and was not equivalent to deep React UI QA.
- W20 includes lower-signal mismatches caused by runner/setup issues such as multipart `FormData` availability and quiz join rate limiting; its high-signal authz findings remain release relevant.
- W21 used temporary process-level production env and did not edit production `.env`, rebuild a production image, or validate a real public TLS hostname.
- W23 attempted Browser first but used local Playwright Chromium for rendered XSS verification after Browser control failed.
- No global cleanup was performed from Stage 5; several workstreams intentionally left namespaced test data for traceability.

## Release decision

RED. Do not ship or demo as release-ready until blocker-equivalent auth/admin/teacher/quiz issues and major storage/authz/learning issues are fixed and re-run.
