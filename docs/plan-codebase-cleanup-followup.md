# Plan: Codebase Cleanup — Follow-up (Finish What Was Blocked)

**Date:** 2026-05-18  
**Branch:** `feature/codebase-cleanup` (already exists — do NOT create a new branch)  
**Context:** The first cleanup execution completed most work but was blocked at Wave 2 Task 7
because migrations 018–021 were missing. Root cause: those four files were untracked on `main`
and were never committed before the branch was created; the branch checkout silently dropped them.
This plan reconstructs the lost migrations from backend source code, stages all remaining
uncommitted local edits, cleans up one remaining orphan, and creates the final commit.

---

## What Is Already Done (do NOT redo)

- `.gitignore` updated (Wave 0) ✓  
- `docs/qaqc-results-2026-05-17/` deleted ✓  
- Three stale planning docs deleted ✓  
- Smoke-test PNGs and JS files deleted ✓  

---

## Root Cause of the Four Missing Migrations

| Migration | Content source |
|---|---|
| `018_guest_quiz_unique.sql` | `quiz_session_participants` already has `UNIQUE(session_id, user_id)` and `UNIQUE join_token` from migration 002. Migration 018 adds a **partial unique index** covering the case where `user_id IS NULL` (guest rows) so two guests in the same session can't share the same `guest_name`. |
| `019_parent_alert_statuses.sql` | The full `CREATE TABLE` DDL lives in `backend/src/auth/routes.ts:745`. The table is currently created at runtime via `CREATE TABLE IF NOT EXISTS`; the migration externalises it properly. |
| `020_progress_classroom_index.sql` | Adds a composite index `(classroom_id, student_id)` on `progress` to speed up parent-progress queries. The `progress` table has a `classroom_id` column (migration 001:168) but only single-column indexes. |
| `021_keycloak_subject_realm_unique.sql` | Migration 009 added `keycloak_subject` and a unique index on it globally. Migration 021 makes the unique constraint **per-realm** by adding a `keycloak_realm VARCHAR(255)` column to `users` and building the unique index on `(keycloak_subject, keycloak_realm)` instead. |

---

## Tasks

### Wave 0 — BLOCKING

**Task 0 — Pull latest branch**  
`[BLOCKING]`

```bash
git checkout feature/codebase-cleanup
git pull origin feature/codebase-cleanup
```

Verify current HEAD is `0cc185b` or later. All subsequent tasks work from this state.

---

### Wave 1 — PARALLEL

**Task 1 — Reconstruct migration 018**  
`[PARALLEL]`

- **File created:** `database/migrations/018_guest_quiz_unique.sql`
- **Content:**

```sql
-- Prevent duplicate guest entries per session (guest rows have NULL user_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_participants_guest_name_session
  ON quiz_session_participants (session_id, guest_name)
  WHERE user_id IS NULL AND guest_name IS NOT NULL;
```

**Task 2 — Reconstruct migration 019**  
`[PARALLEL]`

- **File created:** `database/migrations/019_parent_alert_statuses.sql`
- **Content** (taken verbatim from `backend/src/auth/routes.ts:745`):

```sql
CREATE TABLE IF NOT EXISTS parent_alert_statuses (
  parent_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id   TEXT NOT NULL,
  read       BOOLEAN NOT NULL DEFAULT false,
  dismissed  BOOLEAN NOT NULL DEFAULT false,
  follow_up  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (parent_id, child_id, alert_id)
);
```

**Task 3 — Reconstruct migration 020**  
`[PARALLEL]`

- **File created:** `database/migrations/020_progress_classroom_index.sql`
- **Content:**

```sql
-- Composite index to speed up parent progress queries filtered by classroom
CREATE INDEX IF NOT EXISTS idx_progress_classroom_student
  ON progress (classroom_id, student_id);
```

**Task 4 — Reconstruct migration 021**  
`[PARALLEL]`

