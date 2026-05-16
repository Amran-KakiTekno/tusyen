# Playwright QA/QC

This repo has a root Playwright suite for browser-level QA/QC against the Docker/Caddy app.

## First-Time Setup

```powershell
cd D:\2026\tusyen
npm install
npm run qaqc:install
```

## Run Against The Local Stack

Start and seed the stack first:

```powershell
docker compose up -d --build
docker compose exec api npm run db:seed-demo
```

Then run the suite:

```powershell
npm run qaqc
```

You can also let the QA script start or rebuild Docker before running:

```powershell
npm run qaqc:stack
```

## Useful Commands

```powershell
npm run qaqc:smoke
npm run qaqc:full
npm run qaqc:headed
npm run qaqc:ui
npm run qaqc:report
```

`qaqc:smoke` runs fast health/UI smoke checks. `qaqc:full` runs the comprehensive feature workflow only.

## Target Another URL

Use `PLAYWRIGHT_BASE_URL` when testing a tunnel, staging host, or non-default port:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://your-tunnel.trycloudflare.com"
npm run qaqc
```

## Artifacts

- HTML report: `playwright-report/`
- JSON result summary: `test-results/qaqc-results.json`
- Traces, videos, and screenshots: `test-results/playwright/`

## Coverage Matrix

The full feature regression creates isolated QA users and content each run, then covers:

- Auth: register, login, refresh, demo actors, Keycloak status/login URL.
- Admin: users, user detail/update/status, parent links, classroom CRUD/enrollment, stats, syllabus CRUD, lesson CRUD, notification health/test, system health, cache clear.
- Profiles: teacher profile update/read and public teacher profile lookup.
- Classrooms: teacher create/update/delete, student join/leave, teacher/student/parent classroom lists, roster, analytics.
- Learning: syllabus visibility, teacher lesson create/read/update, catalog, assignment, student lesson detail and submission, parent lesson visibility.
- Progress: student progress, stats, classroom progress, leaderboard, lesson progress for student/teacher/parent, achievements, streak.
- Feed: rich embedded post create/update/list, student reaction, comment create/update/delete, parent feed visibility, teacher post delete.
- Storage: multipart upload, file list, protected content read, download URL, delete.
- Sync: push, pull, status, conflict resolution route.
- Whiteboard: session start/active/join/end/history, classroom WebSocket auth/ping/draw event persistence, recording upload/attach/remove.
- Quiz: deck create/read/update/delete, session create/start/advance/end, authenticated student join, guest join, participant and teacher state, quiz WebSocket, answer submission, student/parent summaries.
- UI smoke: Caddy `/api/health`, Flutter root shell, `/v2/` role logins, role switching, and mobile student rendering.
