# Tusyen

Tusyen is a self-hosted KSSR/KSSM learning platform built with a shared Flutter codebase for web and mobile, plus a Fastify/PostgreSQL backend. The current working release focuses on Form 4 and Form 5 content, Duolingo-style learning paths, teacher classrooms, live quiz rooms, classroom posts, parent monitoring, and admin control.

The app is designed to run locally or on a small self-hosted server. The Docker stack serves the Flutter web app through Caddy at `http://localhost/`, proxies API calls through `/api`, and keeps the core services on your own machine.

## Current Status

This is no longer a static prototype. The stack currently includes:

- Flutter web app with role-based interfaces for Student, Teacher, Parent, and Admin.
- Fastify API with JWT authentication, role permissions, classroom logic, learning paths, posts, quiz rooms, progress, storage, sync, profile, and admin modules.
- PostgreSQL schema and seed data for demo accounts, Form 4/Form 5 syllabus, classrooms, posts, lessons, quiz decks, quiz history, teacher profile, progress, and streaks.
- Caddy reverse proxy serving the web app and proxying `/api/*` and `/ws/*`.
- Redis for session/cache and pub/sub events.
- MinIO for object storage APIs.
- Centrifugo and ntfy services included in the stack for real-time/push infrastructure.
- ntfy notification publishing for classroom posts, lesson assignments, quiz rooms, and whiteboard sessions.
- Keycloak service integrated as a self-hosted OIDC identity provider. Flutter web can start a Keycloak login, the API completes the authorization-code + PKCE callback, links/provisions the local user, and returns the same app JWT used by existing routes.

For roadmap gaps and root-cause notes, see [docs/feature-gap-audit.md](docs/feature-gap-audit.md).

## Architecture

```text
Flutter Web / Mobile
        |
        | HTTP / WebSocket
        v
Caddy reverse proxy :80/:443
        |
        |-- /                  -> Flutter web build
        |-- /api/*             -> Fastify API :3000
        |-- /ws/*              -> Fastify WebSocket routes
        |-- /auth/*            -> Keycloak OIDC/login pages
        |-- /connection/*      -> Centrifugo
        |-- /minio/*           -> MinIO S3 API
        |-- /minio-console/*   -> MinIO console
        |
        v
Docker network
        |
        |-- PostgreSQL: users, syllabus, lessons, progress, classrooms, posts, quiz rooms
        |-- Redis: cache, sessions, pub/sub
        |-- MinIO: uploaded files and recordings
        |-- Keycloak: self-hosted identity, SSO, and role source
        |-- Centrifugo: real-time service foundation
        |-- ntfy: classroom push notification publisher
```

## Docker Services

| Service | Container | Port | Purpose |
| --- | --- | --- | --- |
| Caddy | `edu_caddy` | `80`, `443` | Serves Flutter web and reverse-proxies API/WebSocket/storage routes |
| API | `edu_api` | `3000` | Fastify backend and business logic |
| PostgreSQL | `edu_postgres` | `5432` | Main relational database |
| Redis | `edu_redis` | `6379` | Session/cache/pub-sub support |
| MinIO | `edu_minio` | `9000`, `9001` | S3-compatible media/object storage and console |
| Keycloak | `edu_keycloak` | `8080` | Self-hosted identity/SSO service exposed through Caddy at `/auth/*` |
| Centrifugo | `edu_centrifugo` | `8000` | Real-time service foundation |
| ntfy | `edu_ntfy` | `2586` host -> `80` container | Self-hosted notification service used by the API at `http://ntfy` |

## Demo Accounts

After running the demo seed, all demo accounts use `password123`.

| Role | Email | Password | What It Shows |
| --- | --- | --- | --- |
| Student | `student@tusyen.test` | `password123` | Learning path, classes, posts, exercises, progress, quiz history |
| Teacher | `teacher@tusyen.test` | `password123` | Classrooms, teacher profile, posts, lessons assignment, quizzes, whiteboard sessions |
| Parent | `parent@tusyen.test` | `password123` | Linked child, child progress, classroom posts |
| Admin | `admin@tusyen.test` | `password123` | Platform stats, users, parent links, classrooms, syllabus, lessons, system health |

