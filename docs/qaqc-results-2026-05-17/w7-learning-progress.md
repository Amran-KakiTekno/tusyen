# W7 Learning + Progress + Content Review QA/QC

- Result: FAIL
- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w7-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Repo: D:\2026\tusyen
- Base URL: http://localhost
- Tooling: Playwright request API for HTTP checks; deterministic streak setup via isolated PostgreSQL rows for the new QA student.
- Checks: 9 passed, 3 failed

## Isolated QA data

- studentA: 3040d4f2-337f-4708-8052-df20db927c66
- studentB: 2e663188-5509-4833-9889-f8046fc13bc4
- teacherA: a1f95106-035a-49f7-8921-2a1ff53a0978
- teacherB: 6b038616-2e39-4314-932d-b9c82e6ec370
- parentA: 249dc10f-2320-475d-b426-9c81b8974988
- parentB: cd26d18c-dd23-430c-a249-10712f2dc005
- syllabusId: 1877acc7-cfd6-4f2d-b974-4393f5e4fe05
- classroomA: 158e8cdd-e19d-4a7d-ab79-aea2c8a64e7a
- classroomB: e3a8e08e-949d-4a92-8891-a7c9b5dc14b8
- lessonAllTypes: 1fc84e7f-b0ed-4b9d-8413-cedaba92961f
- lessonHalfScore: aed603c7-881c-4f4c-a6ab-c23a358f964c
- inactiveLesson: 4ca2a88d-03d8-4381-9bcf-88c17616a3c1

## Checks

| Area | Check | Result | Evidence |
|---|---|---:|---|
| Environment | API health is reachable at http://localhost | PASS | HTTP 200, status=healthy |
| Learning catalog | Catalog returns active/published lesson with syllabus and exercise metadata | FAIL | rows=1, id=1fc84e7f-b0ed-4b9d-8413-cedaba92961f, question_count=14, content_block_count=undefined, topic=Penulisan Terarah SPM |
| Published lessons only | Soft-deleted lesson is excluded from catalog | PASS | inactive search rows=0 for lessonId=4ca2a88d-03d8-4381-9bcf-88c17616a3c1 |
| Published lessons only | Soft-deleted lesson detail is not accessible to student | PASS | HTTP 404 |
| Syllabus visibility | Student can see active syllabus filtered by subject/form level | PASS | filtered rows=1, selected=1877acc7-cfd6-4f2d-b974-4393f5e4fe05, subject=Bahasa Inggeris, formLevel=5 |
| Learning assigned lessons | Student assigned lesson list includes active assigned lessons only | PASS | lesson ids=aed603c7-881c-4f4c-a6ab-c23a358f964c,1fc84e7f-b0ed-4b9d-8413-cedaba92961f |
| Exercise question types | Lesson detail exposes all W7 exercise question types | PASS | types=multiple_choice, true_false, fill_blank, matching, representation_match, missing_step, step_order, numeric, diagram_label, error_diagnosis, prediction, code_trace, data_interpret, scenario |
| Content review gating | Submission is blocked before content review when content blocks exist | PASS | HTTP 400, error=Review the lesson content before submitting exercises |
| Content review gating | Reviewed submission is accepted and review telemetry is persisted | PASS | score=100, correct=14/14, reviewed_at=2026-05-17T15:32:13.306Z, reviewed_block_count=2, review_seconds=47 |
| Progress attempts and best score | Resubmission increments attempts while retaining best score | FAIL | latest_score=0, retained_progress_score=0.00, attempts=2 |
| Exercise submission | No-block lesson accepts answered submission without content-review gate | PASS | score=50, completion=100, content_reviewed_at=null |
| Fatal | QA script completed | FAIL | Error: Command failed: docker exec edu_postgres psql -U eduuser -d eduapp -v ON_ERROR_STOP=1 -c INSERT INTO student_streaks (id, student_id, activity_date, streak_count) VALUES ('04768912-f518-4b47-9b42-020cde6a022e', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE, 2), ('72e3112b-7973-41c7-8cdb-c98df70c86a9', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE - INTERVAL '1 day', 1), ('e4862ee4-09ac-4888-abbf-5a576735e8ba', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE - INTERVAL '3 days', 7) ON CONFLICT (student_id, activity_date) DO UPDATE SET streak_count = EXCLUDED.streak_count; psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "eduuser" does not exist     at genericNodeError (node:internal/errors:985:15)     at wrappedFn (node:internal/errors:539:14)     at ChildProcess.exithandler (node:child_process:417:12)     at ChildProcess.emit (node:events:508:28)     at maybeClose (node:internal/child_process:1100:16)     at ChildProcess._handle.onexit (node:internal/child_process:305:5) |

## Defects

### Defect 1

- Role/Screen: Student / Learning catalog
- Severity: P1
- Repro: GET /api/learning/catalog?search=W7 All Question Types w7df8dd38b153211
- Expected: One active lesson with topic, question_count=14, content_block_count=2
- Actual: rows=1
- Suspected file: backend/src/learning/routes.ts
- Screenshot: N/A - API-only Playwright request check

### Defect 2

- Role/Screen: Student / Lesson submit
- Severity: P1
- Repro: Submit perfect score, then resubmit wrong answers for 1fc84e7f-b0ed-4b9d-8413-cedaba92961f
- Expected: Latest result can be lower, persisted progress score remains best=100, attempts=2
- Actual: latest=0, progress_score=0.00, attempts=2
- Suspected file: backend/src/learning/routes.ts
- Screenshot: N/A - API-only Playwright request check

### Defect 3

- Role/Screen: QA harness / W7 learning-progress
- Severity: P0
- Repro: Run the W7 isolated Playwright request QA harness from D:/2026/tusyen
- Expected: Harness completes and writes all checks
- Actual: Error: Command failed: docker exec edu_postgres psql -U eduuser -d eduapp -v ON_ERROR_STOP=1 -c INSERT INTO student_streaks (id, student_id, activity_date, streak_count) VALUES ('04768912-f518-4b47-9b42-020cde6a022e', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE, 2), ('72e3112b-7973-41c7-8cdb-c98df70c86a9', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE - INTERVAL '1 day', 1), ('e4862ee4-09ac-4888-abbf-5a576735e8ba', '3040d4f2-337f-4708-8052-df20db927c66', CURRENT_DATE - INTERVAL '3 days', 7) ON CONFLICT (student_id, activity_date) DO UPDATE SET streak_count = EXCLUDED.streak_count;
psql: error: connection to server on socket "/var/run/postgresql/.s.PGSQL.5432" failed: FATAL:  role "eduuser" does not exist

    at genericNodeError (node:internal/errors:985:15)
    at wrappedFn (node:internal/errors:539:14)
    at ChildProcess.exithandler (node:child_process:417:12)
    at ChildProcess.emit (node:events:508:28)
    at maybeClose (node:internal/child_process:1100:16)
    at ChildProcess._handle.onexit (node:internal/child_process:305:5)
- Suspected file: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Screenshot: N/A - API-only Playwright request check


## Notes

- Content-review telemetry is reported using API field names: content_reviewed_at, content_block_count, and content_review_seconds.
- The streak check used CURRENT_DATE, CURRENT_DATE - 1 day, and CURRENT_DATE - 3 days to verify the current streak stops at a date gap.
- No commits or environment file edits were made.