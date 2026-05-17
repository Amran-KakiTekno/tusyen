# Implementation Plan — Feature Spec Gap Closure
**Source:** `docs/feature-spec.md`  
**Date:** 2026-05-18  
**Author:** Planning agent

---

## Scope

Work is drawn from the Issue Registry (Section 20) and the per-feature gap lists.  
Items are ordered by severity: 🔴 Critical → 🟠 High → 🟡 Medium → 🔵 Low.  
Design-only items (⚪) and explicitly out-of-scope features (Flutter offline cache, RTL) are deferred.

---

## Execution Waves

### Wave 0 — Blocking (DB migrations & schema fixes, must run before anything else)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 0.1 | Add `UNIQUE(session_id, display_name)` to guest quiz participants | `database/migrations/018_guest_quiz_unique.sql` | New migration adding partial unique index on `quiz_session_participants(session_id, display_name) WHERE user_id IS NULL`. | `[BLOCKING]` | `[DONE]` |
| 0.2 | Add `parent_alert_statuses` table to migrations | `database/migrations/019_parent_alert_statuses.sql` | Extract the ad-hoc `CREATE TABLE IF NOT EXISTS parent_alert_statuses` from `auth/routes.ts` into a proper migration. Add FK on `user_id`. | `[BLOCKING]` | `[DONE]` |
| 0.3 | Add `(classroom_id, updated_at)` composite index on progress | `database/migrations/020_progress_classroom_index.sql` | `CREATE INDEX CONCURRENTLY idx_progress_classroom_updated ON progress(classroom_id, updated_at)`. Fixes DAT-07 and speeds up OPS-04 alert queries. | `[BLOCKING]` | `[DONE]` — note: `CONCURRENTLY` keyword was dropped (plain `CREATE INDEX`), which is fine for initial migration but locks the table briefly on first run. |
| 0.4 | Add `keycloak_subject` uniqueness per realm | `database/migrations/021_keycloak_subject_realm_unique.sql` | Drop existing unique index on `keycloak_subject`; add `UNIQUE(keycloak_subject, keycloak_realm)` to `users` table. Fixes SEC-01. | `[BLOCKING]` | `[DONE]` |

---

### Wave 1 — Parallel batch A: Security fixes (backend only, no UI dependency)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 1.1 | Fix Keycloak email-merge account takeover | `backend/src/auth/keycloak.ts` | At the upsert-user step (~line 427), scope the email lookup to the same `keycloak_realm`; reject cross-realm email matches with a 409 and log an audit event. Depends on 0.4. | `[PARALLEL]` | `[DONE]` — cross-realm check at lines 430–446; 409 thrown with audit event `auth.keycloak_realm_conflict`. |
| 1.2 | Remove hardcoded demo admin account | `backend/src/auth/routes.ts`, `backend/scripts/seed-demo.js` | Delete the hardcoded `admin@tusyen.test` fallback from routes.ts (~line 838). Move demo seed into `seed-demo.js` only, gated by `NODE_ENV !== production`. Fixes SEC-03. | `[PARALLEL]` | `[DONE]` — no match for `admin@tusyen.test` in routes.ts; seed-demo.js gated by env. |
| 1.3 | Replace Math.random join-code with crypto.randomBytes | `backend/src/classroom/routes.ts` | Replace `Math.random().toString(36).substring(2,8)` with `crypto.randomBytes(4).toString('hex').substring(0,6).toUpperCase()`. Fixes SEC-04. | `[PARALLEL]` | `[DONE]` — `generateClassCode()` now uses `randomBytes(4)`. |
| 1.4 | Fix CORS wildcard regex in production | `backend/src/index.ts` | Wrap the wildcard-subdomain regex inside `if (NODE_ENV !== 'production')`. In production, use the exact origins from `config.ts`. Fixes SEC-02. | `[PARALLEL]` | `[DONE]` — `originMatchesAllowed` returns false for wildcards in production (lines 229, 231). |
| 1.5 | Add rate limit to `/classroom/join-by-code` | `backend/src/classroom/routes.ts` | Add a Fastify rate-limit decorator specifically on the join-by-code route: 10 attempts per 5 min per IP. Fixes SEC-05 analogue for join codes. | `[PARALLEL]` | `[DONE]` — `enforceJoinByCodeRateLimit` wraps Redis-backed check, 10/300s per IP. |
| 1.6 | Fix Centrifugo allowed_origins for production | `centrifugo/config.json` | Add `CENTRIFUGO_ALLOWED_ORIGINS` env var support; document required values for production deployment. Fixes OPS-01. | `[PARALLEL]` | `[PARTIAL: config.json still hardcodes ["http://localhost","http://127.0.0.1"]; no env var substitution or env-var documentation was added. Production WebSocket connections will still fail.]` |
| 1.7 | Add trusted-proxy validation for X-Forwarded-For | `backend/src/auth/routes.ts` | Add `trustProxy` config check; validate `X-Forwarded-For` only when behind a trusted proxy. Fixes SEC-06. | `[PARALLEL]` | `[DONE]` — `isTrustedProxyRequest` checks `config.TRUSTED_PROXY_IPS`; X-Forwarded-For only consumed when IP matches. |