The login screen also has demo role tiles that fill these credentials automatically. Keycloak sign-in is available from the web login screen; if the Keycloak account email matches an existing local user, the backend links that account, otherwise it provisions a new local user from the Keycloak profile and roles.

## Features By Role

### Student

Students get the learner-facing Duolingo-style experience.

- Home dashboard with attempted lessons, completed lessons, average score, streak, quiz XP, by-subject progress, and recent quiz sessions.
- Assigned lesson preview on the home dashboard.
- Learn page with subject selection, topic path, syllabus notes, topic progress, content summaries, and exercise steps.
- Subject cards for KSSM content, currently seeded with Mathematics, Science, English, and Sejarah.
- Topic cards grouped from admin-managed syllabus items and assigned lessons.
- Lesson exercise modal with lesson summary, difficulty, estimated time, question count, topic/subtopic chips, previous score/attempts, and completion status.
- Exercise question types: multiple choice, true/false, fill-in-the-blank, matching pairs, representation matching, missing step, step ordering, numeric answer, diagram labeling, error diagnosis, prediction, code trace, data interpretation, and scenario prompts.
- Exercise submission with score, correct answer count, completion state, attempts, time spent, and saved progress.
- Review/retry completed lessons.
- Classrooms page listing joined classrooms.
- Join classroom by classroom UUID and join code.
- Leave classroom with confirmation.
- See latest classroom posts directly inside each classroom card.
- Open full classroom post history.
- See classroom subject, form level, teacher name, and enrollment status.
- Open the teacher profile attached to a classroom or post.
- Posts page for announcements, assignments, and general classroom updates.
- View uploaded images, GIFs, video clips, files, and inline YouTube/Vimeo/Loom embeds in classroom posts.
- Like/unlike posts.
- Write rich comments on posts with uploaded media, GIF/media URL attachments, or supported video embeds.
- Delete own comments.
- See pinned posts, post type, classroom name, author name, teacher headline, like count, and comment count.
- Quiz page with quiz XP summary and recent live quiz history.
- Join a live quiz room by PIN and nickname.
- Public quiz join page at `/quiz/join`.
- Real-time quiz room over WebSocket.
- Timed answer selection for live quiz questions.
- Live quiz feedback, score, XP, leaderboard, player count, and room status.
- Progress page with performance snapshot and individual lesson progress.
- Progress includes lesson title, subject, classroom, topic, score, and completion percentage.

### Teacher

Teachers manage classes, content delivery, posts, live rooms, and their public profile.

- Home dashboard with classroom count and total student count.
- Home quiz tools summary showing reusable quiz decks ready to host.
- Home classroom summary with join codes and student counts.
- Public teacher profile page.
- Edit teacher profile headline, bio, specialties, credentials, years of experience, and location.
- Teacher profile is visible to students and parents from classrooms and posts.
- Create classrooms with name, subject, and Form 4/Form 5 level.
- Get and share classroom join codes.
- View owned classrooms and enrolled student counts.
- View latest posts inside classroom cards.
- Open full classroom post history.
- Browse lesson catalog.
- Preview lessons before assignment.
- Assign lessons to teacher-owned classrooms.
- Create classroom posts.
- Post types: announcement, assignment, and general.
- Attach uploaded images, native video files, GIFs, files, and canonical YouTube/Vimeo/Loom embeds to posts.
- Pin important posts.
- Edit own posts.
- Delete own posts.
- Like/unlike accessible posts.
- Write rich comments on accessible posts.
- Delete own comments.
- Delete comments on own posts.
- Create reusable live quiz decks.
- Edit quiz decks.
- Delete quiz decks.
- Quiz deck question types: multiple choice and true/false.
- Configure quiz question options, correct answer, explanation, points, and time limit.
- Start live quiz rooms for a classroom.
- Share 6-digit quiz PINs.
- Host controls for live quiz rooms: start, advance to next question, end quiz, and return to list.
- Live leaderboard with ranks, scores, correct count, answered count, and guest/student indicator.
- Whiteboard page for classroom live session management.
- Start a whiteboard session with classroom, title, and description.
- Inspect active whiteboard session status and recent session history per classroom.
- Open a live board studio for teacher drawing and student/parent replay.
- Teacher whiteboard tools: pen colors, stroke size, eraser, clear board, and persisted drawing events.
- Student and parent whiteboard access: view live board updates and replay ended sessions.
- Browser screen recording for web teachers using native `MediaRecorder` and screen/tab capture.
- End active whiteboard sessions.
- Upload, replace, remove, and securely stream whiteboard video recordings for replay.

