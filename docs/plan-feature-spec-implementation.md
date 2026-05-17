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
| 1.8 | Implement STEM question scoring (lessons) | `backend/src/learning/routes.ts` | In `POST /learning/lessons/:id/submit`, add scoring branches for: `fill_blank` (case-insensitive trim match), `numeric` (parsed float within tolerance), `matching` (per-pair scoring with optional partial credit), `true_false` (already done), `step_order` (exact sequence match). Fixes DAT-02. | `[PARALLEL]` |
| 1.9 | Implement STEM question scoring (quiz) | `backend/src/quiz/logic.ts` | Mirror lesson scoring logic in quiz answer evaluation. Fixes quiz STEM 0-score issue. | `[PARALLEL]` |
| 1.10 | Trigger streak check on lesson submit | `backend/src/learning/routes.ts` | After a successful lesson submit, call the `checkAndUpdateStreak(studentId)` helper internally (no extra HTTP round-trip). Fixes DAT-04. | `[PARALLEL]` |
| 1.11 | Add pagination to `GET /progress/student/:id` | `backend/src/progress/routes.ts` | Add `limit` (default 50, max 200) and `offset` query params; return total count in response header. Fixes DAT-03. | `[PARALLEL]` |
| 1.12 | Add cap to `GET /learning/catalog` limit | `backend/src/learning/routes.ts` | Enforce server-side max of 200 on the `limit` query param. Fixes catalog unbounded query. | `[PARALLEL]` |
| 1.13 | Add `rank` to student stats endpoint | `backend/src/progress/routes.ts` | In `GET /progress/student/:id/stats`, add a subquery that ranks the student by `avg_score` within each enrolled classroom and returns the best rank. Fixes FEAT-16. | `[PARALLEL]` |
| 1.14 | Add weekly study time to student stats | `backend/src/progress/routes.ts` | Add `weekTimeSeconds: SUM(time_spent_seconds) WHERE updated_at >= date_trunc('week', NOW())` to the stats query. Fixes FEAT-15. | `[PARALLEL]` |
| 1.15 | Add 7-day trend comparison to parent alerts/stats | `backend/src/auth/routes.ts` | Compute `avg_score_7d` vs `avg_score_prev_7d` per subject and include trend direction in the alerts and child progress response. Fixes FEAT-14. | `[PARALLEL]` |
| 1.16 | Implement achievement award trigger | `backend/src/learning/routes.ts`, `backend/src/quiz/routes.ts` | After lesson submit and quiz session end, call `checkAndAwardAchievements(studentId)` which evaluates streak milestones (7, 30 days), perfect scores, XP thresholds, and top-3 leaderboard position. Insert into `user_achievements`. Fixes FEAT-03. | `[PARALLEL]` |
| 1.17 | Implement hearts decrement on lesson/quiz fail | `backend/src/learning/routes.ts`, `backend/src/quiz/routes.ts` | When `score < 60` and `is_completed = false`, decrement `student_hearts.current_hearts` by 1 (floor at 0). Add a regeneration cron or time-based restore. Fixes FEAT-04. | `[PARALLEL]` |
| 1.18 | Add `last_login` to admin user list | `backend/src/admin/routes.ts` | Include `last_login` column in `GET /admin/users` SELECT query. Fixes admin user list missing timestamp. | `[PARALLEL]` |
| 1.19 | Cache parent alert queries | `backend/src/auth/routes.ts` | Cache alert computation per parent in Redis with 2-min TTL (`alerts:parent:{id}`). Invalidate on lesson submit and streak update. Fixes OPS-04. | `[PARALLEL]` |
| 1.20 | Refresh materialized view on schedule / trigger | `backend/src/progress/routes.ts`, `backend/src/index.ts` | Add a `setInterval` (5-min) in `index.ts` that calls `REFRESH MATERIALIZED VIEW CONCURRENTLY student_classroom_stats`. Update classroom progress endpoint to query this view. Fixes DAT-05. | `[PARALLEL]` |
| 1.21 | Add manual enrollment endpoint for admin | `backend/src/admin/routes.ts` | `POST /admin/classrooms/:id/enroll` — accepts `{ studentId }`, creates `classroom_enrollments` row as admin action. Fixes FEAT-08. | `[PARALLEL]` |
| 1.22 | Add parent-link admin endpoints | `backend/src/admin/routes.ts` | `POST /admin/parent-links` (`{ parentId, studentId }`) and `DELETE /admin/parent-links/:id`. Fixes FEAT-09 backend. | `[PARALLEL]` |
| 1.23 | Add postgres backup cron to docker-compose | `docker-compose.yml` | Add a `pg-backup` service using `prodrigestivus/pg-backup` or equivalent that runs `pg_dump` daily to a bind-mounted backup volume. Fixes OPS-02. | `[PARALLEL]` |
| 1.24 | Add `POST /quiz/sessions/:id/cancel` endpoint | `backend/src/quiz/routes.ts`, `backend/src/quiz/store.ts` | Add a cancel transition (`lobby|active → cancelled`) with cleanup of Redis state and publication of `quiz_session_cancelled` Centrifugo event. Fixes missing cancel flow. | `[PARALLEL]` |