---

### Wave 1 — Parallel batch B: Data/logic fixes (backend, no UI dependency)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 1.8 | Implement STEM question scoring (lessons) | `backend/src/learning/routes.ts` | In `POST /learning/lessons/:id/submit`, add scoring branches for: `fill_blank`, `numeric`, `matching`, `step_order`, etc. Fixes DAT-02. | `[PARALLEL]` | `[DONE]` — full STEM scoring implemented in `learning/routes.ts` using the same patterns as `quiz/logic.ts`. |
| 1.9 | Implement STEM question scoring (quiz) | `backend/src/quiz/logic.ts` | Mirror lesson scoring logic in quiz answer evaluation. Fixes quiz STEM 0-score issue. | `[PARALLEL]` | `[DONE]` — `quizAnswersMatch` and `gradeQuizAnswer` handle all 14 question types including partial credit for pair types. |
| 1.10 | Trigger streak check on lesson submit | `backend/src/learning/routes.ts` | After a successful lesson submit, call `checkAndUpdateStreak(studentId)` internally. Fixes DAT-04. | `[PARALLEL]` | `[DONE]` — `checkAndUpdateStreak` called at line 820 after lesson submit. |
| 1.11 | Add pagination to `GET /progress/student/:id` | `backend/src/progress/routes.ts` | Add `limit`/`offset` query params; return total count in response header. Fixes DAT-03. | `[PARALLEL]` | `[PARTIAL: pagination was not added to the raw progress list route. The stats route is correct. The unbounded progress list endpoint still returns all rows.]` |
| 1.12 | Add cap to `GET /learning/catalog` limit | `backend/src/learning/routes.ts` | Enforce server-side max of 200 on the `limit` query param. Fixes catalog unbounded query. | `[PARALLEL]` | `[DONE]` — `LEARNING_CATALOG_LIMIT = 200` constant enforced server-side. |
| 1.13 | Add `rank` to student stats endpoint | `backend/src/progress/routes.ts` | Add a DENSE_RANK subquery returning best classroom rank for the student. Fixes FEAT-16. | `[PARALLEL]` | `[DONE]` — DENSE_RANK subquery added; result included in stats response at line 172. |
| 1.14 | Add weekly study time to student stats | `backend/src/progress/routes.ts` | Add `weekTimeSeconds` to stats query. Fixes FEAT-15. | `[PARALLEL]` | `[DONE]` — `weekTimeSeconds` returned via conditional SUM at line 109. |
| 1.15 | Add 7-day trend comparison to parent alerts/stats | `backend/src/auth/routes.ts` | Compute `avg_score_7d` vs `avg_score_prev_7d` per subject; include trend in alerts and child progress. Fixes FEAT-14. | `[PARALLEL]` | `[PARTIAL: trend computation added inside the alerts endpoint only (lines 821–859). The child progress / by-subject endpoint in progress/routes.ts does not return trend. Parent UI computes trend client-side from raw progress rows instead — functionally reasonable but not the planned API-driven approach.]` |
| 1.16 | Implement achievement award trigger | `backend/src/learning/routes.ts`, `backend/src/quiz/routes.ts` | Call `checkAndAwardAchievements(studentId)` after lesson submit and quiz end. Fixes FEAT-03. | `[PARALLEL]` | `[DONE]` — `checkAndAwardAchievements` defined in `learning/routes.ts` (line 1222) and called after lesson submit and streak check. |
| 1.17 | Implement hearts decrement on lesson/quiz fail | `backend/src/learning/routes.ts`, `backend/src/quiz/routes.ts` | Decrement `student_hearts` when score < 60 and not completed; add time-based regeneration. Fixes FEAT-04. | `[PARALLEL]` | `[DONE]` — heart decrement at line 1287; `regenerateStudentHearts` called with time-based restore logic. |
| 1.18 | Add `last_login` to admin user list | `backend/src/admin/routes.ts` | Include `last_login` column in `GET /admin/users`. | `[PARALLEL]` | `[DONE]` — confirmed `last_login` returned (updated in keycloak upsert path). |
| 1.19 | Cache parent alert queries | `backend/src/auth/routes.ts` | Cache alert computation per parent in Redis with 2-min TTL. Fixes OPS-04. | `[PARALLEL]` | `[DONE]` — Redis cache with 2-min TTL applied to alert computation. |
| 1.20 | Refresh materialized view on schedule / trigger | `backend/src/progress/routes.ts`, `backend/src/index.ts` | `setInterval` (5-min) in `index.ts` refreshes `student_classroom_stats`. Fixes DAT-05. | `[PARALLEL]` | `[DONE]` — `refreshStudentClassroomStats` called on startup and every 5 min via `setInterval` (lines 38–39, 172–174 of index.ts). |
| 1.21 | Add manual enrollment endpoint for admin | `backend/src/admin/routes.ts` | `POST /admin/classrooms/:id/enroll`. Fixes FEAT-08. | `[PARALLEL]` | `[DONE]` — endpoint present in admin routes; creates `classroom_enrollments` row. |
| 1.22 | Add parent-link admin endpoints | `backend/src/admin/routes.ts` | `POST /admin/parent-links` and `DELETE /admin/parent-links/:id`. Fixes FEAT-09 backend. | `[PARALLEL]` | `[DONE]` — both endpoints present; UI in admin.jsx wires to `adminParentLinks()`. |
| 1.23 | Add postgres backup cron to docker-compose | `docker-compose.yml` | Add `pg-backup` service running `pg_dump` daily. Fixes OPS-02. | `[PARALLEL]` | `[DONE]` — `pg-backup` service added with daily `pg_dump` and 7-day retention. |
| 1.24 | Add `POST /quiz/sessions/:id/cancel` endpoint | `backend/src/quiz/routes.ts`, `backend/src/quiz/store.ts` | Cancel transition with Redis cleanup and `quiz_session_cancelled` event. | `[PARALLEL]` | `[DONE]` — `POST /sessions/:sessionId/cancel` at line 427 of quiz/routes.ts; publishes `quiz_session_cancelled`. |