### Parent

Parents monitor linked learners and follow classroom activity.

- Home dashboard showing linked children.
- Link child account by student UUID.
- Children page listing linked student accounts.
- See child name, email, and student ID.
- View each linked child's progress overview.
- Progress page for linked children.
- Child progress includes attempted lessons, completed lessons, average score, streak, quiz XP, by-subject mastery, and recent quiz sessions.
- Posts page showing classroom posts from linked children's active classrooms.
- See pinned posts, teacher announcements, assignments, and general posts.
- View rich post media and comment attachments from linked children's classrooms.
- Like/unlike accessible posts.
- Write rich comments on accessible posts.
- Delete own comments.
- Open teacher profiles from posts.

### Admin

Admins control platform data, users, classrooms, global curriculum, lessons, and system status.

- Admin home dashboard with student count, teacher count, active classroom count, and today's activity count.
- Admin home preview of syllabus items.
- Users page with active/all/disabled filters.
- Users page with role filters: all roles, students, teachers, parents, admins.
- Create users for every role.
- Edit user full name, email, password, role, phone number, date of birth, and active state.
- Enable disabled users.
- Disable users safely without hard-deleting their database record.
- Manage parent-child links.
- Create parent-student links.
- Remove parent-student links.
- Classrooms page with active/all/disabled filters.
- Create classrooms for any active teacher.
- Edit teacher owner, class name, subject, form level, join code, description, public flag, and active flag.
- Enable or disable classrooms.
- See classroom student, lesson, and post counts.
- Add students to classrooms.
- Remove students from classrooms.
- Syllabus page for global curriculum.
- Create syllabus items.
- Edit syllabus items.
- Delete syllabus items.
- Syllabus fields: subject, Form 4/Form 5 level, topic, subtopic, order index, and content summary.
- Lessons page for interactive lesson management.
- Create lessons linked to syllabus.
- Build content-first lessons with ordered sections, text/markdown-style explanation blocks, uploaded images/videos/GIFs, and canonical YouTube/Vimeo/Loom embeds before questions.
- Edit lessons.
- Delete lessons.
- Preview lessons.
- Assign lessons to classrooms.
- Lesson fields: title, syllabus link, summary, content blocks, difficulty, estimated minutes, and questions.
- Lesson question types: STEM-ready multiple choice, true/false, fill-in-the-blank, matching pairs, representation matching, missing step, step ordering, numeric answer, diagram labeling, error diagnosis, prediction, code trace, data interpretation, and scenario prompts.
- Lesson question fields: question text, options, correct answer, explanation, and points.
- System page showing API health and admin stats JSON.
- Backend admin permissions also allow all-post visibility and moderation through the feed API, even though the current admin navigation focuses on Users, Classrooms, Syllabus, Lessons, and System.
- Backend admin maintenance endpoint exists to clear Redis cache.

## Shared Platform Features

- Role-based login and registration.
- Keycloak OIDC login for Flutter web using authorization-code + PKCE.
- Local account linking/provisioning from Keycloak subject, email, profile, and app roles.
- Protected API routes accept the existing app JWT and can also resolve valid Keycloak bearer tokens issued for the configured client.
- JWT access tokens and refresh tokens.
- Password hashing with bcrypt.
- Local session persistence in Flutter secure storage.
- Responsive Flutter UI with desktop sidebar and mobile bottom navigation.
- Dark purple theme across roles.
- Form 4 and Form 5 curriculum scope.
- Syllabus-driven learning content.
- Classroom-based lesson assignment.
- Progress tracking per student, lesson, and classroom.
- Streak tracking.
- Quiz XP events.
- Classroom feed with posts, comments, and reactions.
- ntfy classroom notifications for new posts, assigned lessons, quiz lobby/start events, and whiteboard session starts.
- Teacher profiles connected to posts and classrooms.
- Real-time live quiz rooms over WebSocket.
- Public browser quiz joining by PIN.
- Whiteboard session records and status APIs.
- Storage upload/download/file listing/delete APIs.
- Sync push/pull/status/resolve APIs for offline-sync foundation.
- Redis pub/sub events for classroom posts and engagement.
- PostgreSQL migrations and demo seeding scripts.

