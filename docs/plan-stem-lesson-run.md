# Plan: Run & Harden the STEM Lesson Seed (Phase 2)

**Date:** 2026-05-18  
**Follows:** `docs/plan-stem-lesson-content.md` (Phase 1 — content written, dry-run validated)  
**Goal:** Make the seed production-safe, then actually execute it against the live database, and verify the lesson catalogue is working end-to-end in the app.

---

## What Phase 1 delivered (current state)

| Artifact | Status |
|---|---|
| `database/migrations/016_wipe_demo_lessons.sql` | Written — NOT yet run |
| `backend/scripts/seed-stem-lessons.js` | Written, 11,519 lines, dry-run syntax-checked |
| `backend/scripts/seed-demo.js` | Lesson seeding gated behind `SEED_DEMO_LESSONS=true` |
| `backend/test/learning.routes.test.ts` | STEM catalogue test block added |
| `docker-compose.yml` | Manual seed step documented in comment |
| `README.md` | Seed commands documented |

## Critical issues found in Phase 1 output

1. **No idempotency** — `insertSyllabus`, `insertLesson`, and `insertQuestion` use plain `INSERT` with no `ON CONFLICT` guard. Re-running the script creates duplicate rows.
2. **Migration never executed** — `016_wipe_demo_lessons.sql` has not been applied to the database yet.
3. **Seed never executed** — The 142 lessons and 859 questions exist only in JavaScript; the database is still empty (or has old demo data).
4. **No `--dry-run` flag** — The script has no safe preview mode; every run is destructive.
5. **Tests are mock-only** — The new STEM catalogue tests mock the DB entirely; they do not prove the seed script + real DB actually work together.

---

## Tasks

---

### Wave 0 — Blocking hardening tasks (sequential, in order)

#### Task 0.1 — Add idempotency to seed helpers `[BLOCKING]`
**File:** `backend/scripts/seed-stem-lessons.js`

Modify all three insert helpers to be safe on re-run:

- `insertSyllabus` → add `ON CONFLICT (subject, form_level, topic, subtopic) DO UPDATE SET updated_at = NOW()` and `RETURNING id`. Also add a `UNIQUE` constraint note — see Task 0.2.
- `insertLesson` → add `ON CONFLICT (title, subject, form_level) DO UPDATE SET updated_at = NOW()` and `RETURNING id`.
- `insertQuestion` → add `ON CONFLICT (lesson_id, order_index) DO UPDATE SET question_text = EXCLUDED.question_text` and `RETURNING id`.

Also add a `--dry-run` flag: if `process.argv.includes('--dry-run')`, wrap everything in a transaction that is rolled back at the end instead of committed, and print a summary of what would be inserted.

**Dependency:** None — pure JS change, no DB needed yet.

#### Task 0.2 — Add unique constraints migration `[BLOCKING]`
**File:** `database/migrations/017_seed_unique_constraints.sql`

Add `UNIQUE` constraints that the `ON CONFLICT` clauses in Task 0.1 will target:

```sql
ALTER TABLE syllabus_items
  ADD CONSTRAINT uq_syllabus_subject_form_topic_subtopic
  UNIQUE (subject, form_level, topic, subtopic);

ALTER TABLE lessons
  ADD CONSTRAINT uq_lesson_title_subject_form
  UNIQUE (title, subject, form_level);

ALTER TABLE quiz_questions
  ADD CONSTRAINT uq_question_lesson_order
  UNIQUE (lesson_id, order_index);
```

**Dependency:** Task 0.1 must be written first so the constraint names match.

#### Task 0.3 — Run migrations 016 and 017 `[BLOCKING]`
**Command to run:**
```
docker compose exec api node scripts/migrate.js
```
or directly against the DB container if the API is not running.

Verify output shows both `016_wipe_demo_lessons` and `017_seed_unique_constraints` as applied. Check that no existing migration failed.

**Dependency:** Task 0.2 must be committed first.

---

### Wave 1 — Execute and verify (sequential after Wave 0)

These must run in order — each step depends on the previous.