---

### Wave 2 — Parallel batch C: Web app UI fixes (depends on Wave 0 migrations being applied)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 2.1 | Implement Keycloak OAuth callback page | `web_app/index.html`, `web_app/app.js` | Add a `/keycloak-callback` route handler in the SPA router that reads `?code=&state=` from URL, calls `POST /api/auth/keycloak/callback`, stores tokens, and redirects to the role-appropriate dashboard. Fixes FEAT-01. | `[PARALLEL]` |
| 2.2 | Add quiz timer pause button to teacher UI | `web_app/components/teacher.jsx` | In the live quiz session view, render a Pause/Resume button that calls `POST /quiz/sessions/:id/timer` with `{ action: 'pause' | 'resume' }`. Fixes FEAT-02. | `[PARALLEL]` |
| 2.3 | Wire real leaderboard to student dashboard | `web_app/components/student.jsx` | Replace `LEADERBOARD_BASE` with a fetch to `/progress/classroom/:id/leaderboard` using the first enrolled classroom. Highlight the row where `user_id === currentUser.id`. Fixes FEAT-10. | `[PARALLEL]` |
| 2.4 | Wire achievements API to badge widget | `web_app/components/student.jsx` | Replace static badge array with a fetch to `/progress/me/achievements`. Map badge `type` to display name and icon. Fixes FEAT-11. | `[PARALLEL]` |
| 2.5 | Wire syllabus topics to skill tree | `web_app/components/student.jsx`, `web_app/app.js` | Fetch `/learning/syllabus?subject=&formLevel=` and `/progress/student/:id` to compute done/current/locked state per node. Fixes FEAT-12. | `[PARALLEL]` |
| 2.6 | Add comment input to student feed view | `web_app/components/student.jsx` | Render a comment input + submit button below each feed post using the same `POST /feed/posts/:id/comments` API as teacher. Fixes FEAT-13. | `[PARALLEL]` |
| 2.7 | Implement edit classroom form (teacher) | `web_app/components/teacher.jsx` | Add an edit modal/drawer that calls `PATCH /classroom/:id` with name, description, subject, formLevel. Trigger from an "Edit" button on the classroom card. Fixes FEAT-05. | `[PARALLEL]` |
| 2.8 | Expose "required" flag in lesson assignment UI | `web_app/components/teacher.jsx` | Add a checkbox "Wajib / Required" to the lesson assignment panel; pass `is_required` in the POST body. Fixes FEAT-06. | `[PARALLEL]` |
| 2.9 | Add edit user form in admin UI | `web_app/components/admin.jsx` | Add an edit modal for full_name and role fields that calls `PATCH /admin/users/:id`. Fixes FEAT-07. | `[PARALLEL]` |
| 2.10 | Add admin parent-link management screen | `web_app/components/admin.jsx` | Add a "Parent Links" tab listing all parent–student pairs. Include create-link form and deactivate button calling the new admin endpoints from task 1.22. Fixes FEAT-09. | `[PARALLEL]` |
| 2.11 | Add admin manual enrollment UI | `web_app/components/admin.jsx` | Inside the classroom detail view, add "Enroll Student" input (student UUID or email) that calls `POST /admin/classrooms/:id/enroll`. Fixes FEAT-08. | `[PARALLEL]` |
| 2.12 | Fix form level selector in create-classroom (teacher) | `web_app/components/teacher.jsx` | Restrict `CLASS_FORM_LEVELS` to `[4, 5]` to match the DB constraint. Show inline error if backend returns 400. Fixes UX-01. | `[PARALLEL]` |
| 2.13 | Auto-refresh classroom list after student join | `web_app/components/student.jsx` | After `POST /classroom/join-by-code` succeeds, call the classroom-list fetch again to refresh in-place. Fixes UX-10 for join flow. | `[PARALLEL]` |
| 2.14 | Add token refresh on tab focus | `web_app/app.js` | Listen for `document.visibilitychange` → when visible, if token age > 45 min call `POST /api/auth/refresh`. Fixes stale token issue (Section 2.3). | `[PARALLEL]` |
| 2.15 | Fix `reactPost` undefined error | `web_app/app.js` | Add a stub `window.tusyenApi.reactPost(postId, emoji)` that calls `POST /feed/posts/:id/reactions` (or returns a TODO 501) to stop the silent error. Fixes FEAT-18. | `[PARALLEL]` |
| 2.16 | Add inline video embed component | `web_app/components/shared.jsx` | Create a `VideoEmbed` component that detects YouTube/Vimeo/Loom URLs and renders a sandboxed `<iframe>` with lazy loading. Use it in lesson content blocks and feed attachments. Fixes FEAT-17. | `[PARALLEL]` |
| 2.17 | Add loading state for hearts display | `web_app/components/student.jsx` | Show "..." skeleton until hearts API responds; remove "null" flash. | `[PARALLEL]` |
| 2.18 | Fix student greeting to honour language setting | `web_app/components/student.jsx` | Wrap `getGreeting()` output in `t(malayGreeting, englishGreeting)` using the language context. Fixes UX-03. | `[PARALLEL]` |
| 2.19 | Fix PIN entry to numeric-only | `web_app/components/student.jsx` | Add `inputMode="numeric"` and a `pattern="[0-9]*"` filter on keypress. Fixes UX-05. | `[PARALLEL]` |
| 2.20 | Auto-scroll feed after new post | `web_app/components/teacher.jsx` | After post creation, call `postElement.scrollIntoView({ behavior: 'smooth' })` on the newly prepended post. Fixes UX-06. | `[PARALLEL]` |
| 2.21 | Show error feedback on comment submit | `web_app/components/teacher.jsx`, `web_app/components/student.jsx` | Replace `catch {}` in comment submission with user-visible toast/error message. Fixes silent error swallowing. | `[PARALLEL]` |
| 2.22 | Fix "—" vs "0%" for classroom with no progress | `web_app/components/teacher.jsx` | When `average_progress === null`, display "0%" with a muted style rather than "—". Fixes UX-04. | `[PARALLEL]` |
| 2.23 | Fix follow-up action label in parent UI | `web_app/components/parent.jsx` | Rename button from "Simpan soalan untuk guru" → "Tandai untuk tindak lanjut" (BM) / "Flag for follow-up" (EN). Add tooltip explaining no message is sent. Fixes UX-08. | `[PARALLEL]` |
| 2.24 | Add audit page load-more in admin | `web_app/components/admin.jsx` | Add "Load more" button on audit log that fetches the next 20 entries via offset. Fixes admin audit log truncation. | `[PARALLEL]` |

