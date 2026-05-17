# W4 Playwright Full Feature Regression

- Shared run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w4-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Env snapshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md`
- Base URL: `http://localhost`
- Command: `$env:DEMO_ADMIN_LOGIN_ENABLED='true'; npm run qaqc:full`
- Scope: `tests/qaqc/full-feature-regression.spec.ts`
- Browser/project: `chromium-desktop`
- Result: `FAIL`

## Summary

The Playwright full-feature regression test passed, but the W4 gate failed because the run left QA users in the database.

- Playwright result: `PASS`
- Test file: `tests\qaqc\full-feature-regression.spec.ts`
- CLI result: `1 passed (7.5s)`
- Test body duration reported by Playwright list reporter: `6.9s`
- QA-user leak check: `FAIL`
- `.env` edits: none
- Commits: none

## Playwright output

```text
> tusyen-qaqc@1.0.0 qaqc:full
> playwright test tests/qaqc/full-feature-regression.spec.ts --project=chromium-desktop

Running 1 test using 1 worker

  ok 1 [chromium-desktop] > tests\qaqc\full-feature-regression.spec.ts:13:7 > full project feature coverage > exercises the main Tusyen feature workflows end to end (6.9s)

  1 passed (7.5s)
```

## Step results

The executed Playwright test passed all `test.step` blocks. Step-level durations were not available after the run because the shared Playwright JSON/HTML artifacts were overwritten by another concurrent suite before extraction; the only retained duration from the W4 command output was the aggregate test body duration of `6.9s`.

| Step | Status | Duration | Failure trace/screenshot |
|---|---:|---:|---|
| auth, registration, refresh, and Keycloak bootstrap endpoints | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| admin users, parent links, classrooms, syllabus, lessons, notifications, and health | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| teacher profile, classroom lifecycle, parent access, and lesson assignment | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| student learning, progress, achievements, leaderboard, and parent progress | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| classroom feed posts, rich embeds, comments, reactions, and moderation | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| storage upload/download/list/content/delete and sync endpoints | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| whiteboard sessions, classroom websocket, drawing events, recordings, and replay | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| live quiz decks, sessions, joins, quiz websocket, answers, summaries, and cleanup | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |
| final admin cache maintenance | PASS | Included in 6.9s aggregate; individual duration not retained | N/A |

## QA user leak check

Query used:

```sql
select id, email, role, full_name, created_at
from users
where email like '%@tusyen.test'
order by created_at desc
limit 30;
```

Leaked users from this W4 run id prefix `full-1779031112342-67fw1z`:

| ID | Email | Role | Full name | Created at |
|---|---|---|---|---|
| `fac4fcea-4580-44dc-b038-9958603b1da2` | `registered.full-1779031112342-67fw1z@tusyen.test` | student | `Nur Aina Zulkifli ME67FW` | `2026-05-17 15:18:33.252432` |
| `7ad60d98-d3b3-4455-b882-a898a169e7a9` | `parent.full-1779031112342-67fw1z@tusyen.test` | parent | `Puan Laila Ismail ME67FW` | `2026-05-17 15:18:33.112946` |
| `a906e685-1e29-49a3-8b75-f45cda1658d8` | `student.full-1779031112342-67fw1z@tusyen.test` | student | `Nur Iman Razak ME67FW` | `2026-05-17 15:18:32.967874` |
| `2183f949-18b6-4027-bf86-b9761e8aac7c` | `teacher.full-1779031112342-67fw1z@tusyen.test` | teacher | `Cikgu Hana Rahman ME67FW` | `2026-05-17 15:18:32.825323` |

## Defects

### W4-001: Full-feature regression leaves QA users in database

- Role/Screen: QA data hygiene / full feature regression
- Severity: High
- Repro: Run `$env:DEMO_ADMIN_LOGIN_ENABLED='true'; npm run qaqc:full` from `D:\2026\tusyen`, then query `users` for emails matching the generated `full-*` run id.
- Expected: The full regression cleans up all QA users it creates, leaving no `full-* @tusyen.test` users from the run.
- Actual: Four users remain from run prefix `full-1779031112342-67fw1z`: teacher, student, parent, and registered student.
- Suspected file: `tests/qaqc/full-feature-regression.spec.ts`; helper path `tests/qaqc/support/api.ts`
- Screenshot: N/A. This is an API/database cleanup defect; the Playwright run itself produced no failure screenshot or retained trace because no assertion failed.

## Failure artifacts

- Playwright assertion failures: none
- Trace links: none generated for W4 failure; Playwright config uses `trace: retain-on-failure`, and the browser test passed.
- Screenshot links: none generated for W4 failure; Playwright config uses `screenshot: only-on-failure`, and the browser test passed.
- Reporter artifact note: shared `test-results/qaqc-results.json` and `playwright-report` were not usable for W4 step timing after this run because concurrent QA activity overwrote them with a different suite.

## Final gate

`FAIL`: the big test passed, but the required "no leaked QA users" condition did not pass.
