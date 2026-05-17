# W3 Playwright Smoke QA/QC Report

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w3-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Repo: D:\2026\tusyen
- Base URL: http://localhost
- Env snapshot: _env-snapshot.md
- Playwright report: [playwright-report/index.html](../../playwright-report/index.html)

## Result Summary

| Command | Scope | Result | Exit code | Notes |
|---|---|---:|---:|---|
| `npm run qaqc:smoke` | `platform-health.spec.ts`, `production-shell.spec.ts`, `v2-role-smoke.spec.ts`, `v2-responsive.mobile.spec.ts` | PASS: 9 passed | 0 | No failed or flaky tests observed. |
| `npx playwright test tests/qaqc/language-switch.spec.ts` | `language-switch.spec.ts` | PASS: 5 passed, 1 skipped | 0 | Admin-role language-switch test was skipped by the spec. No failed or flaky tests observed. |

## Spec Breakdown

| Spec | Result | Evidence |
|---|---:|---|
| `tests/qaqc/platform-health.spec.ts` | 2 passed | API health through Caddy `/api` proxy and React app serving checks passed. |
| `tests/qaqc/production-shell.spec.ts` | 1 passed | Root React app loaded without a blank shell. |
| `tests/qaqc/v2-role-smoke.spec.ts` | 5 passed | Student, parent, and teacher demo sign-in checks passed; role navigation and student learning/progress surface checks passed. |
| `tests/qaqc/v2-responsive.mobile.spec.ts` | 1 passed | Student home remained usable on mobile viewport. |
| `tests/qaqc/language-switch.spec.ts` | 5 passed, 1 skipped | Unauthenticated, student, teacher, parent, and cross-tab persistence checks passed; admin-role case skipped. |

## Flakes / Failures

| Category | Status | Details |
|---|---|---|
| Failing tests | None observed | Both requested commands exited `0`. |
| Flaky tests / retries | None observed | Output showed clean pass results and no retry markers. |
| Skipped tests | 1 observed | `language switching - admin role › admin role updates language across modals and reverts` was skipped by the test suite. |
| Console gap notes | Observed, non-failing | The language-switch suite printed known gap messages for hardcoded login submit text and unavailable optional modal/dialog targets, but these did not fail the run. |

## Defects

No defects filed from this W3 smoke pass.

| Role/Screen | Severity | Repro | Expected | Actual | Suspected file | Screenshot |
|---|---|---|---|---|---|---|
| N/A | N/A | N/A | N/A | N/A | N/A | N/A |
