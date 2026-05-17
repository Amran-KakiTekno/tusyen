# Tusyen Full QA/QC Plan — 2026-05-17

> Comprehensive, parallel-friendly QA/QC plan covering every shipping feature across all four roles (Student, Teacher, Parent, Admin) plus Guest (PIN/quiz join), every layer (backend API, React web app, Flutter app, infra), and every cross-cutting concern (auth, realtime, storage, sync, PWA, notifications, security, i18n).

## Special Focus For This Run

Two areas get extra weight in this pass because they are where regressions and bugs are actively showing up:

1. **Frontend (React web app) UI/UX** — Stage 3 workstreams are **first-class**, not afterthoughts. Agents must actively **bug-hunt**, not just confirm screens render. Every reachable button, modal, empty state, error state, loading state, and edge case is in scope. Capture screenshots of any defect.
2. **Flow logic** — Stage 3.5 (new) tests whether each user journey **closes** in a way that matches the user's mental model. A feature can "work" (API returns 200, screen renders) and still be broken because critical information is missing from the UX.

### Baseline known UI bug (use as a reference exemplar for the kind of issue to hunt)

- **Quiz completion summary ("Tamat!" / "Semakan ringkas") is incomplete.** The post-quiz review screen (`web_app/components/quiz.jsx` or wherever the post-session summary renders) lists each question title and a "Kukuh / Lemah" label, but **does NOT show**:
  - the answer the student selected,
  - the correct answer,
  - per-question explanation,
  - which questions were wrong vs right (color/icon is ambiguous).
  - Expected: review section should display, per question, `Your answer: X` and `Correct answer: Y` (and explanation if present on the question), so the student can actually learn from the mistake. This is a Major UX defect to be fixed.
  - Use this as a template for what a "logged defect" looks like in deliverables.