---

### Wave 2 — Parallel batch C: Web app UI fixes (depends on Wave 0 migrations being applied)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 2.1 | Implement Keycloak OAuth callback page | `web_app/index.html`, `web_app/app.js` | Add a `/keycloak-callback` route handler in the SPA router. Fixes FEAT-01. | `[PARALLEL]` | `[DONE]` — `handleKeycloakCallbackIfNeeded()` in app.js reads `?code=&state=`, calls `/api/auth/keycloak/callback`, stores tokens, redirects. |
| 2.2 | Add quiz timer pause button to teacher UI | `web_app/components/teacher.jsx` | Pause/Resume button calling `POST /quiz/sessions/:id/timer`. Fixes FEAT-02. | `[PARALLEL]` | `[DONE]` — `teacherQuizSessionPaused` helper and pause/resume toggle action wired; message string confirmed at line 4571. |
| 2.3 | Wire real leaderboard to student dashboard | `web_app/components/student.jsx` | Replace `LEADERBOARD_BASE` with live `/progress/classroom/:id/leaderboard` fetch. Fixes FEAT-10. | `[PARALLEL]` | `[DONE]` — `useClassroomLeaderboard` hook fetches live data; falls back to `LEADERBOARD_BASE` only for non-student roles (demo mode). |
| 2.4 | Wire achievements API to badge widget | `web_app/components/student.jsx` | Replace static badge array with `/progress/me/achievements`. Fixes FEAT-11. | `[PARALLEL]` | `[DONE]` — `useAchievements` hook calls `window.tusyenApi.myAchievements()`; loading skeleton rendered while fetching. |
| 2.5 | Wire syllabus topics to skill tree | `web_app/components/student.jsx`, `web_app/app.js` | Fetch syllabus and progress to compute done/current/locked states. Fixes FEAT-12. | `[PARALLEL]` | `[DONE]` — `useSyllabusNodes` hook fetches `/learning/syllabus` and `/progress/student/:id`; `buildSkillNodes` computes locked/done state. |
| 2.6 | Add comment input to student feed view | `web_app/components/student.jsx` | Render comment input below each feed post. Fixes FEAT-13. | `[PARALLEL]` | `[DONE]` — `submitComment` and comment-draft state present; comment input rendered in student feed with error state. |
| 2.7 | Implement edit classroom form (teacher) | `web_app/components/teacher.jsx` | Edit modal calling `PATCH /classroom/:id`. Fixes FEAT-05. | `[PARALLEL]` | `[DONE]` — edit form component present with `CLASS_FORM_LEVELS` guard and `save()` calling PATCH endpoint. |
| 2.8 | Expose "required" flag in lesson assignment UI | `web_app/components/teacher.jsx` | Checkbox for `is_required` in assignment panel. Fixes FEAT-06. | `[PARALLEL]` | `[DONE]` — `isRequired` passed through lesson assignment form to POST body. |
| 2.9 | Add edit user form in admin UI | `web_app/components/admin.jsx` | Edit modal for `full_name` and `role` calling `PATCH /admin/users/:id`. Fixes FEAT-07. | `[PARALLEL]` | `[DONE]` — `admin-user-edit-title` modal confirmed with `fullName` and `role` fields. |
| 2.10 | Add admin parent-link management screen | `web_app/components/admin.jsx` | "Parent Links" tab with create/deactivate. Fixes FEAT-09. | `[PARALLEL]` | `[DONE]` — `AdminParentLinksSection` component and "links" nav entry confirmed in admin panel. |
| 2.11 | Add admin manual enrollment UI | `web_app/components/admin.jsx` | "Enroll Student" input in classroom detail. Fixes FEAT-08. | `[PARALLEL]` | `[DONE]` — `addStudentId` input with "Enroll Student" label confirmed in classroom detail view. |
| 2.12 | Fix form level selector in create-classroom (teacher) | `web_app/components/teacher.jsx` | Restrict `CLASS_FORM_LEVELS` to `[4, 5]`. Fixes UX-01. | `[PARALLEL]` | `[DONE]` — `CLASS_FORM_LEVELS = [4, 5]` at line 91; inline validation at lines 3040 and 3951. |
| 2.13 | Auto-refresh classroom list after student join | `web_app/components/student.jsx` | Re-fetch classroom list after successful join. Fixes UX-10 for join flow. | `[PARALLEL]` | `[DONE]` — classroom list refreshed in-place after `join-by-code` success. |
| 2.14 | Add token refresh on tab focus | `web_app/app.js` | `visibilitychange` listener refreshes token if age > 45 min. Fixes stale token. | `[PARALLEL]` | `[DONE]` — `setupTokenRefreshOnVisibility` wired at line 112–119; called at line 765. |
| 2.15 | Fix `reactPost` undefined error | `web_app/app.js` | Add `window.tusyenApi.reactPost()` stub. Fixes FEAT-18. | `[PARALLEL]` | `[DONE]` — `reactPost` defined at line 602; calls `/feed/posts/:id/reactions`. |
| 2.16 | Add inline video embed component | `web_app/components/shared.jsx` | `VideoEmbed` component with `<iframe>` lazy loading for YouTube/Vimeo/Loom. Fixes FEAT-17. | `[PARALLEL]` | `[DONE]` — `VideoEmbed` and `isVideoEmbedUrl` exported at line 700 and 1952. |
| 2.17 | Add loading state for hearts display | `web_app/components/student.jsx` | Skeleton while hearts API loads; remove null flash. | `[PARALLEL]` | `[PARTIAL: hearts value in DEMO_STUDENT_STATS and EMPTY_STUDENT_STATS still hardcoded as null (lines 505, 516). A loading skeleton for the hearts widget was not confirmed — needs verification in the rendered card.]` |
| 2.18 | Fix student greeting to honour language setting | `web_app/components/student.jsx` | `getGreeting()` uses `tStudent()` helper. Fixes UX-03. | `[PARALLEL]` | `[DONE]` — `getGreeting()` calls `tStudent()` which reads language from localStorage/DOM at lines 120–125. |
| 2.19 | Fix PIN entry to numeric-only | `web_app/components/student.jsx` | `inputMode="numeric"` and `pattern="[0-9]*"`. Fixes UX-05. | `[PARALLEL]` | `[DONE]` — both attributes present at line 1878–1879. |
| 2.20 | Auto-scroll feed after new post | `web_app/components/teacher.jsx` | `scrollIntoView` after post creation. Fixes UX-06. | `[PARALLEL]` | `[DONE]` — scroll-after-create wired in teacher feed. |
| 2.21 | Show error feedback on comment submit | `web_app/components/teacher.jsx`, `web_app/components/student.jsx` | Replace `catch {}` with user-visible error. | `[PARALLEL]` | `[DONE]` — `setPostError` called in catch block for comment submit in student component; teacher component updated similarly. |
| 2.22 | Fix "—" vs "0%" for classroom with no progress | `web_app/components/teacher.jsx` | Show "0%" (muted) instead of "—" when `average_progress === null`. Fixes UX-04. | `[PARALLEL]` | `[DONE]` — null-average handled in teacher classroom card display. |
| 2.23 | Fix follow-up action label in parent UI | `web_app/components/parent.jsx` | Rename label and add tooltip. Fixes UX-08. | `[PARALLEL]` | `[DONE]` — alert action label reads "Tandai untuk tindak lanjut" at line 856; tooltip text confirmed in parent component. |
| 2.24 | Add audit page load-more in admin | `web_app/components/admin.jsx` | "Load more" button on audit log with offset fetch. | `[PARALLEL]` | `[DONE]` — load-more wired to admin audit log section. |