---

### Wave 3 — Parallel batch D: i18n / translation pass (depends on Wave 2 UI having final strings)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 3.1 | i18n pass — teacher.jsx | `web_app/components/teacher.jsx` | Wrap all hardcoded Malay strings in `t(ms, en)`. Add missing entries to `STATIC_TRANSLATIONS` in shared.jsx. Fixes UX-02 (teacher portion). | `[PARALLEL]` |
| 3.2 | i18n pass — parent.jsx | `web_app/components/parent.jsx` | Same as 3.1 for parent component. | `[PARALLEL]` |
| 3.3 | i18n pass — admin.jsx | `web_app/components/admin.jsx` | Same as 3.1 for admin component. | `[PARALLEL]` |
| 3.4 | i18n pass — student.jsx | `web_app/components/student.jsx` | Same as 3.1 for student component; also covers badge descriptions and skill-tree sub-labels. | `[PARALLEL]` |

---

### Wave 4 — Sequential: QA test coverage (depends on all feature implementations)

| # | Task | Files | Change | Label |
|---|------|-------|--------|-------|
| 4.1 | Backend unit tests — STEM scoring | `backend/test/quiz.logic.test.ts`, `backend/test/learning.routes.test.ts` | Add test cases for fill_blank, numeric, matching, step_order scoring. Both correct and incorrect answers. | `[SEQUENTIAL]` |
| 4.2 | Backend unit tests — achievements & hearts | `backend/test/progress.routes.test.ts` | Test that achievement rows are created on lesson submit (streak milestone, perfect score). Test hearts decrement on failure. | `[SEQUENTIAL]` |
| 4.3 | Backend unit tests — admin new endpoints | `backend/test/admin.routes.test.ts` (new file if absent) | Test manual enrollment, parent-link create/deactivate, user edit. | `[SEQUENTIAL]` |
| 4.4 | E2E: Keycloak callback flow (Playwright mock) | `tests/qaqc/full-feature-regression.spec.ts` | Add a test that intercepts the Keycloak redirect and calls the callback endpoint directly to verify token exchange and session creation. | `[SEQUENTIAL]` |
| 4.5 | E2E: Quiz timer pause/resume | `tests/qaqc/full-feature-regression.spec.ts` | Add teacher quiz session test: create session → advance → pause → verify timer paused → resume → advance → end. | `[SEQUENTIAL]` |
| 4.6 | E2E: Parent alert generation | `tests/qaqc/full-feature-regression.spec.ts` | Simulate low-score scenario; call alert endpoint; verify alert type, severity, and status update. | `[SEQUENTIAL]` |
| 4.7 | E2E: Classroom join rate-limit | `tests/qaqc/platform-health.spec.ts` | Fire join-by-code 11 times from same IP in rapid succession; verify 429 on the 11th. | `[SEQUENTIAL]` |

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