The plan is sliced into **Stages**. Stage 0 is sequential. Stages 1–4 are designed so each numbered **Workstream (W#)** can be executed by an independent agent **in parallel**. Stage 5 synthesizes results.

Each workstream specifies:

- **Goal** — what we are validating
- **Scope** — explicit features/routes/components included
- **Tools** — what to run / use
- **Pass criteria** — what "green" looks like
- **Deliverable** — artifact file the workstream must produce in `docs/qaqc-results-2026-05-17/`

---

## 0. Pre-Flight (sequential, must finish before Stage 1)

A single bootstrap agent (or human) runs this. Everyone else blocks on it.

### 0.1 Stack Up & Healthy

```powershell
cd D:\2026\tusyen
docker compose up -d --build
docker compose ps
Invoke-RestMethod http://localhost/api/health
Invoke-RestMethod http://localhost:2586/v1/health
```

Expect: API healthy, DB connected, Redis connected, MinIO ok, Keycloak ok, Centrifugo ok, ntfy ok.

### 0.2 Migrations & Demo Seed

```powershell
docker compose exec api npm run db:migrate
docker compose exec api npm run db:seed-demo
```

Verify migrations 001–015 are applied (`SELECT * FROM schema_migrations` or equivalent) including the newest ones (`012_quiz_deck_stem_question_types`, `013_quiz_timer_controls`, `014_student_hearts`, `015_free_learning`).

### 0.3 Web Build

```powershell
npm install
npm run build:web
```

Confirm `web_app/dist/app.bundle.js` exists and is newer than its component sources.

### 0.4 Playwright Toolchain

```powershell
npm run qaqc:install
```

### 0.5 QA Settings Snapshot

Create `docs/qaqc-results-2026-05-17/_env-snapshot.md` listing:

- `docker compose ps` output
- `git rev-parse HEAD` and `git status --short`
- `.env` toggles that affect QA (DEMO_ADMIN_LOGIN_ENABLED, PUBLIC_ADMIN_REGISTRATION_ENABLED, ALLOW_GUEST_QUIZ_JOIN, AUTH_COOKIE_SECURE, NODE_ENV)
- Migration list applied
- Web bundle hash

### 0.6 Create Results Directory

```powershell
mkdir docs/qaqc-results-2026-05-17
```

All workstreams write their reports into this folder.

---

## 1. Stage 1 — Automated Test Suites (parallel, 4 workstreams)

These are fast, deterministic, no UI judgement required. Run all four in parallel.

### W1. Backend Unit & Integration (Vitest)

- **Goal:** confirm every backend route/store/logic test passes against fresh code.
- **Scope:** every file in `backend/test/*.test.ts` — auth, classroom, learning, learning answers, progress, quiz logic/routes/store, whiteboard, admin, keycloak, notifications, media access, external video.
- **Run:**
  ```powershell
  cd backend
  npm install
  npm run build
  npm test -- --run --reporter=verbose
  ```
- **Pass criteria:** 100% pass, zero skips that weren't already skipped on `main`. Coverage report optional.
- **Deliverable:** `docs/qaqc-results-2026-05-17/w1-backend-tests.md` — table of file → passed/failed/duration, plus any console warnings.

### W2. Flutter Widget + CRUD E2E

- **Goal:** confirm legacy Flutter app still builds and its core E2E flows pass.
- **Scope:** `flutter test` and `flutter test test/e2e/crud_e2e_test.dart`.
- **Run:**
  ```powershell
  cd flutter_app
  flutter pub get
  flutter test
  flutter test test/e2e/crud_e2e_test.dart
  flutter build web
  ```
  If local Flutter SDK absent, use the Dockerized command from README.
- **Pass criteria:** all tests pass, web build emits `flutter_app/build/web/main.dart.js`.
- **Deliverable:** `docs/qaqc-results-2026-05-17/w2-flutter.md` — test counts, build size, any warnings.

### W3. Playwright Smoke Suite

- **Goal:** confirm the four lightweight smoke specs pass against the live local stack.
- **Scope:** `tests/qaqc/platform-health.spec.ts`, `production-shell.spec.ts`, `v2-role-smoke.spec.ts`, `v2-responsive.mobile.spec.ts`, `language-switch.spec.ts`.
- **Run:**
  ```powershell
  npm run qaqc:smoke
  npx playwright test tests/qaqc/language-switch.spec.ts
  ```
- **Pass criteria:** all suites green; HTML report has no failing/flaky tests.
- **Deliverable:** `docs/qaqc-results-2026-05-17/w3-playwright-smoke.md` — link to `playwright-report/`, summary table, any flakes.

### W4. Playwright Full Feature Regression

- **Goal:** end-to-end API + browser coverage of every shipping feature (the big suite).
- **Scope:** `tests/qaqc/full-feature-regression.spec.ts` running with `qaqc:full`.
- **Run:** ensure `DEMO_ADMIN_LOGIN_ENABLED=true` for the QA stack first.
  ```powershell
  $env:DEMO_ADMIN_LOGIN_ENABLED = "true"
  npm run qaqc:full
  ```
- **Pass criteria:** the single big test passes; no leaked QA users left behind (the suite uses `uniqueRunId` so this should be clean).
- **Deliverable:** `docs/qaqc-results-2026-05-17/w4-playwright-full.md` — pass/fail per `test.step`, durations, screenshots/trace links for failures.

---

## 2. Stage 2 — Per-Feature API Deep Dive (parallel, 9 workstreams)

These exercise the API as a real client would, beyond what the existing tests cover, focusing on edge cases, error paths, and authz boundaries. Use Playwright `request` context or `curl`/`Invoke-RestMethod`. They are independent and parallel-safe (each creates its own QA user run-id).

### W5. Auth & Keycloak Deep

- **Goal:** validate token rotation, expiry, refresh reuse, role-based registration gating, Keycloak PKCE happy + error paths.
- **Scope:** `/api/auth/register|login|refresh|link-parent|linked-students|keycloak/status|login-url|callback`.
- **Checks:**
  - Register each role; verify `PUBLIC_ADMIN_REGISTRATION_ENABLED=false` blocks admin role registration.
  - Login with wrong password (401), disabled user (403), unknown email (401).
  - Refresh: valid token rotates; reused/old token rejected.
  - Token-in-cookie path when `AUTH_COOKIE_SECURE=true` — cookie flags HttpOnly/SameSite/Secure.
  - Keycloak `login-url` returns a redirect URL on the configured origin only; rogue `redirectUri` is rejected (KEYCLOAK_ALLOWED_REDIRECT_ORIGINS).
  - Parent link-self by student UUID; rejects non-existent / wrong-role student.
  - JWT tampering / wrong signature → 401.
- **Deliverable:** `w5-auth-keycloak.md` with table per scenario.

### W6. Admin Surface (full CRUD + safety)

- **Goal:** every `/api/admin/*` route + production guardrails.
- **Scope:** users (CRUD + status), parent-links, classrooms (CRUD + enrollment), syllabus, lessons (incl. all 14 question types), stats, notifications health/test, system health, cache clear.
- **Checks:**
  - Non-admin cannot reach any `/admin/*` (403).
  - Disable user is soft-delete (record persists, `is_active=false`).
  - Disable classroom hides it from teacher/student lists but data preserved.
  - Lesson with every question type (multiple choice, true/false, fill-in-blank, matching pairs, representation matching, missing step, step ordering, numeric, diagram labeling, error diagnosis, prediction, code trace, data interpretation, scenario) round-trips through create/edit/preview.
  - `POST /admin/notifications/test` publishes to ntfy; `/admin/notifications/health` reflects status.
  - `POST /admin/cache/clear` returns 200 and Redis cache is actually cleared (verify key count).
- **Deliverable:** `w6-admin-api.md`.

### W7. Learning + Progress + Content Review

- **Goal:** lesson catalog, syllabus visibility, exercise submission for all question types, content-review gating, progress stats math.
- **Scope:** `/learning/*`, `/progress/*`, `lesson_content_review` migration behavior.
- **Checks:**
  - Catalog returns published lessons only.
  - Submitting an exercise before content review → 400 (with content blocks present).
  - After marking content reviewed, submission accepted; `progress.reviewed_at`, `reviewed_block_count`, `review_seconds` populated.
  - Resubmit lesson with different score: best score retained, attempts incremented.
  - Subject mastery aggregate matches sum of completed lessons.
  - Streak increments on consecutive-day completions; resets on gap.
  - Quiz XP shows up in stats `quiz_xp`.
  - Parent fetches `/progress/student/:id` only for linked children.
  - Teacher fetches `/progress/classroom/:id` only for owned classrooms.
- **Deliverable:** `w7-learning-progress.md`.

### W8. Feed / Posts / Comments / Reactions (incl. realtime)

- **Goal:** post lifecycle, comment lifecycle, reactions, media attachments, embeds, realtime WebSocket.
- **Scope:** `/feed/*`, `/ws/classroom/:classroomId`.
- **Checks:**
  - Create post types: announcement, assignment, general. Pinning. Edit. Soft-delete.
  - Attachments: image upload, GIF URL (Giphy/Tenor), video file, generic file, YouTube/Vimeo/Loom embeds. Non-allowed embed URLs rejected.
  - Comments: rich attachments, edit own, delete own; teacher can delete any comment on their post; admin can delete any comment.
  - Reactions: add → update → remove; counts accurate.
  - Realtime: open WebSocket as enrolled student; create post as teacher; expect `NEW_POST` event; same for `NEW_COMMENT`, `REACTION_UPDATED`.
  - Authz: non-enrolled user cannot read classroom-scoped posts; cannot comment.
  - ntfy: post creation publishes to topic `tusyen_classroom_<uuid>` (poll ntfy `/v1/json`).
- **Deliverable:** `w8-feed-realtime.md`.

### W9. Classroom Lifecycle

- **Goal:** classroom CRUD, join/leave, enrollment, analytics, lesson assignment.
- **Scope:** `/classroom/*` plus admin counterparts.
- **Checks:**
  - Teacher creates classroom; join code is 6 chars.
  - Student joins with correct code → enrolled; wrong code → 404/403.
  - Student leaves → enrollment removed; can re-join.
  - Teacher disables classroom → no new joins; existing data preserved.
  - Admin reassigns owner teacher.
  - Lesson assign/unassign reflected in `/classroom/:id/lessons` and student `/learning/lessons`.
  - Analytics endpoint returns plausible counts.
- **Deliverable:** `w9-classroom.md`.

### W10. Live Quiz (deck CRUD + sessions + WebSocket + timer + hearts)

- **Goal:** full quiz lifecycle including the newer timer-controls and hearts migrations.
- **Scope:** `/quiz/*`, `/ws/quiz/:sessionId`, migrations 002/012/013/014.
- **Checks:**
  - Deck CRUD with multiple-choice and true/false; question time limit & points respected.
  - Start session → 6-digit PIN; classroom-scoped sessions only visible to enrolled or guest (if `ALLOW_GUEST_QUIZ_JOIN=true`).
  - Authenticated student join by PIN; nickname assigned; appears in lobby.
  - Guest join via `/quiz/join` when allowed; rejected when disabled.
  - Host advance → players receive question; timer countdown matches server.
  - Submit answer; out-of-time submission rejected; correct answers awarded XP; hearts decrement on wrong answer (per migration 014).
  - Host ends → leaderboard finalized; XP events written; student summary updated.
  - WebSocket: `CONNECTED`, `AUTH_SUCCESS`, `PLAYER_JOINED`, `QUESTION_STARTED`, `ANSWER_SUBMITTED`, `LEADERBOARD_UPDATE`, `SESSION_ENDED` all observed.
  - Re-join after socket drop continues with same participant token.
- **Deliverable:** `w10-quiz.md`.

### W11. Whiteboard

- **Goal:** session lifecycle, recording attach/replay, draw event persistence.
- **Scope:** `/whiteboard/*`.
- **Checks:**
  - Start session → active session visible; duplicate start prevented.
  - WebSocket draw events persisted; `/events` replay returns them ordered.
  - End session; later student visit shows in history.
  - Upload recording (MP4); attach to session; playback URL works (signed media). Invalid mime rejected.
  - Remove recording; replay URL gone.
  - Authz: non-enrolled student denied.
- **Deliverable:** `w11-whiteboard.md`.

### W12. Storage + Sync

- **Goal:** uploads, signed access, sync push/pull/conflict.
- **Scope:** `/storage/*`, `/sync/*`.
- **Checks:**
  - Multipart upload, signed download URL, list, delete.
  - Oversized upload (>configured cap) rejected.
  - Disallowed MIME rejected.
  - Cross-user file access blocked.
  - Sync push with new record; pull returns it; conflict resolve path returns expected payload.
- **Deliverable:** `w12-storage-sync.md`.

### W13. PWA + Service Worker

- **Goal:** PWA manifest validity, SW behavior, offline shell.
- **Scope:** `web_app/manifest.json`, `web_app/sw.js`, `web_app/index.html`.
- **Checks:**
  - Manifest parses; required fields (name, short_name, icons, start_url, display, theme_color) present.
  - PNG icons 192/512: known missing per memory — confirm and log as a defect.
  - Service worker registers in Chromium DevTools; install + activate fire.
  - Cache-first works for static (force offline → app shell still loads).
  - Network-first works for `/api/` and `/ws/` (offline → API gracefully fails, app shows offline state if any).
  - "Add to Home Screen" prompt criteria met (HTTPS in production, manifest, SW).
- **Deliverable:** `w13-pwa.md`.

---

## 3. Stage 3 — UI / UX Per-Role Walkthroughs (parallel, 6 workstreams)

These are **browser-driven** workstreams using Playwright headed mode or a real human/agent in a browser. Each walks the full role experience on both desktop (≥1280px) and mobile (375px). They must actually click through every screen.

**Mandate:** these are NOT pass-through smoke tests. The executor must **actively look for UI/UX defects**. For each screen, check:

- All buttons clickable and labeled correctly (no `i18n.missing.*` or `undefined`).
- All states present: loading skeleton, empty state, error state, success state.
- Forms: required-field validation, error messages on bad input, success confirmation.
- Modals: open/close/escape/backdrop-click, focus trap, no layout shift behind.
- Lists: sort, filter, paginate, scroll behavior on long lists.
- Images/media: loading placeholder, broken-link fallback, alt text.
- Mobile: tap targets ≥44px, no horizontal scroll, bottom-nav doesn't cover content.
- Dark theme: contrast ≥WCAG AA on every text-on-bg combo.
- Hover/focus/active states present.
- Keyboard navigation: Tab order sensible; Enter submits; Esc closes modals.
- Console: zero React warnings, zero unhandled promise rejections.
- Network panel: no 4xx/5xx on success paths.

Every defect found → logged in the workstream deliverable using this template:

```
### Defect: <short title>
- Role / Screen: <role>/<screen name>
- Severity: Blocker | Major | Minor | Cosmetic
- Repro: 1) ... 2) ... 3) ...
- Expected: <what should happen>
- Actual: <what happens>
- Suspected file: <web_app/components/foo.jsx#L123 or unknown>
- Screenshot: screenshots/<role>/<viewport>/<filename>.png
```

Common rig: log in via the demo tile, take screenshots into `docs/qaqc-results-2026-05-17/screenshots/<role>/<viewport>/`.

### W14. React Student — Desktop + Mobile

- **Screens:** Home dashboard, Learn (subject → topic → content blocks → exercise), Lesson exercise modal (try at least 3 question types), Classrooms list, Join-by-code flow, Classroom detail with posts, Posts page (like, comment with media), Quiz (history + PIN join), Profile, Progress.
- **Realtime checks:** while logged-in, have a teacher create a post in another window — student feed updates.
- **PWA check:** install icon visible in Chromium URL bar (if served from HTTPS).
- **Pass criteria:** every screen renders, every primary CTA works, no console errors, mobile layout (`useNarrow`) shows top bar + bottom nav.
- **Deliverable:** `w14-student-ui.md` + screenshots.

### W15. React Teacher — Desktop + Mobile

- **Screens:** Home (classroom count, deck summary), Profile edit, Classrooms (create, share join code, see students), Lessons (browse catalog, preview, assign), Posts (create with image + GIF + YouTube embed; pin; edit; delete), Quiz (deck CRUD with both question types; start live session; host controls advance/end), Whiteboard (start session; draw; end; upload recording; replay).
- **Pass criteria:** all CRUD round-trips persist; live session 6-digit PIN displayed and copyable; recording playback works.
- **Deliverable:** `w15-teacher-ui.md` + screenshots.

### W16. React Parent — Desktop + Mobile

- **Screens:** Home (linked child), Link child by UUID (use student UUID from demo seed), Children list, Child progress drill-down, Posts from linked child classrooms (like, comment), Teacher profile open from post.
- **Pass criteria:** parent cannot see classrooms their child is not enrolled in; comment+reaction flows mirror student.
- **Deliverable:** `w16-parent-ui.md` + screenshots.

### W17. React Admin — Desktop + Mobile

- **Screens:** Home stats, Users (create + edit + disable + role filters), Parent-links (create + delete), Classrooms (create + edit + enroll + remove student), Syllabus (CRUD), Lessons (CRUD with at least 5 question types incl. matching pairs, step ordering, numeric, diagram labeling, scenario), System (health + cache clear button if surfaced; otherwise call API).
- **Pass criteria:** every admin action persists and shows in subsequent role views (student sees the new lesson, etc.).
- **Deliverable:** `w17-admin-ui.md` + screenshots.

### W18. Flutter Web — All Roles Smoke

- **Goal:** legacy v1 still renders & primary flows pass.
- **Scope:** open Flutter web build, log in as each demo role, verify home dashboard renders, perform one CRUD per role.
- **Deliverable:** `w18-flutter-smoke.md` + screenshots. Note any visual regressions vs the React app.

### W19. i18n / Language Switch

- **Goal:** Bahasa Malaysia ↔ English (or whichever languages are configured) switch works without losing state; all visible strings translated; no `i18n.missing.` keys.
- **Scope:** every screen reachable in <5 clicks from each role landing.
- **Tools:** existing `tests/qaqc/language-switch.spec.ts` as starting point; extend manually.
- **Deliverable:** `w19-i18n.md` listing any untranslated strings with file:line where the literal lives.

---

## 3.5. Stage 3.5 — Flow Logic QA (parallel, 5 workstreams)

These workstreams test the **logic and integrity of end-to-end user journeys** — does the flow actually close the loop for the user? A flow can pass API + render checks and still be broken because critical information is missing, the wrong screen is shown, or state doesn't update where the user expects it.

For each flow below, walk it as the user, then audit:

- **Inputs preserved across steps?** (e.g., a chosen subject still selected on next screen)
- **All required info shown on each screen?** (e.g., quiz review showing the user's answer, not just the question)
- **Confirmations and feedback in the right place?** (e.g., toast after save, not silent)
- **Side-effects visible?** (e.g., XP gained appears on profile and home dashboard, not just on the quiz screen)
- **Cancel/back doesn't lose work?**
- **Repeat/retry works?** (e.g., retrying a lesson preserves prior best score)
- **Cross-role consistency?** (e.g., teacher creates post → student sees it; admin creates lesson → teacher sees it in catalog → student sees it after assignment)
- **State after refresh matches state before?**

### L1. Student Learning Flow Logic

Walk: Login → Home dashboard → Learn → pick subject → pick topic → review content blocks → start exercise → answer question by question → submit → see score → return to Learn.

Audit checks:

- Is "continue last lesson" / "resume" honored on home?
- Does progress on home dashboard update immediately after lesson submission?
- Does the "content review unlock" gate render and unlock correctly?
- Are previous attempts and best score shown before starting?
- Does the exercise modal show progress (Q 3/10), remaining hearts, time spent?
- After submit: does the result screen show **per-question correctness, the user's selected answer, and the correct answer**? (this is the baseline known bug — confirm and log)
- Does retry actually retry (new attempt, not stale state)?
- Streak counter behaviour on first lesson of day vs second.

**Deliverable:** `l1-flow-student-learning.md`.

### L2. Quiz (Live) Flow Logic

Walk both sides: teacher hosting + student joining.

Teacher: Quiz tab → create deck → add questions → start session → share PIN → advance through questions → end session → review leaderboard.
Student: Join by PIN → enter nickname → wait in lobby → see question → answer within timer → see feedback → see final leaderboard + own rank + XP earned → return to quiz history → confirm history entry exists with score.

Audit checks:

- PIN copy-to-clipboard works and shows confirmation.
- Lobby shows live player list updating as students join (WebSocket).
- Timer is synchronized between host and players.
- "Time's up" auto-locks answer; late submissions don't count.
- After advance, all players move at once.
- End screen: leaderboard ranks correct; XP delta visible; hearts deducted per wrong answer (migration 014).
- Student post-game summary lists each question with **the student's answer and the correct answer** (baseline known defect).
- XP appears on student home dashboard quiz section after game.
- Re-joining a finished session shows the summary, not a join error.

**Deliverable:** `l2-flow-quiz.md`.

### L3. Teacher Content Authoring Flow Logic

Walk: Teacher → create classroom → create lesson with content blocks + every question type → preview → assign to classroom → publish post about it → invite student → confirm student sees it.

Audit checks:

- Lesson preview matches student view 1:1.
- Saving a partial lesson does not lose unsaved questions.
- Reordering content blocks/questions persists.
- Editing an already-assigned lesson updates student view without breaking in-progress attempts.
- Removing a classroom assignment removes the lesson from student catalog.
- All question types render correctly in both preview and student exercise modal.
- Post created in flow appears in classroom feed in real time.

**Deliverable:** `l3-flow-teacher-content.md`.

### L4. Parent Linking & Monitoring Flow Logic

Walk: Parent → link child by student UUID → child appears in Children tab → click child → child progress loads → posts from child's classrooms appear in parent feed → parent comments → comment visible to student and teacher.

Audit checks:

- Wrong UUID shows a clear error; right UUID shows confirmation.
- Linking twice for same student is rejected gracefully.
- Child progress numbers match what the student sees on their own progress page (no drift).
- Parent cannot see classrooms the child is NOT enrolled in (negative test).
- Unlinking a child removes their posts/progress from parent view immediately.
- Parent profile correctly displays multiple linked children.

**Deliverable:** `l4-flow-parent.md`.

### L5. Admin Provisioning Flow Logic

Walk: Admin → create teacher user → create student user → link parent-student → create classroom under that teacher → enroll the student → create syllabus item → create lesson under syllabus → assign lesson to the classroom → verify teacher sees classroom + lesson, student sees lesson, parent sees classroom posts.

Audit checks:

- Created users can immediately log in with set password.
- Disabling a user mid-flow blocks their login but preserves their data.
- Classroom rename propagates to student/teacher/parent views.
- Syllabus delete cascades sensibly (lessons should not vanish silently — should warn or block).
- Lesson assignment with due date is honored (visible in classroom lesson list).
- Stats page numbers update after each provisioning step.

**Deliverable:** `l5-flow-admin.md`.

---

## 4. Stage 4 — Security & Production-Readiness (parallel, 4 workstreams)

### W20. Authorization Matrix

- **Goal:** prove every protected endpoint enforces the right role.
- **Method:** programmatic matrix — for every route in README's "Backend API Surface", attempt as each role (student/teacher/parent/admin/unauthenticated/guest) and a foreign tenant where applicable. Record HTTP status.
- **Pass criteria:** matches expectations (e.g., student cannot `POST /classroom`, teacher cannot `POST /admin/users`, parent cannot read non-linked-child progress, foreign teacher cannot edit another teacher's lesson).
- **Deliverable:** `w20-authz-matrix.md` with a full route × role table.

### W21. Production Hardening Audit

- **Goal:** verify the production-mode toggles documented in README actually take effect.
- **Checks:**
  - With `NODE_ENV=production` and placeholder secrets → API fails fast.
  - `DEMO_ADMIN_LOGIN_ENABLED=false` → `admin@tusyen.test` login returns 403.
  - `PUBLIC_ADMIN_REGISTRATION_ENABLED=false` → register admin role blocked.
  - `JWT_ACCESS_EXPIRES_IN=1h` enforced (token exp claim).
  - `AUTH_COOKIE_SECURE=true` → cookie flags right.
  - `ALLOW_GUEST_QUIZ_JOIN=false` → `/quiz/join` requires auth.
  - `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS` and `CORS_ALLOWED_ORIGINS` reject foreign origins (no wildcard accepted).
  - `MINIO_USE_SSL=true` enforced in production; HTTP MinIO endpoint refused.
- **Deliverable:** `w21-production-hardening.md`.

### W22. WebSocket Auth & Isolation

- **Goal:** WS channels cannot be cross-subscribed.
- **Checks:**
  - Connect to `/ws/classroom/:id` without token → rejected.
  - Connect with student token for classroom they are not enrolled in → rejected.
  - Quiz WS with stale/invalid participant token → rejected.
  - Reconnect storm: 50 concurrent reconnects don't crash server (`docker logs api`).
- **Deliverable:** `w22-websocket-security.md`.

### W23. Input Validation & Abuse

- **Goal:** XSS, SQLi, oversized payloads, malformed bodies, path traversal in storage.
- **Method:** send malicious payloads to text fields (post body, comment, profile bio, lesson title, syllabus topic). Confirm output is escaped in feed renders (React already escapes; verify no `dangerouslySetInnerHTML` slipped in). Try a 100MB upload — should hit a configured cap.
- **Deliverable:** `w23-input-validation.md` with each vector → handled/issue.

---

## 5. Stage 5 — Synthesis & Final Report (sequential, 1 workstream)

### W24. Aggregate & Triage

- **Goal:** consolidate every workstream report into a single QA/QC summary suitable for a release decision.
- **Tasks:**
  - Read all `w*.md` deliverables.
  - Produce `docs/qaqc-results-2026-05-17/SUMMARY.md` with:
    - **Overall status:** GREEN / YELLOW / RED.
    - **Coverage matrix:** workstream → result → key issues.
    - **Defect list** classified by severity (Blocker / Major / Minor / Cosmetic), each with: title, repro steps, expected vs actual, file/route reference, suggested owner.
    - **Recommended next actions** (top 5).
  - Append a section "Untested / out-of-scope" so reviewers know the boundary.

---

## Parallelization Map

```
Stage 0  (sequential)
   │
   ▼
Stage 1   W1 ┬ W2 ┬ W3 ┬ W4                                       (4 parallel)
   │
   ▼
Stage 2   W5 ┬ W6 ┬ W7 ┬ W8 ┬ W9 ┬ W10 ┬ W11 ┬ W12 ┬ W13           (9 parallel)
   │
   ▼
Stage 3   W14 ┬ W15 ┬ W16 ┬ W17 ┬ W18 ┬ W19                       (6 parallel)
   │
   ▼
Stage 3.5 L1 ┬ L2 ┬ L3 ┬ L4 ┬ L5                                  (5 parallel)
   │
   ▼
Stage 4   W20 ┬ W21 ┬ W22 ┬ W23                                   (4 parallel)
   │
   ▼
Stage 5   W24                                                     (sequential)
```

Stages 2, 3, 3.5, and 4 can also be **overlapped** if the executor has enough agents — they only depend on Stage 0/1 being complete (Stage 1 confirms the build is sane before deep dives). A safe order is:

1. Run Stage 0.
2. Kick off Stage 1 in parallel.
3. As soon as W1 and W3 are green, kick off Stages 2 + 3 + 3.5 + 4 in parallel (they don't depend on each other).
4. After everything finishes, run Stage 5.

Total agent slots needed for maximum parallelism: **28 concurrent workstreams** (W1–W23 + L1–L5), plus 1 for Stage 0 and 1 for Stage 5 (W24).

## Run-ID & Isolation Rules

- Every workstream that creates persistent data MUST namespace with a unique run-id (e.g., `w7-2026-05-17-<uuid>` in user emails/classroom names) so parallel runs don't collide and cleanup is easy.
- Workstreams MUST NOT delete the demo seed accounts (`student@tusyen.test`, etc.).
- After completing, each workstream should attempt best-effort cleanup of its own QA users/classrooms.

## File Layout for Deliverables

```
docs/qaqc-results-2026-05-17/
├── _env-snapshot.md
├── SUMMARY.md                ← Stage 5 final
├── w1-backend-tests.md
├── w2-flutter.md
├── w3-playwright-smoke.md
├── w4-playwright-full.md
├── w5-auth-keycloak.md
├── w6-admin-api.md
├── w7-learning-progress.md
├── w8-feed-realtime.md
├── w9-classroom.md
├── w10-quiz.md
├── w11-whiteboard.md
├── w12-storage-sync.md
├── w13-pwa.md
├── w14-student-ui.md
├── w15-teacher-ui.md
├── w16-parent-ui.md
├── w17-admin-ui.md
├── w18-flutter-smoke.md
├── w19-i18n.md
├── l1-flow-student-learning.md
├── l2-flow-quiz.md
├── l3-flow-teacher-content.md
├── l4-flow-parent.md
├── l5-flow-admin.md
├── w20-authz-matrix.md
├── w21-production-hardening.md
├── w22-websocket-security.md
├── w23-input-validation.md
└── screenshots/
    ├── student/{desktop,mobile}/*.png
    ├── teacher/{desktop,mobile}/*.png
    ├── parent/{desktop,mobile}/*.png
    └── admin/{desktop,mobile}/*.png
```

## Severity Definitions (for W24 triage)

- **Blocker** — feature unusable for its primary role, data loss, security hole, login broken.
- **Major** — feature works but a key path fails or returns wrong data; visible to end users.
- **Minor** — non-blocking bug, recoverable, narrow surface (one button mislabeled, wrong icon).
- **Cosmetic** — visual/copy/i18n nit with no functional impact.

## Done Definition

QA/QC is **complete** when:

1. All 28 workstream deliverables exist in `docs/qaqc-results-2026-05-17/` (W1–W23 + L1–L5).
2. `SUMMARY.md` (W24) exists with an overall status verdict.
3. All Blocker and Major defects have a tracked follow-up (issue or PR draft).
4. The environment snapshot (`_env-snapshot.md`) makes the run reproducible.
5. The baseline known UI defect (quiz summary missing user's answer / correct answer / explanation) appears in the defect log with a proposed fix file/line.