#### Task 1.1 — Dry-run the seed `[SEQUENTIAL]`
**Command:**
```
docker compose exec api node scripts/seed-stem-lessons.js --dry-run
```

Expected output: a summary like:
```
[DRY RUN] Would insert 142 syllabus items
[DRY RUN] Would insert 142 lessons
[DRY RUN] Would insert 859 quiz questions
[DRY RUN] Transaction rolled back — no changes made.
```

Verify no errors, no DB exceptions. Fix any runtime errors before proceeding.

**Dependency:** Task 0.3 (migrations applied).

#### Task 1.2 — Run the real seed `[SEQUENTIAL]`
**Command:**
```
docker compose exec api node scripts/seed-stem-lessons.js
```

Expected output ends with:
```
STEM lesson count: 142
STEM lesson seed complete.
```

If it fails mid-way, the transaction wrapper rolls everything back — fix the error and re-run (idempotency from Task 0.1 makes re-runs safe).

**Dependency:** Task 1.1 (dry-run must pass first).

#### Task 1.3 — Verify DB counts `[SEQUENTIAL]`
**Commands to run against the database:**
```sql
SELECT subject, form_level, COUNT(*) AS lessons
FROM lessons
WHERE is_active = true
GROUP BY subject, form_level
ORDER BY form_level, subject;

SELECT COUNT(*) FROM syllabus_items WHERE is_active = true;
SELECT COUNT(*) FROM quiz_questions WHERE is_active = true;
```

**Expected results:**
- 7 subjects × 2 form levels = 14 rows minimum
- Biology Form 4: 18, Biology Form 5: 15
- Chemistry Form 4: 14, Chemistry Form 5: 10
- Physics Form 4: 14, Physics Form 5: 10
- Matematik Form 4: 10, Matematik Form 5: 8
- Matematik Tambahan Form 4: 10, Matematik Tambahan Form 5: 10
- Sains Form 4: 8
- Sains Komputer Form 4: 8, Sains Komputer Form 5: 7
- Total lessons: 142, quiz_questions: ~859

**Dependency:** Task 1.2.

#### Task 1.4 — Run the backend test suite `[SEQUENTIAL]`
**Command:**
```
docker compose exec api npx vitest run
```

All existing tests must pass, including the new STEM catalogue block. Fix any failures before proceeding.

**Dependency:** Task 1.2 (real data required for integration assertions).

#### Task 1.5 — Manual API smoke test `[SEQUENTIAL]`
Hit these endpoints manually (curl or browser) and confirm responses:

```
GET /api/learning/catalog?formLevel=4
  → expect JSON array with ≥ 60 items, each with id, title, subject, form_level, difficulty

GET /api/learning/catalog?subject=Biology&formLevel=4
  → expect 18 items

GET /api/learning/lessons/<any Biology lesson id>
  → expect content.blocks array with 5 items (Concept, Worked Example, Misconceptions, Key Terms, Mnemonic)
  → expect quiz_questions array with 6 items

GET /api/learning/catalog?subject=Kimia&formLevel=5
  → expect 10 items

GET /api/learning/catalog?subject=Matematik+Tambahan&formLevel=5
  → expect 10 items
```

Document any discrepancies in a comment on this task.

**Dependency:** Task 1.3 (data confirmed in DB).

---

### Wave 2 — App-level integration (parallel where noted)

#### Task 2.1 — Seed demo users + classrooms (re-run demo seed) `[SEQUENTIAL]`
**Command:**
```
docker compose exec api node scripts/seed-demo.js
```
(No `SEED_DEMO_LESSONS=true` — lessons come from the STEM seed.)

Verify: 4 users exist, 3 classrooms exist, enrollments exist. This is needed so the student UI can be tested with real classroom+lesson assignments.

**Dependency:** Task 1.2 (STEM lessons must exist before classroom assignments are made).

#### Task 2.2 — Assign sample lessons to classrooms `[SEQUENTIAL]`
**File:** `backend/scripts/seed-demo.js` or a new one-off script `backend/scripts/seed-classroom-lessons.js`