## Learning And Content Model

Tusyen uses this content hierarchy:

```text
Syllabus item
  -> subject
  -> Form 4 or Form 5
  -> topic
  -> subtopic
  -> JSON content summary

Lesson
  -> linked to one or more syllabus items
  -> subject and form level inherited from syllabus
  -> summary, difficulty, estimated minutes
  -> quiz questions

Classroom lesson assignment
  -> assigns a lesson to a classroom
  -> optional due date
  -> required flag

Student progress
  -> score
  -> time spent
  -> completion percentage
  -> answers
  -> attempts
  -> completed flag
```

Seeded demo content includes:

- Mathematics Form 4: Linear Functions, Plotting Linear Functions.
- Science Form 4: Cell Division, Mitosis in Action.
- English Form 5: Directed Writing, Formal Email Drill.
- Sejarah Form 5: Nationalism in Malaysia, Nationalism Milestones.
- Classrooms: Form 4 Maths Boost, Form 4 Science Lab, Form 5 English Sprint.
- Posts: graph challenge, mitosis recap, formal email practice.
- Live quiz deck: Math Speed Round.
- Whiteboard session: Live graph walkthrough.

## Backend API Surface

HTTP API routes are served through Caddy under `/api/*` in the web app. WebSocket routes are served through Caddy under `/ws/*`. Direct backend access is available at `http://localhost:3000`.

### Auth

| Method | Route | Feature |
| --- | --- | --- |
| POST | `/auth/register` | Create student/teacher/parent/admin account |
| POST | `/auth/login` | Login and receive JWT tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/keycloak/status` | Keycloak integration status and public auth URL |
| POST | `/auth/keycloak/login-url` | Create PKCE state and return the Keycloak login URL |
| POST | `/auth/keycloak/callback` | Exchange Keycloak authorization code, link/provision local user, and return app JWT |
| POST | `/auth/link-parent` | Parent links self to a student UUID |
| GET | `/auth/linked-students` | Parent lists linked children |

### Profile

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/profile/me` | Current user/teacher profile |
| PATCH | `/profile/me` | Update teacher profile fields |
| GET | `/profile/teachers/:id` | Public teacher profile view |

### Learning

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/learning/catalog` | Lesson catalog for teachers/admin assignment |
| GET | `/learning/syllabus` | Active syllabus visible to learners |
| GET | `/learning/lessons` | Student assigned lessons |
| GET | `/learning/lessons/:id` | Lesson detail and questions |
| POST | `/learning/lessons/:id/submit` | Submit exercise answers and update progress |

### Classrooms

| Method | Route | Feature |
| --- | --- | --- |
| POST | `/classroom` | Teacher creates classroom |
| GET | `/classroom` | List classrooms visible to current role |
| GET | `/classroom/:id` | Classroom detail |
| POST | `/classroom/:id/join` | Student joins with join code |
| GET | `/classroom/:id/students` | List enrolled students |
| POST | `/classroom/:id/leave` | Student leaves classroom |
| DELETE | `/classroom/:id` | Teacher disables classroom |
| PATCH | `/classroom/:id` | Teacher edits classroom |
| GET | `/classroom/:id/analytics` | Classroom analytics |
| GET | `/classroom/:id/lessons` | Classroom lesson assignments |
| POST | `/classroom/:id/lessons` | Assign lesson to classroom |
| DELETE | `/classroom/:id/lessons/:lessonId` | Remove lesson assignment |

### Posts And Engagement

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/feed/posts` | Role-scoped classroom feed |
| POST | `/feed/posts` | Teacher/admin creates post |
| PATCH | `/feed/posts/:id` | Author/admin edits post |
| DELETE | `/feed/posts/:id` | Author/admin disables post |
| GET | `/feed/posts/:id/comments` | Load post comments |
| POST | `/feed/posts/:id/comments` | Add comment |
| PATCH | `/feed/comments/:id` | Edit own/admin comment |
| DELETE | `/feed/comments/:id` | Delete own/admin/teacher-owned-post comment |
| POST | `/feed/posts/:id/reaction` | Add/update reaction |
| DELETE | `/feed/posts/:id/reaction` | Remove reaction |