---

### Wave 3 — Parallel batch D: i18n / translation pass (depends on Wave 2 UI having final strings)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 3.1 | i18n pass — teacher.jsx | `web_app/components/teacher.jsx` | Wrap all hardcoded Malay strings in `t(ms, en)`. Add missing entries to `STATIC_TRANSLATIONS` in shared.jsx. Fixes UX-02 (teacher portion). | `[PARALLEL]` | `[DONE]` — `t()` wrappers confirmed throughout teacher component including new form strings, quiz pause labels, and edit-classroom form. |
| 3.2 | i18n pass — parent.jsx | `web_app/components/parent.jsx` | Same as 3.1 for parent component. | `[PARALLEL]` | `[DONE]` — parent component uses `t()` / `parentText()` helpers; alert action labels and preferences screen covered. |
| 3.3 | i18n pass — admin.jsx | `web_app/components/admin.jsx` | Same as 3.1 for admin component. | `[PARALLEL]` | `[DONE]` — admin nav labels, screen titles, and new Parent Links / Enroll screens all use `t()`. |
| 3.4 | i18n pass — student.jsx | `web_app/components/student.jsx` | Same as 3.1 for student component; badge descriptions and skill-tree sub-labels. | `[PARALLEL]` | `[DONE]` — `tStudent()` used throughout; skill-tree `subEn` fields populated for all subjects. |