Pick 5 STEM lessons per classroom and insert rows into `classroom_lessons`:
- Math Focus classroom → 5 Matematik Form 4 lessons (required, no due date)
- Science Lab classroom → 5 Biology Form 4 lessons (required, due +7 days)
- English SPM classroom → 5 Physics Form 4 lessons (required, due +14 days)

These give the demo student visible assigned lessons in the UI.

**Dependency:** Task 2.1 (classrooms + STEM lessons both must exist).

#### Task 2.3 — Web app catalogue page smoke test `[PARALLEL]`
Open the student view in the browser (or review the student component code). Confirm the lesson list renders for Form 4, subject filter works, and clicking a lesson shows content blocks + exercises. No code change needed unless bugs are found.

**File to fix if broken:** `web_app/components/student.jsx`

**Dependency:** Task 2.2.

#### Task 2.4 — Flutter app API endpoint check `[PARALLEL]`
Check `flutter_app/lib/core/network/api_endpoints.dart` — confirm the catalog and lesson-detail endpoints match the backend routes (`/api/learning/catalog`, `/api/learning/lessons/:id`). No change needed unless there is a mismatch.

**Dependency:** Task 1.5 (API confirmed working).

---

### Wave 3 — Final cleanup (sequential)

#### Task 3.1 — Remove the old migration 016 approach if risky `[SEQUENTIAL]`
Review whether `016_wipe_demo_lessons.sql` using `TRUNCATE … CASCADE` could accidentally cascade into tables beyond the target set (e.g. `xp_events`, `quiz_sessions`). If so, rewrite it as ordered `DELETE FROM` statements with explicit `WHERE lesson_id IN (SELECT id FROM lessons WHERE created_by IS NULL)` — i.e. only wipe system-seeded rows, not teacher-created ones.

**Dependency:** Task 1.3 (DB counts tell us if cascades over-deleted anything).

#### Task 3.2 — Update MEMORY.md project entry `[SEQUENTIAL]`
Update the project memory file at `C:\Users\Dev Mode\.claude\projects\d--2026-tusyen\memory\project-quiz-pwa.md` (or create `project-stem-lessons.md`) to record:
- 142 STEM lessons seeded across 13 subjects, Forms 4 & 5
- Migration 016 (wipe) + 017 (unique constraints) applied
- Seed script: `backend/scripts/seed-stem-lessons.js`
- Demo lesson seeding now gated behind `SEED_DEMO_LESSONS=true`

**Dependency:** Task 2.3 (confirms everything is working).

---

## Execution Waves Summary

```
Wave 0 (Blocking — sequential, do in order):
  Task 0.1  Add ON CONFLICT + --dry-run to seed-stem-lessons.js
  Task 0.2  Create migration 017_seed_unique_constraints.sql
  Task 0.3  Run migrations (016 + 017)

Wave 1 (Sequential — one at a time, each depends on previous):
  Task 1.1  Dry-run seed
  Task 1.2  Real seed run
  Task 1.3  Verify DB counts with SQL
  Task 1.4  Run test suite
  Task 1.5  Manual API smoke test

Wave 2 (Mix):
  Task 2.1  Re-run demo seed (sequential after 1.2)
  Task 2.2  Assign lessons to classrooms (sequential after 2.1)
  Task 2.3  Web app smoke test    } parallel after 2.2
  Task 2.4  Flutter endpoint check} parallel after 1.5

Wave 3 (Sequential cleanup):
  Task 3.1  Audit migration 016 cascade safety
  Task 3.2  Update project memory
```

---

## Files Touched

| File | Change |
|---|---|
| `backend/scripts/seed-stem-lessons.js` | Add ON CONFLICT + --dry-run mode |
| `database/migrations/017_seed_unique_constraints.sql` | New — unique constraints |
| `backend/scripts/seed-classroom-lessons.js` | New (optional) — classroom assignments |
| `web_app/components/student.jsx` | Fix only if smoke test reveals bugs |
| `flutter_app/lib/core/network/api_endpoints.dart` | Fix only if endpoint mismatch found |
| Memory file | Update project record |