### Progress

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/progress/student/:studentId` | Lesson-level progress list |
| GET | `/progress/student/:studentId/stats` | Summary stats, streak, subject mastery, quiz XP |
| GET | `/progress/classroom/:classroomId` | Classroom progress |
| GET | `/progress/lesson/:lessonId` | Lesson progress |
| POST | `/progress/streak/check` | Update/check streak |

### Live Quizzes

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/quiz/decks` | List visible quiz decks |
| POST | `/quiz/decks` | Create quiz deck |
| GET | `/quiz/decks/:deckId` | Deck detail |
| PATCH | `/quiz/decks/:deckId` | Edit deck |
| DELETE | `/quiz/decks/:deckId` | Disable deck |
| GET | `/quiz/classrooms/:classroomId/sessions` | Classroom quiz sessions |
| POST | `/quiz/sessions` | Start lobby for a live quiz |
| GET | `/quiz/sessions/:sessionId/state` | Current room state |
| POST | `/quiz/join` | Join by PIN |
| POST | `/quiz/sessions/:sessionId/start` | Host starts quiz |
| POST | `/quiz/sessions/:sessionId/advance` | Host advances question |
| POST | `/quiz/sessions/:sessionId/end` | Host ends quiz |
| POST | `/quiz/sessions/:sessionId/answers` | Player submits answer |
| GET | `/quiz/students/:studentId/summary` | Student quiz summary |
| GET | `/quiz/me/summary` | Current student quiz summary |
| WS | `/ws/quiz/:sessionId` | Live quiz WebSocket |

### Whiteboard

| Method | Route | Feature |
| --- | --- | --- |
| POST | `/whiteboard/session` | Start whiteboard session |
| GET | `/whiteboard/session/active/:classroomId` | Active session for classroom |
| POST | `/whiteboard/session/:id/join` | Join session |
| POST | `/whiteboard/session/:id/end` | End session |
| GET | `/whiteboard/session/:id/events` | Replay persisted draw/clear events |
| POST | `/whiteboard/session/:id/recording` | Attach uploaded video recording metadata |
| DELETE | `/whiteboard/session/:id/recording` | Remove session recording |
| GET | `/whiteboard/sessions/:classroomId` | Session history with recording playback metadata |

### Admin

| Method | Route | Feature |
| --- | --- | --- |
| GET | `/admin/users` | List/filter users |
| GET | `/admin/users/:id` | User detail with links/classes |
| POST | `/admin/users` | Create user |
| PATCH | `/admin/users/:id` | Edit user |
| DELETE | `/admin/users/:id` | Disable user |
| PATCH | `/admin/users/:id/status` | Enable/disable user |
| GET | `/admin/parent-links` | List parent links |
| POST | `/admin/parent-links` | Create parent link |
| DELETE | `/admin/parent-links/:id` | Disable parent link |
| GET | `/admin/classrooms` | List/filter classrooms |
| POST | `/admin/classrooms` | Create classroom |
| PATCH | `/admin/classrooms/:id` | Edit classroom |
| DELETE | `/admin/classrooms/:id` | Disable classroom |
| POST | `/admin/classrooms/:id/students` | Add student to classroom |
| DELETE | `/admin/classrooms/:id/students/:studentId` | Remove student from classroom |
| GET | `/admin/stats` | Platform stats |
| GET | `/admin/syllabus` | List syllabus |
| POST | `/admin/syllabus` | Create syllabus item |
| PATCH | `/admin/syllabus/:id` | Edit syllabus item |
| DELETE | `/admin/syllabus/:id` | Disable syllabus item |
| GET | `/admin/lessons` | List lessons |
| GET | `/admin/lessons/:id` | Lesson detail with questions |
| POST | `/admin/lessons` | Create lesson and questions |
| PATCH | `/admin/lessons/:id` | Edit lesson and questions |
| DELETE | `/admin/lessons/:id` | Disable lesson |
| POST | `/admin/classrooms/:id/lessons` | Assign lesson to classroom |
| GET | `/admin/notifications/health` | ntfy health and configured public URL |
| POST | `/admin/notifications/test` | Publish an admin smoke-test ntfy notification |
| GET | `/admin/health` | Admin health detail |
| POST | `/admin/cache/clear` | Clear Redis cache |