---

### Wave 4 — Sequential: QA test coverage (depends on all feature implementations)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 4.1 | Backend unit tests — STEM scoring | `backend/test/quiz.logic.test.ts`, `backend/test/learning.routes.test.ts` | Test cases for fill_blank, numeric, matching, step_order scoring. | `[SEQUENTIAL]` | `[DONE]` — 15 STEM-type matches confirmed in quiz.logic.test.ts; learning.routes.test.ts also updated. |
| 4.2 | Backend unit tests — achievements & hearts | `backend/test/progress.routes.test.ts` | Test achievement creation on lesson submit; hearts decrement on failure. | `[SEQUENTIAL]` | `[DONE]` — 10 matches for achievement/hearts in progress.routes.test.ts. |
| 4.3 | Backend unit tests — admin new endpoints | `backend/test/admin.routes.test.ts` | Test manual enrollment, parent-link CRUD, user edit. | `[SEQUENTIAL]` | `[PARTIAL: only 3 matches found in admin.routes.test.ts for parent-link/enroll. Coverage for the user-edit PATCH endpoint and full create/deactivate parent-link cycle not confirmed.]` |
| 4.4 | E2E: Keycloak callback flow (Playwright mock) | `tests/qaqc/full-feature-regression.spec.ts` | Route intercept test for `/keycloak-callback`. | `[SEQUENTIAL]` | `[DONE]` — test at lines 21–43 intercepts `/api/auth/keycloak/callback`, navigates to `/keycloak-callback?code=mock-code&state=mock-state`, asserts token stored. |
| 4.5 | E2E: Quiz timer pause/resume | `tests/qaqc/full-feature-regression.spec.ts` | Teacher session: advance → pause → verify → resume → end. | `[SEQUENTIAL]` | `[DONE]` — test at line 731 POSTs to `/timer` with `action: pause`, asserts `questionPausedAt` set and `questionRemainingMs > 0`. |
| 4.6 | E2E: Parent alert generation | `tests/qaqc/full-feature-regression.spec.ts` | Low-score scenario → alert endpoint → verify type/severity/status. | `[SEQUENTIAL]` | `[DONE]` — alert generation test present in full-feature-regression spec. |
| 4.7 | E2E: Classroom join rate-limit | `tests/qaqc/platform-health.spec.ts` | 11 rapid join attempts → assert 429 on 11th. | `[SEQUENTIAL]` | `[DONE]` — `rate-limits classroom join-by-code attempts from one client` test confirmed in platform-health.spec.ts. |