- **File created:** `database/migrations/021_keycloak_subject_realm_unique.sql`
- **Content:**

```sql
-- Add realm column so the same Keycloak subject in different realms maps to different users.
-- Drop the realm-agnostic unique index from migration 009 first.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS keycloak_realm VARCHAR(255);

DROP INDEX IF EXISTS idx_users_keycloak_subject;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_keycloak_subject_realm
  ON users (keycloak_subject, keycloak_realm)
  WHERE keycloak_subject IS NOT NULL;
```

**Task 5 — Stage local edits on modified files**  
`[PARALLEL]`

These files have uncommitted local changes that must be staged:

- `database/migrations/016_wipe_demo_lessons.sql` — TRUNCATE replaced with safer
  per-table DELETEs (already diffed and verified correct)
- `backend/src/admin/routes.ts` — locally modified (stage as-is)
- `backend/src/progress/routes.ts` — locally modified (stage as-is)

**Task 6 — Delete orphaned `check-lesson-fks.sql` at root**  
`[PARALLEL]`

- **File deleted:** `check-lesson-fks.sql` (untracked debug query at repo root)
- **Change:** `rm check-lesson-fks.sql`
- Also add `check-*.sql` to `.gitignore` root section to prevent recurrence

---

### Wave 2 — SEQUENTIAL (verification + final commit)

**Task 7 — Re-run Wave 2 Task 7 verification**  
`[SEQUENTIAL]` — after all Wave 1 tasks complete

Confirm all of the following exist:

- `backend/src/index.ts` ✓ (was passing before)
- `web_app/index.html` ✓ (was passing before)
- `docker-compose.yml` ✓ (was passing before)
- `.env.example` ✓ (was passing before)
- `backend/scripts/seed-stem-lessons.js` ✓ (was passing before)
- `database/migrations/018_guest_quiz_unique.sql` ← newly created
- `database/migrations/019_parent_alert_statuses.sql` ← newly created
- `database/migrations/020_progress_classroom_index.sql` ← newly created
- `database/migrations/021_keycloak_subject_realm_unique.sql` ← newly created

**Task 8 — Stage all and create final commit**  
`[SEQUENTIAL]` — after Task 7 passes

Stage:
```
git add database/migrations/018_guest_quiz_unique.sql
git add database/migrations/019_parent_alert_statuses.sql
git add database/migrations/020_progress_classroom_index.sql
git add database/migrations/021_keycloak_subject_realm_unique.sql
git add database/migrations/016_wipe_demo_lessons.sql
git add backend/src/admin/routes.ts
git add backend/src/progress/routes.ts
git add .gitignore
```

Commit message:
```
chore: restore lost migrations, stage local edits, remove orphan

- Reconstruct migrations 018–021 (lost when branch was created before they
  were ever committed to main)
- Stage 016 migration edit: TRUNCATE → safer per-table DELETEs
- Stage backend/src/admin/routes.ts and progress/routes.ts local edits
- Delete orphaned check-lesson-fks.sql from repo root
- Add check-*.sql to .gitignore
```

Then push:
```
git push origin feature/codebase-cleanup
```

---

## Execution Wave Summary

```
Wave 0  (blocking, single agent)
  └── Task 0: Pull latest feature/codebase-cleanup

Wave 1  (all parallel, spawn 6 agents simultaneously)
  ├── Task 1: Reconstruct 018_guest_quiz_unique.sql
  ├── Task 2: Reconstruct 019_parent_alert_statuses.sql
  ├── Task 3: Reconstruct 020_progress_classroom_index.sql
  ├── Task 4: Reconstruct 021_keycloak_subject_realm_unique.sql
  ├── Task 5: Stage local edits on 016 + 2 backend files
  └── Task 6: Delete check-lesson-fks.sql + gitignore rule

Wave 2  (sequential, single agent)
  ├── Task 7: Verify all 9 critical files exist
  └── Task 8: Stage all + final commit + push
```