### Storage, Sync, And WebSocket

| Method | Route | Feature |
| --- | --- | --- |
| POST | `/storage/upload-url` | Create upload URL |
| POST | `/storage/download-url` | Create download URL |
| POST | `/storage/upload` | Upload multipart file |
| GET | `/storage/files` | List files |
| DELETE | `/storage/files/:id` | Delete file |
| POST | `/sync/push` | Push client changes |
| POST | `/sync/pull` | Pull server changes |
| GET | `/sync/status` | Sync status |
| POST | `/sync/resolve` | Resolve sync conflict |
| WS | `/ws/classroom/:classroomId` | Classroom WebSocket channel |
| POST | `/broadcast/:classroomId` | Broadcast classroom event |
| GET | `/health` | Public API health |

## Database Tables

Core schema tables:

- `users`
- `parent_student_links`
- `classrooms`
- `classroom_enrollments`
- `syllabus_items`
- `lessons`
- `lesson_syllabus_links`
- `quiz_questions`
- `classroom_lessons`
- `progress`
- `student_streaks`
- `whiteboard_sessions`
- `whiteboard_events`
- `posts`
- `chat_messages`
- `file_uploads`
- `sync_log`
- `achievements`
- `user_achievements`
- `quiz_decks`
- `quiz_deck_questions`
- `quiz_sessions`
- `quiz_session_participants`
- `quiz_session_answers`
- `xp_events`
- `teacher_profiles`
- `post_reactions`
- `post_comments`

## Quick Start

### 1. Configure environment

```powershell
cd D:\2026\tusyen
Copy-Item .env.example .env
notepad .env
```

Set strong values for database, JWT, MinIO, Centrifugo, Keycloak, and ntfy fields. For local and trycloudflare testing, `KEYCLOAK_PUBLIC_URL` can stay blank so the API derives the public Keycloak URL from the current browser origin and uses `/auth`. For a fixed domain, set it to something like `https://learn.example.com/auth` and add that origin to `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS`.

ntfy has two URLs by design:

- `NTFY_URL` is the API-to-container URL. In Docker this must be `http://ntfy` because ntfy listens on port `80` inside the Docker network.
- `NTFY_PUBLIC_URL` is what phones/browsers use to subscribe, defaulting to `http://localhost:2586`.

### 2. Start Docker stack

```powershell
docker compose up -d --build
```

Check service health:

```powershell
docker compose ps
Invoke-RestMethod http://localhost/api/health
```

### 3. Seed demo data

Run this after PostgreSQL and API dependencies are available:

```powershell
docker compose exec api npm run db:seed-demo
```

This creates demo users, teacher profile, syllabus, lessons, questions, classrooms, enrollments, posts, comments, reactions, progress, streaks, whiteboard session, quiz deck, quiz session, and quiz XP.

### 4. Build Flutter web for Caddy

If Flutter is installed locally:

```powershell
cd D:\2026\tusyen\flutter_app
flutter pub get
flutter build web
```

If Flutter is not installed locally but Docker is available:

```powershell
docker run --rm -v "${PWD}\flutter_app:/app" -w /app ghcr.io/cirruslabs/flutter:stable sh -c "flutter pub get && flutter build web"
```

Caddy serves the built web app from `flutter_app/build/web`.

### 5. Open the app

```text
http://localhost/
```

Use the demo role tiles or the demo credentials listed above.

The dark-cosmos React/Babel design preview (`web_app/`, built from the Tusyen v2 handoff) is served by the same Caddy at:

```text
http://localhost/v2/
```