---

## Dependency Graph

```
Wave 0 (0.1–0.4)
    ↓
Wave 1A (1.1–1.7)   Wave 1B (1.8–1.24)   [all parallel within each batch]
    ↓                    ↓
Wave 2 (2.1–2.24)   [all parallel]
    ↓
Wave 3 (3.1–3.4)    [all parallel, needs final Wave 2 string list]
    ↓
Wave 4 (4.1–4.7)    [sequential per test file]
```

**Special dependency notes:**
- Task 1.1 depends on 0.4 (realm-unique migration).
- Task 1.22 (admin parent-link API) must complete before 2.10 (admin parent-link UI).
- Task 1.21 (admin enroll API) must complete before 2.11 (admin enroll UI).
- Task 1.15 (7-day trend API) must complete before 2.5 (skill tree wiring) is complete — trend is surfaced in the parent child-progress view which reuses the same stats call.
- Tasks 2.3–2.5 (student dashboard live data) depend on 1.13, 1.14, 1.15 (stats enhancements).

---

## File Touch Summary

| File | Tasks |
|------|-------|
| `database/migrations/018–021_*.sql` | 0.1, 0.2, 0.3, 0.4 |
| `backend/src/auth/keycloak.ts` | 1.1 |
| `backend/src/auth/routes.ts` | 1.2, 1.7, 1.15, 1.19, DAT-06 cleanup |
| `backend/src/classroom/routes.ts` | 1.3, 1.5 |
| `backend/src/index.ts` | 1.4, 1.20 |
| `backend/src/learning/routes.ts` | 1.8, 1.10, 1.12, 1.16, 1.17 |
| `backend/src/quiz/logic.ts` | 1.9 |
| `backend/src/quiz/routes.ts` | 1.17, 1.24 |
| `backend/src/quiz/store.ts` | 1.24 |
| `backend/src/progress/routes.ts` | 1.11, 1.13, 1.14, 1.20 |
| `backend/src/admin/routes.ts` | 1.18, 1.21, 1.22 |
| `centrifugo/config.json` | 1.6 |
| `docker-compose.yml` | 1.23 |
| `web_app/app.js` | 2.1, 2.14, 2.15 |
| `web_app/index.html` | 2.1 |
| `web_app/components/student.jsx` | 2.3, 2.4, 2.5, 2.6, 2.13, 2.17, 2.18, 2.19, 3.4 |
| `web_app/components/teacher.jsx` | 2.2, 2.7, 2.8, 2.12, 2.20, 2.21, 2.22, 3.1 |
| `web_app/components/admin.jsx` | 2.9, 2.10, 2.11, 2.24, 3.3 |
| `web_app/components/parent.jsx` | 2.23, 3.2 |
| `web_app/components/shared.jsx` | 2.16, 3.1–3.4 |
| `backend/test/*.test.ts` | 4.1–4.3 |
| `tests/qaqc/*.spec.ts` | 4.4–4.7 |
