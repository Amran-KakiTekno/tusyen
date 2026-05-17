# Tusyen Platform — Definitive Feature & Flow Specification

**Date:** 2026-05-17  
**Scope:** Every feature, flow, and role across backend, web app, Flutter app, and QA tests.  
**Purpose:** Single source of truth for what each feature should do, what is working, what is incomplete, and what needs fixing.

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Authentication & Session](#2-authentication--session)
3. [Role: Student](#3-role-student)
4. [Role: Teacher](#4-role-teacher)
5. [Role: Parent](#5-role-parent)
6. [Role: Admin](#6-role-admin)
7. [Classroom Management](#7-classroom-management)
8. [Learning & Lessons](#8-learning--lessons)
9. [Progress Tracking](#9-progress-tracking)
10. [Quiz System](#10-quiz-system)
11. [Class Feed (Posts)](#11-class-feed-posts)
12. [Whiteboard](#12-whiteboard)
13. [Notifications (NTFY)](#13-notifications-ntfy)
14. [Offline Sync](#14-offline-sync)
15. [Textbook Extraction](#15-textbook-extraction)
16. [Flutter Mobile App](#16-flutter-mobile-app)
17. [Internationalisation (BM/EN)](#17-internationalisation-bmen)
18. [Infrastructure & DevOps](#18-infrastructure--devops)
19. [QA Test Coverage](#19-qa-test-coverage)
20. [Issue Registry](#20-issue-registry)

---

## 1. Platform Overview

Tusyen is a Malaysian secondary-school (Form 4–5, KSSM) learning platform with four user roles: **Student**, **Teacher**, **Parent**, **Admin**.

### Core stack

| Layer | Technology |
|-------|-----------|
| Backend API | Fastify (Node.js / TypeScript), port 3000 |
| Database | PostgreSQL 16 |
| Cache / session | Redis 7 |
| Auth (SSO option) | Keycloak 24 (PKCE flow) |
| Real-time | Centrifugo 5 + WebSocket handler on backend |
| Storage | MinIO (S3-compatible) |
| Push notifications | NTFY |
| Reverse proxy | Caddy 2 |
| Web client | React 18, no build step (CDN + pre-bundled JSX) |
| Mobile client | Flutter (Dart) |

### URL routing (Caddy)

| Path | Target |
|------|--------|
| `/api/*` | Fastify API |
| `/ws/*` | Fastify WebSocket |
| `/auth/*` | Keycloak |
| `/centrifugo/*` | Blocked (404) |
| `/minio/*` | Blocked (404) |
| `/*` (default) | Static web app |

---

## 2. Authentication & Session

### 2.1 Registration (local)

**Expected flow:**
1. POST `/api/auth/register` with `email`, `password`, `fullName`, `role`.
2. Password hashed with bcrypt (salt 10).
3. Response: `{ token, refreshToken, user }`.
4. Gated by `PUBLIC_ADMIN_REGISTRATION_ENABLED` for admin role creation.

**Status:** ✅ Implemented.  
**Known issues:**
- No email verification step — accounts are active immediately.
- No minimum password strength beyond 8 characters (no uppercase/symbol requirement).

### 2.2 Login (local)

**Expected flow:**
1. POST `/api/auth/login`.
2. Rate-limited: 5 attempts per 60 s per IP.
3. Brute-force lockout: 10 failures in 60 min → 15 min account lock.
4. On success: issues signed JWT (1 h TTL) + opaque refresh token stored in Redis.
5. Tokens returned in body AND set as `HttpOnly` cookies.

**Status:** ✅ Implemented.  
**Known issues:**
- Demo admin account `admin@tusyen.test` hardcoded in source; must be removed before production.
- Failed-login path does not differentiate between "email not found" and "wrong password" (good) but the error string may still hint at admin-account existence in edge cases.

### 2.3 Token refresh

**Expected flow:**
1. POST `/api/auth/refresh` with `refreshToken` in body or cookie.
2. Validates HMAC-SHA256 hash stored in Redis.
3. Issues new access + refresh tokens; old refresh token is revoked.

**Status:** ✅ Implemented.  
**Known issues:**
- Web app client does not refresh tokens on app resume (tab focus). Stale token can persist until next API call triggers a 401.

### 2.4 Logout

**Expected flow:**
1. POST `/api/auth/logout`.
2. Access token `jti` added to Redis deny-list.
3. Refresh token deleted from Redis.
4. Cookies cleared.

**Status:** ✅ Implemented.

### 2.5 Keycloak SSO (PKCE)

**Expected flow:**
1. GET `/api/auth/keycloak/status` — returns realm, client ID, flow config (public, no secrets).
2. POST `/api/auth/keycloak/login-url` — server generates PKCE code verifier + challenge, stores verifier in Redis (10 min TTL), returns redirect URL.
3. Browser redirects to Keycloak; user authenticates.
4. Keycloak redirects back to `/keycloak-callback` (web) or `eduapp://callback` (Flutter).
5. POST `/api/auth/keycloak/callback` — exchanges code for tokens, validates JWKS, upserts user in DB.

**Status:** ✅ Backend implemented. ❌ Web UI OAuth callback page not implemented — the `/keycloak-callback` route is not rendered in the React app shell; users who complete Keycloak login will see a blank page.  
**Known issues:**
- Account takeover risk: if a Keycloak user's email matches a local account from a different realm, the system merges them (line 427 keycloak.ts). Must enforce `keycloak_subject` uniqueness per realm.
- Default role fallback is `student` — a Keycloak admin user without the expected role claim will be demoted.
- Role claim check order: `role`, `app_role`, `eduapp_role`, `tusyen_role`, then `realm_access.roles`, then `resource_access`. This is correct but must be kept in sync with Keycloak realm config.

### 2.6 Change password

**Expected flow:**
1. POST `/api/auth/change-password` (authenticated).
2. Verifies `currentPassword` via bcrypt compare.
3. Updates `password_hash`.

**Status:** ✅ Implemented.

### 2.7 Session storage

- Access tokens: JWT, stored in `localStorage` on web; Flutter secure storage on mobile.
- Refresh tokens: stored in `localStorage` on web; device keychain on mobile.
- Revocation: access token `jti` stored in Redis with same TTL; checked on every authenticated request.

---

## 3. Role: Student

### 3.1 Dashboard

**Expected:**
- Greeting by time of day (Selamat Pagi / Petang / Malam) with first name.
- XP total, current level (1 XP per lesson point, level = floor(xp/250)+1), tier label (Pelajar Baru → Tekun → Maju → Elit).
- Hearts / lives remaining (default 5/5), fetched from `/progress/student/:id/hearts`.
- Daily target: lessons attempted today vs. daily target (default 1).
- Streak count (days active consecutively).
- Quick-access cards: My Classes, Assignments, Leaderboard, Badges.

**Status:** ✅ UI rendered. Stats fetched from `/progress/student/:id/stats` with 5 min cache.  
**Issues:**
- Leaderboard on dashboard is **hardcoded** (LEADERBOARD_BASE) — rank 4 is always labelled "Kamu" regardless of actual user position. API endpoint `/progress/classroom/:id/leaderboard` exists in client but is not wired to the dashboard widget.
- Badges section is **hardcoded** — six static achievements (Streak 7 Hari, Pelajar Pantas, Markah Sempurna, Top 3 Kelas, Pelajar Elit, Penguasa Algebra) with fixed earned states. Real badge data is available via `/progress/me/achievements` but is not consumed.
- Hearts display shows "null" until API responds; loading state text is missing.

### 3.2 Subject selector & skill tree

**Expected:**
- Six subjects: Matematik, Biologi, Fizik, Kimia, Sejarah, Geografi — matching student's enrolled classroom subjects.
- Subjects sorted so enrolled subjects appear first.
- Each subject has a skill tree (5 nodes) showing done/current/locked state.
- Skill node tap → opens lesson catalog filtered to that topic.

**Status:** ✅ Subject list and skill tree rendered. Sorting by enrolled classrooms works.  
**Issues:**
- Skill tree nodes are **hardcoded per-subject fallbacks** (SUBJECT_SKILL_FALLBACKS). There is no API that returns topic-level completion data to drive real locked/done states. All subjects show all nodes as locked except node 1.
- The app does not fetch syllabus topics from `/learning/syllabus` to populate the skill tree — this API exists but is unused here.
- "Geografi" subject has no color in `SUBJ_COLOR` in teacher.jsx (is correctly defined in student.jsx SUBJECTS array).

### 3.3 Lesson catalog & learning

**Expected:**
- GET `/learning/catalog` — searchable by subject, form level, difficulty, keyword.
- GET `/learning/lessons` — assigned lessons for enrolled classrooms.
- Lesson card shows: title, topic/subtopic (from syllabus link), subject icon, form level, difficulty badge, due date, completion %, estimated minutes.
- Lesson detail: summary, content blocks (text, image, video, embed), examples, attached resources.
- Lesson submission: POST `/learning/lessons/:id/submit` with answers array, time spent.
- Free-learning mode: `classroom_id IS NULL` in progress table (migration 015).

**Status:** ✅ Lesson catalog renders. Lesson detail parses JSONB content blocks including attachments.  
**Issues:**
- Lesson content is JSONB free-form; the renderer tries multiple field names (`body`, `text`, `description`, `caption`) — inconsistent content authoring can produce blank blocks.
- No pagination in the lesson catalog UI (API supports `limit`/`offset` but the UI fetches up to 100 at once).
- Video embeds (YouTube, Vimeo, Loom) render as `<a href>` links, not inline players — the CSP allows iframes from those domains but no `<iframe>` embed component exists in the web app.
- Lesson submission does not validate that all required questions were answered before submitting.

### 3.4 Progress & stats

**Expected:**
- XP total, streak, completion %, average score, lessons attempted/completed.
- By-subject breakdown with average completion per subject.
- Today's activity (lessons attempted, completed vs. target).
- Progress rows fetched from `/progress/student/:id`.

**Status:** ✅ Stats endpoint caches correctly (5 min, Redis key `stats:student:{id}`).  
**Issues:**
- No pagination on `/progress/student/:id` — for a student with hundreds of lessons this returns all rows.
- By-subject breakdown relies on `subject` field in `lessons` table matching subject names in SUBJECTS constant — case-sensitive and locale-sensitive matching is handled by subject alias logic but is fragile.

### 3.5 Quiz participation (live session)

**Expected:**
- Student enters 6-digit PIN provided by teacher.
- PIN validated against active session; student joins as participant (authenticated) or guest (optional, controlled by `ALLOW_GUEST_QUIZ_JOIN`).
- Lobby: waits for teacher to start; sees participant list and count.
- Active: displays question with timer countdown; student selects answer and submits.
- Between questions: sees whether their answer was correct, points awarded.
- Final: leaderboard sorted by total score, then accuracy, then response time.

**Status:** ✅ Quiz join, question display, answer submission, and leaderboard implemented.  
**Issues:**
- Centrifugo real-time channel receives events but the web client also polls via HTTP for session state — duplicate data paths.
- PIN entry field accepts non-numeric characters; client-side validation trims to 6 digits but UX is not clear.
- "Waiting for teacher" lobby does not show participant avatars/names (shows count only).
- Guest join name input has no max-length enforcement on client (server does validate, but error only shown after submit).

### 3.6 Student classroom join

**Expected:**
- Student enters a join code (e.g., `MTH-4A2`) from teacher.
- POST `/classroom/join-by-code` with `{ joinCode }`.
- Enrolled in classroom; appears in teacher's roster.

**Status:** ✅ API endpoint implemented. Web UI has a "Sertai Kelas" entry in the class section.  
**Issues:**
- No brute-force protection on `/classroom/join-by-code` — join codes are 6-character alphanumeric but the endpoint is not rate-limited by code (only implicitly by the global auth rate limiter).
- After successful join, UI does not automatically refresh the classroom list without a page reload.

---

## 4. Role: Teacher

### 4.1 Dashboard

**Expected:**
- List of owned active classrooms with: student count, average completion %, at-risk count, last activity timestamp.
- "At-risk" defined as: score < 60% OR (attempts ≥ 2 AND completed/attempted < 50%).
- Weekly activity chart (Mon–Fri activity counts for each classroom).
- Quick actions: create class, start quiz, new post.

**Status:** ✅ Live data fetched from `/classroom` (teacher query includes `at_risk_count`, `average_progress`, `progress_count`).  
**Issues:**
- Weekly activity chart uses **hardcoded fallback** (WEEK_DATA = [62, 74, 55, 82, 71]) when `classroomId` is not a UUID (i.e., demo mode). Live data path calls `/classroom/:id/analytics` which returns `weeklyActivity` — this is wired but the day-of-week mapping assumes Monday–Friday locale, which will be wrong if `data.day` returns ISO weekday numbers instead of Malay day names.
- `average_progress` for a classroom with no progress rows returns `null` (AVG of empty set) — UI handles this correctly with `clampPercent` returning null, but the display shows "—" which may confuse teachers expecting "0%".

### 4.2 Class management

**Expected:**
- Create classroom: name, subject (from 13-subject list), form level (1–5), description, public/private toggle.
- Edit classroom: name, description, subject, form level.
- Archive classroom (soft delete, sets `is_active = false`).
- View join code; copy invite text to clipboard.
- Remove individual students from roster.

**Status:** ✅ Create, archive, student remove implemented.  
**Issues:**
- Edit classroom endpoint (`PATCH /classroom/:id`) exists in `app.js` client but the **teacher UI does not render an edit form** — the classroom can only be created, not updated, from the web interface.
- Form level selector in create-class form allows values 1–5 (CLASS_FORM_LEVELS array) but the classroom schema only validates form_level ∈ {4, 5}. Submitting form level 1–3 will be rejected by the backend with a 400, but the UI shows no error message — it silently fails.

### 4.3 Lesson assignment

**Expected:**
- Search lesson catalog (GET `/learning/catalog`) by subject/form/difficulty/keyword.
- Assign lesson to classroom: POST creates entry in `classroom_lessons`, optional due date and required flag.
- View assigned lessons per classroom; see student completion counts.
- Remove lesson assignment from classroom.

**Status:** ✅ Lesson search and assignment wired.  
**Issues:**
- Lesson **creation** (POST `/admin/lessons`) is in the admin UI, not the teacher UI. Teachers cannot author new lessons from the web app — they can only assign existing catalog lessons. This may be intentional (admin-curated content) but is not documented and creates confusion.
- No UI to mark a lesson as "required" when assigning — the backend supports `is_required` but the assign form does not expose it.

### 4.4 Class feed — posts

**Expected:**
- Create posts of type: Pengumuman (announcement), Tugasan (assignment), Perbincangan (general discussion).
- Optional title, content body, attachment (URL to image/video/embed/link).
- Pin/unpin post.
- Delete own post.
- Students can comment; teacher can reply and delete any comment.

**Status:** ✅ Post creation, pin, delete, comments wired.  
**Issues:**
- Attachment creation only accepts a URL string (pasted URL auto-detected as image/video/embed) — no file upload from disk in the post composer. File upload requires using the media upload API separately and pasting the returned URL.
- After creating a post the feed does not auto-scroll to the new post; teacher must scroll manually.
- Comment submission silently swallows errors — `catch {}` with no feedback.

### 4.5 Student analytics (per classroom)

**Expected:**
- Roster table: student name, average score, streak, lessons attempted, lessons completed, last active date, risk flag.
- Drill down on student: view subject breakdown, recent progress rows.
- Weak topics widget: topics with lowest average score (from `/classroom/:id/analytics`).

**Status:** ✅ Roster fetched from `/progress/classroom/:id`; analytics from `/classroom/:id/analytics`.  
**Issues:**
- `average_score` for a student with no progress is `null` — displayed as "—". Risk flag is `null < 60 = false` so students with zero submissions are **not** flagged as at-risk, even though they have done nothing.
- No sorting controls on the roster table — order is determined by backend query (joined_at DESC by default).

### 4.6 Quiz deck management

**Expected:**
- List owned decks (GET `/quiz/decks`).
- Create/edit deck: title, subject, form level, questions (each with: type, question text, options, correct answer, explanation, per-question time limit in seconds).
- Duplicate deck (POST `/quiz/decks/:id/duplicate`).
- Delete deck.
- All 14 STEM question types supported (migration 012 applied this to `quiz_deck_questions`).

**Status:** ✅ CRUD implemented. All 14 question types accepted.  
**Issues:**
- Only **multiple_choice** and **true_false** question types have a rendered UI in the quiz deck editor. Attempting to select other types from the dropdown has no dedicated input layout — the form still shows options array input, which is meaningless for `fill_blank`, `matching`, `step_order`, etc.
- No max-question-count per deck enforced (UI or backend).
- Question reordering (drag-and-drop or up/down buttons) is not implemented — `order_index` is set server-side based on array position.

### 4.7 Live quiz session

**Expected:**
- Teacher selects a deck and a classroom, clicks "Mulakan Kuiz".
- POST `/quiz/sessions` returns session with PIN + snapshot.
- Teacher lobby: PIN displayed prominently; list of joined participants.
- Teacher controls: advance to next question (POST `/quiz/sessions/:id/advance`), pause timer, end session.
- Per-question: question + answer options displayed, countdown timer; live correct/incorrect count.
- Results: final leaderboard shown; XP awarded to participants.

**Status:** ✅ Session creation, advance, end, and leaderboard wired.  
**Issues:**
- **Timer pause/resume** columns (`question_paused_at`, `question_remaining_ms`) added in migration 013 but the backend `controlQuizSessionTimer` function and the route `POST /quiz/sessions/:id/timer` are implemented — however the teacher UI **does not render the pause button**. The pause endpoint exists but is unreachable from the UI.
- Session status transitions: `lobby → active → ended` are correct. `cancelled` status is in the DB enum but no cancel endpoint exists — a session can only be ended, not cancelled mid-way.
- Guest participants (`user_id = NULL`) create multiple rows if same guest name joins twice — there is no `UNIQUE(session_id, display_name)` constraint.

---

## 5. Role: Parent

### 5.1 Dashboard

**Expected:**
- List of linked children with summary card: form/class, current streak, XP, weekly study time, class rank, average score.
- Switch between linked children.

**Status:** ✅ UI renders child selector and summary card.  
**Issues:**
- `rank` field: `/progress/student/:id/stats` does not return a classroom rank — rank is currently **null** for all live data; the UI falls back to "—". A rank query joining `student_classroom_stats` and ranking by `avg_score` is not implemented.
- `weekTimeSeconds` (weekly study time) is not in the stats endpoint response — it would require summing `time_spent_seconds` for `updated_at >= start_of_week`. Currently always shows "0j 0m" for live data.

### 5.2 Linking children

**Expected:**
- Parent enters student's Tusyen ID (UUID) or registered email.
- POST `/auth/link-parent` with `{ studentIdentifier }`.
- Backend finds student by UUID or email; creates `parent_student_links` row.
- Parent sees student in linked list.
- Unlink: DELETE `/auth/linked-students/:studentId`.

**Status:** ✅ Link and unlink implemented. Good error messages for common mistakes (class code vs. student ID, duplicate link).  
**Issues:**
- Parent cannot view the student's actual UUID from any UI screen — students need to manually share their UUID or email. There is no "share my student ID" feature on the student dashboard.
- Re-activating a deactivated link (logic at auth/routes.ts ~line 473) succeeds silently — no confirmation shown to parent.

### 5.3 Child progress view

**Expected:**
- Subject breakdown: each subject with average score, trend (↑ ↓ →), color-coded bar.
- Recent activity feed: last 5–10 completed/attempted lessons with timestamps.
- Per-lesson progress list with score, completion %, time spent, date.

**Status:** ✅ Subject breakdown and progress list render from API data.  
**Issues:**
- Trend indicators (↑ ↓ →) are **hardcoded** in `FALLBACK_CHILD.subjects` for demo mode; for live data the trend is not computed — it requires comparing current 7-day average score with previous 7-day average, which no API endpoint provides.
- Recent activity feed for live data uses raw `progress` rows sorted by `updated_at DESC` — shows lesson titles not human-friendly activity descriptions. The FALLBACK_CHILD has descriptive labels like "Selesai pelajaran Matematik Bab 3" but live data just shows lesson titles.

### 5.4 Alerts system

**Expected:**
- GET `/auth/parent/alerts` generates alerts for each linked student:
  - **Low score:** average score in last 14 days < 50%.
  - **Inactivity:** no activity in last 3 days.
  - **Streak:** streak ≥ 7 days (positive alert).
  - **Assignment:** incomplete required assignments with past due dates.
- Alerts have severity (high / medium / good) and can be marked read, dismissed, or flagged for follow-up.
- PATCH `/auth/parent/alerts/status` (single) and `/auth/parent/alerts/status/bulk` (max 50).

**Status:** ✅ Alert generation logic implemented. Status update (read/dismissed/follow-up) wired.  
**Issues:**
- Alert queries run **every call** — full table scans on `progress` and `student_streaks` per linked student, no caching. With many linked students this will be slow.
- Follow-up action label in UI says "Simpan soalan untuk guru" and shows a confirmation that the app does NOT send any message to the teacher — this is the correct behavior, but the label is misleading (it implies contacting the teacher).
- Alert status table (`parent_alert_statuses`) is created on first call (upsert pattern) — not pre-created by migrations; this is fragile if the query fails mid-create.
- Bulk alert status endpoint caps at 50 IDs — this is a reasonable limit but is not communicated in the UI.

### 5.5 Notification preferences

**Expected:**
- Toggle: low score alerts, inactivity alerts, assignment alerts, streak alerts.
- Notification frequency: daily digest / immediate.
- Preferred name, language preference.

**Status:** ✅ Preferences stored locally in `localStorage` key `tusyen_parent_prefs`.  
**Issues:**
- Preferences are **local-only** — they are not synced to the server. If the parent logs in on another device, preferences reset to defaults.
- `notificationFrequency` preference is stored but has no backend effect — NTFY notifications are sent immediately on alert generation regardless of this setting.

---

## 6. Role: Admin

### 6.1 Operations dashboard

**Expected:**
- System health: DB status, Redis status, NTFY status, MinIO storage size.
- User counts: students, teachers, parents, admins, active in last 30 days.
- Trends (growth over last 7 days per role).

**Status:** ✅ Health fetched from `/admin/health`. User stats from `/admin/stats`.  
**Issues:**
- Metrics start as `null` (METRICS_FALLBACK) and only update after health call resolves. There is no loading spinner per metric card — the "Belum disemak" hint text appears briefly then is replaced.
- Trends (`students_trend`, `teachers_trend`) require a time-series query not shown in the stats endpoint — they return `null` until implemented, showing "Tidak tersedia" in the UI.

### 6.2 User management

**Expected:**
- List all users with filters: role, active status, free-text search.
- Pagination: limit 100, offset-based.
- Create user: full name, email, password, role.
- View user detail: profile, parent links, classrooms.
- Update user: full name, role, active status.
- Bulk deactivate: select multiple users, mark inactive (revokes Redis sessions).

**Status:** ✅ List, create, detail, bulk deactivate implemented.  
**Issues:**
- `PATCH /admin/users/:id` route exists in `app.js` client but admin UI only renders a status toggle button — there is **no edit form** for full_name or role. Changing a user's name or role requires a direct API call.
- User creation form does not validate email format client-side — server rejects invalid emails but only after submit.
- User list does not show `last_login` timestamp — it is in the DB but not returned by `GET /admin/users`.

### 6.3 Parent–student links

**Expected:**
- View all parent–student pairs.
- Admin can manually create or deactivate links.

**Status:** ⚠️ Partially implemented. Admin can view user detail (which includes parent links) but there is **no dedicated parent-link management screen** in the admin UI — no create/deactivate link action from admin panel.

### 6.4 Class management (admin view)

**Expected:**
- View all active classrooms across all teachers.
- Filter by teacher, subject, form level.
- Archive any classroom.
- Enroll students manually.

**Status:** ⚠️ Admin can view all classrooms (GET `/classroom` returns all for admin role). Archive calls DELETE `/classroom/:id`.  
**Issues:**
- There is no admin-specific classroom list screen — admin sees the same classroom view as a teacher but with all classrooms visible.
- Manual enrollment endpoint does not exist (no `POST /classroom/:id/enroll` for admin); only student self-join by code is available.

### 6.5 Content management (syllabus, lessons)

**Expected:**
- Syllabus: list, create, update, delete syllabus items (topic/subtopic per subject/form level).
- Lessons: list, create (with JSONB content), soft-delete.
- Textbook sources: view extraction status (from `textbook_sources`).

**Status:** ✅ Syllabus and lesson CRUD implemented in admin routes. Textbook source listing wired.  
**Issues:**
- Lesson **content editor** in the admin UI is a raw JSONB textarea — no structured block editor. Admins must write valid JSON manually.
- No preview of how lesson content will render in the student view.
- `GET /admin/lessons` pagination defaults to 25 per page but the admin UI fetches with default and does not expose page navigation.

### 6.6 System tools

**Expected:**
- View audit log (last N entries of `audit_log` table).
- Clear Redis cache (POST `/admin/cache/clear`).
- Test NTFY notification (POST `/admin/notifications/test`).
- Admin system info (POST `/admin/system`).

**Status:** ✅ All system tool endpoints implemented. UI renders them.  
**Issues:**
- Audit log page size is 20 entries with no load-more. For high-traffic environments this is insufficient for diagnosis.
- Cache clear is a full Redis flush — there is no selective key-pattern clear for specific cache segments.

---

## 7. Classroom Management

### 7.1 Create classroom

**Expected:**
- Teacher creates classroom with name, subject, form level (4 or 5), optional description, public flag.
- 6-character alphanumeric join code generated (10 uniqueness attempts).
- Returns classroom id, name, subject, formLevel, joinCode.

**Status:** ✅ Implemented.  
**Issues:**
- Join code generator uses `Math.random().toString(36).substring(2, 8).toUpperCase()` — cryptographically weak. Should use `crypto.randomBytes`.
- Form level 1–3 accepted by the teacher UI create form (CLASS_FORM_LEVELS = [1,2,3,4,5]) but rejected by the DB constraint (CHECK form_level IN (4, 5)) — backend returns 400 silently in the UI.

### 7.2 Classroom list views

| Role | What is shown |
|------|--------------|
| Teacher | Owned active classrooms + stats |
| Student | Enrolled active classrooms + teacher name |
| Parent | Classrooms of linked students |
| Admin | All active classrooms |

**Status:** ✅ Role-split queries all implemented.

### 7.3 Join by code

**Expected:**
1. Student enters code (POST `/classroom/join-by-code`).
2. Backend finds classroom where `join_code = $1 AND is_active = true`.
3. Creates `classroom_enrollments` row (or reactivates if existing deactivated row).
4. Returns `{ success: true, classroom: { id, name, subject, formLevel } }`.

**Status:** ✅ Implemented.  
**Issues:**
- No rate limiting specific to join-by-code endpoint (not covered by quiz PIN rate limiter).
- Join code is case-insensitive in the UI (`.toUpperCase()` applied) but the DB lookup is case-sensitive — if a code was stored as lowercase it would fail. Code generation always produces uppercase so this is fine in practice but brittle.

### 7.4 Classroom analytics

**Expected:**
- GET `/classroom/:id/analytics` returns: weekly activity counts (per day of week), weak topics (topic + avg score), at-risk count, average progress, progress record count.

**Status:** ✅ Endpoint exists.  
**Issues:**
- "Weekly activity" is measured as count of `progress` rows with `updated_at` in the last 7 days grouped by day-of-week. This counts re-attempts as separate activities, inflating counts.
- "Weak topics" joins `progress → lessons → lesson_syllabus_links → syllabus_items` — missing syllabus links will cause topics not to appear even if scores are low.

---

## 8. Learning & Lessons

### 8.1 Lesson catalog

**Expected:**
- GET `/learning/catalog` — paginated (default 100), filterable by subject, formLevel, difficulty, keyword search.
- Keyword search covers `title` and `content->>'summary'` (JSONB text).
- Returns: id, title, subject, form_level, difficulty, estimated_minutes, content, topic, subtopic, question_count, content_block_count.

**Status:** ✅ Implemented. Full-text search works on title and summary.  
**Issues:**
- Max limit 100 with no server-enforced cap — a client sending `limit=10000` will attempt to return all lessons.
- `content->>'summary'` JSONB path search is not indexed — `idx_lessons_content_gin` (migration 008) covers the whole JSONB column via GIN but the `->>'summary'` path LIKE search does not use it.

### 8.2 Assigned lessons

**Expected:**
- GET `/learning/lessons` — returns lessons assigned to classrooms the requesting user is enrolled in (student) or owns (teacher).
- Includes due date, required flag, completion % for the requesting student.

**Status:** ✅ Implemented.

### 8.3 Lesson detail & submission

**Expected:**
- GET `/learning/lessons/:id` — returns full lesson with content blocks, questions, attachments.
- Media references validated against student's entitlements (`assertCanAttachMediaReferences`).
- POST `/learning/lessons/:id/submit` — upserts `progress` row: score, time_spent_seconds, answers (JSONB), completion_percentage, attempts++.
- Score calculated server-side from submitted answers vs. correct_answer.

**Status:** ✅ Submission scoring implemented for multiple_choice and true_false.  
**Issues:**
- Score calculation for STEM question types (fill_blank, matching, numeric, etc.) is **not implemented** — all non-choice questions default to 0 points. This means STEM-heavy lessons always score 0.
- `answers` JSONB saved as-is from client with no validation beyond type check — XSS-safe since it's JSONB not rendered HTML, but schema drift is possible.
- No "lesson completion" event triggers achievement check — XP is awarded but badge checking is not triggered on submission.

### 8.4 Lesson content blocks

**Expected content block types:**

| Type | Expected rendering |
|------|--------------------|
| `text` | Paragraph text |
| `image` | Img tag with lazy loading |
| `video` | External video embed (YouTube/Vimeo/Loom) |
| `embed` | Same as video |
| `link` | Anchor tag |
| `file` | Download link |

**Status:** ⚠️ Web app renders attachments as linked cards (`<a href>`) regardless of type. Inline iframe embeds are **not implemented** despite CSP allowing them.  
**Issues:**
- `<iframe>` embed component does not exist in the web app — video content is shown as a link, requiring the student to open a new tab.
- Images in content blocks are rendered if `thumbnailUrl` or `url` is present but no error fallback if the image URL is broken.

---

## 9. Progress Tracking

### 9.1 Progress record (per student per lesson)

**Schema:** `progress(student_id, lesson_id, classroom_id [nullable], score, time_spent_seconds, completion_percentage, answers JSONB, attempts, is_completed, created_at, updated_at)`

- `classroom_id = NULL` means free/self-directed learning (migration 015).
- UNIQUE constraint: `(student_id, lesson_id, classroom_id)` — one record per student per lesson per classroom. Free learning has a separate unique index on `(student_id, lesson_id) WHERE classroom_id IS NULL`.

### 9.2 Stats endpoint

**GET `/progress/student/:id/stats`** returns:
- Total XP (sum of scores), streak (days consecutive), completion % (avg), lessons attempted, lessons completed.
- By-subject breakdown: average completion per subject.
- Today: lessons attempted/completed today.
- Quiz summary: sessions joined, correct count, avg score.
- Cached 5 min (Redis).

**Status:** ✅ Implemented and cached.  
**Issues:**
- Streak count queries `student_streaks` table which is only populated when a streak-check call is made (POST `/progress/streak/check`). If a student completes lessons without triggering this endpoint, their streak will be 0 even though they are active daily. The web app calls this on login but not on lesson submit.
- No `rank` in stats response (noted in Parent section — affects student dashboard rank display too).

### 9.3 Hearts (lives)

**Schema:** `student_hearts(student_id PK, current_hearts [0..max], max_hearts default 5)`

**GET `/progress/student/:id/hearts`** returns `{ hearts: { current_hearts, max_hearts } }`.

**Status:** ✅ Table exists. Endpoint returns data.  
**Issues:**
- Hearts are **never decremented** anywhere in the codebase — no lesson-fail or quiz-fail logic reduces hearts. The table exists and is read but has no write path beyond the initial seeding at migration 014. Hearts display is decorative only.

### 9.4 Achievements

**GET `/progress/me/achievements`** returns earned badges.

**Status:** ✅ `user_achievements` table and endpoint exist.  
**Issues:**
- Achievement check is **not triggered** on lesson submission or quiz completion — there is no code that evaluates streak milestones, perfect scores, or XP thresholds and creates `user_achievements` rows automatically.
- The 6 badges shown in the student UI are hardcoded with static earned states (3 earned, 3 not). The real API is never called.

### 9.5 Classroom progress (teacher view)

**GET `/progress/classroom/:id`** returns per-student stats for a classroom.

**Status:** ✅ Implemented.  
**Issues:**
- The materialized view `student_classroom_stats` is not used in this endpoint — it runs a live aggregate query on every call. The view exists but is never refreshed and never queried.

---

## 10. Quiz System

### 10.1 Quiz deck

**Table:** `quiz_decks(id, teacher_id, title, description, subject, form_level, is_active)`  
**Table:** `quiz_deck_questions(id, deck_id, question_text, question_type [14 types], options, correct_answer, explanation, points, time_limit_seconds, order_index)`

**Status:** ✅ CRUD for decks and questions implemented. Migration 012 expanded question types to match lesson question types.

### 10.2 Session lifecycle

| Status | Meaning |
|--------|---------|
| `lobby` | Created, waiting for participants |
| `active` | Teacher advanced first question |
| `ended` | Teacher ended session; final leaderboard saved |
| `cancelled` | Enum value exists but no transition to it |

- Only **one active/lobby session per classroom** enforced by DB partial unique index.
- Session state (current question index, timer, participant answers) cached in Redis (`quiz:session:{id}:state`, 7-day TTL) in addition to DB rows.

### 10.3 Answer scoring

- Multiple choice / true_false: exact match of `selected_answer` vs. `correct_answer`.
- Points awarded inversely proportional to response time (faster = more points up to `time_limit_seconds`).
- XP awarded to authenticated participants at session end.

**Status:** ✅ Scoring and XP award implemented.  
**Issues:**
- STEM question types (fill_blank, matching, numeric, step_order, etc.) in quiz decks have no scoring logic — correct_answer comparison falls through to a default 0.
- No partial credit for matching questions (e.g., 3/4 pairs correct).

### 10.4 Real-time events (Centrifugo)

**Events published to `classroom:{classroomId}` channel:**

| Event | Payload |
|-------|---------|
| `quiz_session_started` | session snapshot |
| `quiz_question_shown` | question + options (no correct_answer), timer |
| `quiz_answer_received` | anonymized (participant count only) |
| `quiz_question_ended` | correct answer revealed |
| `quiz_session_ended` | final leaderboard |

**Status:** ✅ Events published via `publishQuizSessionEvent`.  
**Issues:**
- Centrifugo namespace `classroom` allows client publish (which should be disabled for quiz to prevent spoofing). Config shows `publish: false` — this is correct but must be verified as `publish: false` is the Centrifugo default and may not be explicitly set in `config.json`.
- Centrifugo `allowed_origins` in `config.json` is hardcoded to `localhost` and `127.0.0.1` — production domains must be added here or it will block WebSocket connections.

### 10.5 Student quiz summary

**GET `/quiz/student/summary`** (via `getStudentQuizSummary`) returns: sessions joined, avg score, total correct, total answered.

**Status:** ✅ Implemented and included in stats endpoint.

---

## 11. Class Feed (Posts)

### 11.1 Post types

| Type | Purpose |
|------|---------|
| `announcement` | Important notice (blue) |
| `assignment` | Homework / task (gold) |
| `general` | Discussion / note (green) |

### 11.2 Post CRUD

- GET `/feed/posts?classroomId=&limit=` — sorted: pinned first, then created_at DESC.
- POST `/feed/posts` — teacher/admin only; optional title, body, post_type, isPinned, attachments array.
- PATCH `/feed/posts/:id` — teacher/admin, own post only (or admin any).
- DELETE `/feed/posts/:id` — soft delete (sets `is_active = false`).
- POST `/feed/posts/:id/pin` — toggle pin.
- GET `/feed/posts/:id/comments` — comment list.
- POST `/feed/posts/:id/comments` — any enrolled user can comment.
- DELETE `/feed/posts/:id/comments/:cid` — own comment or teacher/admin.

**Status:** ✅ All endpoints implemented and wired in teacher UI.  
**Issues:**
- Student UI renders the feed in read-only mode — students can see posts but the **comment input is not rendered** in the student component. Students cannot comment from the web app (Flutter may have this; not confirmed).
- Reaction endpoint referenced in teacher UI code (`onReact`) calls `window.tusyenApi.reactPost` — this method does not exist in `app.js`. Post reactions are UI-only placeholder with no backend.
- Pin toggle is rendered for all post types but the UI does not distinguish a pinned assignment from a pinned announcement visually (only the "Disemat" badge changes).

---

## 12. Whiteboard

### 12.1 Feature description

Real-time collaborative whiteboard inside a classroom, accessible during class sessions.

### 12.2 WebSocket handler

- Upgrade: `GET /ws/classroom/:classroomId`.
- Auth: must send `{type:'AUTH', token:'...'}` JSON message within 10 s of connection.
- Actions supported: `WHITEBOARD_DRAW` (stroke persist + broadcast), `WHITEBOARD_CLEAR` (teacher only), `CHAT_MESSAGE` (broadcast).
- Payload max: 100 KB per event.
- Presence: user presence tracked in Redis with 5 min TTL; stale entries possible.

### 12.3 Status

**Status:** ✅ WebSocket handler implemented.  
**Issues:**
- Whiteboard strokes are persisted to `whiteboard_sessions` table (migration 007) but **no UI to replay or view past whiteboard sessions** exists in the web app.
- `WHITEBOARD_CLEAR` is teacher-only enforced by role check but the student UI does not hide the clear button — it renders and silently fails with a 403 response.
- No whiteboard in the web app — it exists only in the Flutter mobile app and Playwright tests.

---

## 13. Notifications (NTFY)

- Backend sends push notifications via NTFY service for: lesson assigned, alert generated.
- Admin can test notification: POST `/admin/notifications/test`.
- Parent alerts generate NTFY pushes if `NTFY_AUTH_TOKEN` configured.

**Status:** ✅ NTFY integration implemented.  
**Issues:**
- `notificationFrequency` parent preference (daily/immediate) is stored locally but has no effect on NTFY dispatch — all notifications are sent immediately.
- NTFY topic is global per user (based on user ID) — there is no per-alert-type topic filtering.

---

## 14. Offline Sync

### 14.1 Design

- Device registers with `(device_id, user_id)` in `device_syncs` table.
- Client pushes local changes: POST `/sync/push` — validated against `syncTableColumns` whitelist.
- Server pushes server changes: POST `/sync/pull` — returns rows changed since `lastSyncAt`.
- Conflict resolution: POST `/sync/resolve` — client chooses `local_wins`, `server_wins`, or `merged`.
- GET `/sync/status` — returns `last_sync_at`, `sync_token`.

### 14.2 Status

**Status:** ✅ Backend sync routes implemented.  
**Issues:**
- Web app does not call any sync endpoints — sync is Flutter-only.
- Conflict resolution is **manual-only** — the user must explicitly resolve; there is no auto-merge strategy.
- `sync_conflicts` table has no FK on `resolved_by` — referential integrity gap.
- No test coverage for push/pull/conflict flows.

---

## 15. Textbook Extraction

### 15.1 Pipeline

- Python scripts (`scripts/extract_stem_textbooks_to_db.py`, `scripts/ocr_missing_text_pages_to_sidecars.py`) extract KSSM textbook PDFs into DB.
- `textbook_sources` → `textbook_files` → `textbook_pages` → `textbook_lessons` (linked to `lessons` via `linked_lesson_id`).

### 15.2 Status

**Status:** ✅ Schema implemented (migration 011). Scripts exist.  
**Issues:**
- Admin UI shows `textbook_sources` list with extraction status but has **no trigger UI** — scripts must be run manually from CLI.
- `linked_lesson_id ON DELETE SET NULL` — orphaned textbook lessons are not cleaned up if the linked lesson is deleted.
- GIN indexes on `metadata` and `content` fields added but the lesson search endpoint does not query `textbook_lessons` directly — it queries the `lessons` table, so textbook content is only searchable if it was linked to a lesson entry.

---

## 16. Flutter Mobile App

### 16.1 Features present

- Login / Keycloak OAuth (PKCE via `eduapp://callback`).
- Class enrollment, lesson viewing, lesson submit.
- Whiteboard (draw strokes, receive broadcast, screen recording).
- Quiz participation (PIN join, answer submit, leaderboard).
- File picker for media upload.
- Video playback (YouTube/Vimeo/Loom via `external_video_embed`).
- Secure token storage (`flutter_secure_storage`).
- Sync push/pull.

### 16.2 Known gaps

- No offline content cache (no local DB like Hive/Isar visible in dependencies).
- No push notification integration with NTFY on mobile.
- No parent or admin UI in Flutter — these roles use the web app.
- Flutter app does not call `/progress/streak/check` after lesson submission — streak will not update in real time on mobile.

---

## 17. Internationalisation (BM/EN)

### 17.1 What exists

- Language toggle (BM/EN) stored in `localStorage` key `tusyen_language`.
- `STATIC_TRANSLATIONS` map in `shared.jsx` with ~80 BM → EN pairs.
- `languageText(ms, en)` helper for inline bilingual strings.
- `useLanguage()` hook with `t(ms, en)` shorthand.
- `scheduleStaticTranslation(language)` applies translations to static DOM text nodes.

### 17.2 Gaps

- **~40% of UI strings** in teacher.jsx, parent.jsx, admin.jsx use hardcoded Malay only — no `t()` wrapper or STATIC_TRANSLATIONS entry.
- Specifically missing translations for:
  - Teacher: form helper text ("Kod Kelas untuk pelajar sertai"), post composer placeholders, analytics labels.
  - Parent: alert action labels ("Tandai untuk tindak lanjut"), preferences screen labels.
  - Admin: metric threshold descriptions, system tool button labels.
  - Student: skill tree node sub-labels (e.g., "Struktur dan fungsi"), badge descriptions.
- `STATIC_TRANSLATIONS` is applied via DOM text-node replacement — does not work for dynamically rendered React text (only works on static/initial DOM).
- No RTL support (not needed for BM/EN but worth noting for future).
- `getGreeting()` in student.jsx returns Malay only; does not honour language preference.

---

## 18. Infrastructure & DevOps

### 18.1 Docker Compose services

All services present and health-checked: postgres, redis, minio, minio-setup, keycloak, centrifugo, ntfy, api, caddy.

### 18.2 Issues

- **Centrifugo `allowed_origins`** hardcoded to `localhost`/`127.0.0.1` in `centrifugo/config.json` — will block WebSocket in any non-localhost deployment.
- **Keycloak admin credentials** in `.env` plain text — must be in Docker secrets for production.
- **No HTTPS in dev** — `CADDY_SITE_ADDRESS` defaults to `http://localhost`; `Secure` cookie flag is conditional on `NODE_ENV=production` but cookies won't be sent over HTTP in strict mode.
- **No postgres backup** — docker-compose volume has no backup job or pg_dump cron.
- **Materialized view `student_classroom_stats`** never refreshed — requires a cron or trigger-based refresh.
- **CORS wildcard regex** (index.ts ~line 211) allows all subdomains even though `config.ts` forbids wildcards in production.
- **Caddy health endpoint** (`/health`) is not rate-limited — could be abused as a DoS probe.

---

## 19. QA Test Coverage

### 19.1 What is tested

| Spec | Coverage |
|------|----------|
| `v2-role-smoke.spec.ts` | Login + home view per role; student sees subjects and skill nodes |
| `full-feature-regression.spec.ts` | Auth, admin users, classroom CRUD, lesson assign/submit, progress stats, quiz deck+session, feed, sync, notifications |
| `language-switch.spec.ts` | BM↔EN toggle |
| `platform-health.spec.ts` | `/health` endpoint, uptime |
| `production-shell.spec.ts` | CSP headers, HSTS, X-Frame-Options |
| `v2-responsive.mobile.spec.ts` | 375px viewport rendering |

### 19.2 Not covered by tests

- WebSocket classroom events (whiteboard draw, chat, quiz real-time).
- Keycloak PKCE callback flow (requires browser redirect).
- Offline sync push/pull and conflict resolution.
- File upload (media storage).
- Parent alert generation and status update.
- Bulk user status update.
- Quiz timer pause/resume.
- Achievement award triggering.
- Hearts decrement (not implemented so not testable).
- Form-level validation rejection (1–3 rejected by DB).
- Classroom join rate limiting.
- Concurrent quiz sessions (only one active per classroom).
- Mobile (Flutter) app flows.

---

## 20. Issue Registry

Severity key: 🔴 Critical / 🟠 High / 🟡 Medium / 🔵 Low / ⚪ Design/UX

### Security

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| SEC-01 | 🔴 | `auth/keycloak.ts:427` | Email-based account merge allows takeover across Keycloak realms |
| SEC-02 | 🟠 | `index.ts:211` | CORS wildcard subdomain regex conflicts with production config that forbids wildcards |
| SEC-03 | 🟠 | `auth/routes.ts:838` | Demo admin email `admin@tusyen.test` hardcoded in source code |
| SEC-04 | 🟠 | `classroom/routes.ts:9` | Join code generated with `Math.random()` (not cryptographically random) |
| SEC-05 | 🟡 | `quiz/routes.ts:33` | 6-digit PIN (1M combos) has no per-PIN rate limit; only IP-level limit of 5/min |
| SEC-06 | 🟡 | `auth/routes.ts:789` | X-Forwarded-For used for rate limiting without trusted-proxy validation |

### Data / Logic

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| DAT-01 | 🟠 | `quiz/store.ts:70` | Guest participants lack `UNIQUE(session_id, display_name)` constraint; duplicate guests possible |
| DAT-02 | 🟠 | `learning/routes.ts` | STEM question scoring not implemented — fill_blank, matching, numeric, etc. always score 0 |
| DAT-03 | 🟡 | `progress/routes.ts` | No pagination on `GET /progress/student/:id` — unbounded result set |
| DAT-04 | 🟡 | `progress/routes.ts` | Streak not updated on lesson submit; requires explicit `POST /progress/streak/check` call |
| DAT-05 | 🟡 | `student_classroom_stats` | Materialized view never refreshed; data is always stale |
| DAT-06 | 🟡 | `auth/routes.ts` | Parent alert status table (`parent_alert_statuses`) created ad-hoc, not in migrations |
| DAT-07 | 🔵 | `database/migrations/001` | Missing composite index `(classroom_id, updated_at)` on progress table |

### Feature Completeness

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| FEAT-01 | 🟠 | Web app | Keycloak OAuth callback page (`/keycloak-callback`) not implemented — SSO login fails silently |
| FEAT-02 | 🟠 | Teacher UI | Quiz timer pause button not rendered — endpoint exists but unreachable from UI |
| FEAT-03 | 🟠 | Student UI | Achievement award logic not implemented — badges never unlocked automatically |
| FEAT-04 | 🟠 | Student UI | Hearts system decorative only — hearts never decremented |
| FEAT-05 | 🟡 | Teacher UI | Edit classroom form not implemented — can create and archive, not update |
| FEAT-06 | 🟡 | Teacher UI | Lesson "required" flag not exposed in assignment UI |
| FEAT-07 | 🟡 | Admin UI | Edit user (name, role) form not implemented — status toggle only |
| FEAT-08 | 🟡 | Admin UI | No manual enrollment tool for admin |
| FEAT-09 | 🟡 | Admin UI | No parent-link create/deactivate screen |
| FEAT-10 | 🟡 | Student UI | Leaderboard widget uses hardcoded data; `/progress/classroom/:id/leaderboard` not consumed |
| FEAT-11 | 🟡 | Student UI | Badges widget uses hardcoded earned states; `/progress/me/achievements` not consumed |
| FEAT-12 | 🟡 | Student UI | Skill tree locked/done states hardcoded; no topic-completion API |
| FEAT-13 | 🟡 | Student UI | Comment input not rendered in student feed view |
| FEAT-14 | 🟡 | Parent UI | Trend indicators (↑ ↓ →) hardcoded; no 7-day comparison API |
| FEAT-15 | 🟡 | Parent UI | Weekly study time always shows 0 for live data |
| FEAT-16 | 🟡 | Parent UI | Student rank not returned by stats API |
| FEAT-17 | 🔵 | Web app | Video blocks render as links, not inline players |
| FEAT-18 | 🔵 | Web app | Post reactions (`reactPost`) called in UI but method not defined in `app.js` |

### UX / i18n

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| UX-01 | 🟡 | Teacher UI | Form level 1–3 accepted in create-class form but silently rejected by backend |
| UX-02 | 🟡 | Multiple | ~40% of UI strings not wrapped in `t()` or STATIC_TRANSLATIONS — English toggle shows Malay |
| UX-03 | 🟡 | Student UI | `getGreeting()` always returns Malay regardless of language setting |
| UX-04 | 🟡 | Teacher UI | Classroom list shows "—" average for classrooms with no student progress (ambiguous vs. 0%) |
| UX-05 | 🔵 | Student UI | PIN entry field accepts non-numeric characters |
| UX-06 | 🔵 | Teacher UI | New post does not auto-scroll into view after creation |
| UX-07 | 🔵 | Admin UI | Lesson content editor is raw JSON textarea — no structured block editor |
| UX-08 | 🔵 | Parent UI | Follow-up action label "Simpan soalan untuk guru" implies teacher messaging but sends nothing |
| UX-09 | ⚪ | All roles | No loading skeletons — components show fallback data until API responds (can look like real data) |
| UX-10 | ⚪ | All roles | After successful join/create/update actions, lists do not auto-refresh without reload |

### Operations

| ID | Severity | Location | Issue |
|----|----------|----------|-------|
| OPS-01 | 🟠 | centrifugo/config.json | `allowed_origins` hardcoded to localhost — production WebSocket connections will fail |
| OPS-02 | 🟠 | docker-compose.yml | No postgres backup strategy |
| OPS-03 | 🟡 | docker-compose.yml | Keycloak admin credentials in plain-text `.env` |
| OPS-04 | 🟡 | auth/routes.ts | Parent alert generation runs expensive unindexed queries on every call |
| OPS-05 | 🔵 | admin/routes.ts | Cache clear is full Redis flush — no selective key-pattern clear |

---

*End of specification. This document should be updated whenever a feature is implemented, modified, or confirmed as out-of-scope.*