Sign in with the same demo accounts. Auth, profile, admin platform stats, teacher classroom list, parent linked-child progress, and student progress stats hit the real `/api`. Per-screen mock data (subjects, leaderboard, alerts, schedule, weekly bars) is design-parity placeholder pending its own wiring. Demo accounts can preview all four role layouts; non-demo accounts see only their own role.

Keycloak admin console is available at:

```text
http://localhost/auth/admin
```

Use `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` from `.env`. The imported realm is `eduapp`, with app roles `student`, `teacher`, `parent`, and `admin`.

## Flutter Mobile / External API URL

The Flutter app defaults to:

```dart
String.fromEnvironment('API_BASE_URL', defaultValue: '/api')
```

That works automatically when the web app is served by Caddy from the same origin.

For mobile devices or a public tunnel, pass the full API URL:

```powershell
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP/api
```

For a temporary Cloudflare Tunnel:

```powershell
cloudflared tunnel --url http://localhost:80
```

Then run/build Flutter mobile with:

```powershell
flutter run --dart-define=API_BASE_URL=https://YOUR-TRYCLOUDFLARE-URL.trycloudflare.com/api
```

If you open the web app through the same Cloudflare URL, you usually do not need to change `API_BASE_URL` because `/api` stays same-origin.

## Development Commands

Backend:

```powershell
cd D:\2026\tusyen\backend
npm install
npm run dev
npm run build
npm test -- --run
npm run db:migrate
npm run db:hygiene -- --dry-run
npm run db:hygiene
npm run db:seed-demo
```

Flutter:

```powershell
cd D:\2026\tusyen\flutter_app
flutter pub get
flutter test
flutter build web
flutter run
```

Frontend CRUD E2E:

```powershell
# Local Flutter SDK
cd D:\2026\tusyen\flutter_app
flutter test test/e2e/crud_e2e_test.dart

# Dockerized Flutter SDK from the repo root
cd D:\2026\tusyen
docker run --rm -v "${PWD}\flutter_app:/app" -w /app ghcr.io/cirruslabs/flutter:stable sh -c "flutter pub get && flutter test test/e2e/crud_e2e_test.dart"
```

The CRUD E2E suite drives the real Flutter widgets against an in-memory API double, so it is stable in CI and does not need a browser, Docker stack, or network access. It covers teacher lesson create/edit/delete, teacher post create/edit/delete, student comment create/delete, admin user create/edit/disable, and admin classroom create/edit/disable. Pair this with the backend Vitest suite for API/database contract coverage.

Playwright QA/QC:

```powershell
cd D:\2026\tusyen
npm install
npm run qaqc:install
npm run qaqc
npm run qaqc:full
```

The Playwright suite runs browser smoke checks and a comprehensive feature workflow against the Docker/Caddy app: `/api/health`, Flutter web root, `/v2/` role preview, demo logins, role switching, mobile layout, auth, admin, classrooms, learning, progress, feed, storage, sync, whiteboard, quiz, and WebSocket paths. Use `npm run qaqc:stack` to rebuild/start Docker before testing, `npm run qaqc:smoke` for fast checks, `npm run qaqc:full` for the broad feature workflow, and `PLAYWRIGHT_BASE_URL` to test a tunnel or staging host. See [docs/playwright-qaqc.md](docs/playwright-qaqc.md).

Docker:

```powershell
docker compose up -d --build
docker compose logs -f api
docker compose ps
docker compose down
```

Database hygiene:

```powershell
docker compose exec api npm run db:hygiene -- --dry-run
docker compose exec api npm run db:hygiene
```

The hygiene task normalizes embed metadata, reconciles whiteboard recording state, ends stale live sessions, refreshes `student_classroom_stats`, clamps progress values into valid ranges, analyzes tables, and soft-deletes unreferenced media after the configured grace period. Use `--aggressive` only for local QA cleanup when recent unreferenced uploads should also be soft-deleted.

## Verification Checklist

Use this list after changes:

- `docker compose ps` shows API and PostgreSQL healthy.
- `http://localhost/api/health` returns healthy database and Redis status.
- Student can log in, open Learn, submit an exercise, see score/progress update, see posts, comment, like, join/leave classes, and join a quiz room.
- Teacher can log in, edit profile, create classroom, create/edit/delete posts, assign lessons, create quiz deck, start live quiz room, start a whiteboard session, draw on the live board, record/upload/remove a whiteboard recording, and replay ended boards.
- Parent can log in, link a child, see child progress, and view/comment on linked classroom posts.
- Admin can log in, CRUD users, manage parent links, CRUD classrooms, manage enrollments, CRUD syllabus, CRUD lessons/questions, assign lessons, and view system health.
- `npm test -- --run` passes in `backend`.
- `flutter test` passes in `flutter_app`.
- `flutter test test/e2e/crud_e2e_test.dart` passes in `flutter_app`.
- `flutter build web` succeeds and Caddy serves the updated build.

## Implementation Notes

- Auth supports both local email/password accounts and Keycloak OIDC. Keycloak login uses backend-owned PKCE state in Redis, validates Keycloak signed tokens through JWKS, links by `keycloak_subject` or email, and then issues the existing app JWT so the rest of the API stays consistent.
- Keycloak is served behind Caddy at `/auth/*`; the API talks to it internally through `KEYCLOAK_URL`.
- The app has sync API routes and Flutter local-database dependencies, but the current web experience is backend-connected. Treat offline-first as an infrastructure foundation, not a complete offline UX for every screen yet.
- MinIO storage is protected by signed media URLs. Whiteboard recordings are stored in the private whiteboard bucket and validated as MP4/WebM/MOV before they can be attached.
- External video embeds are server-normalized and restricted to YouTube, Vimeo, and Loom. The web app renders them in sandboxed iframes with canonical provider embed URLs.
- The API container runs pending PostgreSQL migrations before starting, so existing Docker volumes receive new schema changes on upgrade.
- Centrifugo and ntfy are included as self-hosted real-time/push services. Current live quiz rooms use the Fastify WebSocket route `/ws/quiz/:sessionId`; classroom notifications are published to ntfy topics named like `tusyen_classroom_<classroomUuid>`.
- ntfy publishing is intentionally non-blocking for product flows: failed notification delivery is logged and reported in health checks, but it does not make post/lesson/quiz/whiteboard creation fail.
- User deletion and classroom deletion are soft disables, preserving database history.
- Admin post moderation exists in the backend permission model. The current admin navigation does not include a separate Posts tab.

## Troubleshooting

### Docker build fails on TypeScript

Run the backend build locally or in Docker and fix TypeScript errors first:

```powershell
cd D:\2026\tusyen\backend
npm run build
```

### App opens but API cannot be reached

Check:

```powershell
docker compose ps
Invoke-RestMethod http://localhost/api/health
docker compose logs -f api
```

### Cloudflare tunnel opens the web app but login/API fails

Use the tunnel root URL for the app, and make sure API calls go to the same origin `/api`. Keycloak is proxied on the same origin under `/auth`, so the web login button should open a URL like:

```text
https://YOUR-TRYCLOUDFLARE-URL.trycloudflare.com/auth/realms/eduapp/protocol/openid-connect/auth...
```

If Keycloak was already initialized before these settings were added, recreate the Keycloak realm or update the `eduapp-api` client redirect URIs to include `/keycloak-callback` for your public origin. For mobile builds, pass:

```powershell
--dart-define=API_BASE_URL=https://YOUR-TRYCLOUDFLARE-URL.trycloudflare.com/api
```

### Demo accounts do not exist

Run:

```powershell
docker compose exec api npm run db:seed-demo
```

### ntfy notifications are not publishing

Check both the public and internal URLs:

```powershell
Invoke-RestMethod http://localhost:2586/v1/health
docker compose exec api node -e "fetch('http://ntfy/v1/health').then(r=>console.log(r.status))"
```

Then publish a smoke notification as admin through `POST /api/admin/notifications/test`. If `localhost:2586` works but API health says notifications are disconnected, confirm `NTFY_URL=http://ntfy` in the API container environment.

### Port already in use

```powershell
netstat -ano | findstr :80
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## License

This project is currently a private/self-hosted education app prototype for Malaysian KSSR/KSSM learning workflows. Add a formal license before publishing or distributing it.
