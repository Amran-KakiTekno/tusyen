# W1 Backend Unit & Integration QA/QC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w1-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Repo: D:\2026\tusyen
- Backend: D:\2026\tusyen\backend
- Environment snapshot: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Result: PASS

## Commands run

```powershell
cd D:\2026\tusyen\backend
npm install
npm run build
npm test -- --run --reporter=verbose
```

Additional timing extraction command, used only because the verbose reporter did not emit per-file durations:

```powershell
npx vitest run --reporter=json
```

## Command outcomes

| Command | Result | Notes |
|---|---:|---|
| npm install | PASS | Exit 0; dependencies already up to date. |
| npm run build | PASS | Exit 0; TypeScript build completed. |
| npm test -- --run --reporter=verbose | PASS | Exit 0; 14 test files passed, 57 tests passed, 0 failed, 0 skipped. Verbose run duration: 1.38s. |
| npx vitest run --reporter=json | PASS | Exit 0; used for per-file durations below. |

## Test file results

| File | Status | Tests passed | Failed | Skipped | Duration |
|---|---:|---:|---:|---:|---:|
| backend/test/admin.routes.test.ts | PASS | 2 | 0 | 0 | 54 ms |
| backend/test/auth.routes.test.ts | PASS | 7 | 0 | 0 | 348 ms |
| backend/test/classroom.routes.test.ts | PASS | 2 | 0 | 0 | 150 ms |
| backend/test/external-video.test.ts | PASS | 4 | 0 | 0 | 6 ms |
| backend/test/keycloak-auth.test.ts | PASS | 3 | 0 | 0 | 4 ms |
| backend/test/learning.answers.test.ts | PASS | 6 | 0 | 0 | 5 ms |
| backend/test/learning.routes.test.ts | PASS | 2 | 0 | 0 | 44 ms |
| backend/test/media-access.test.ts | PASS | 4 | 0 | 0 | 8 ms |
| backend/test/notifications.test.ts | PASS | 3 | 0 | 0 | 11 ms |
| backend/test/progress.routes.test.ts | PASS | 10 | 0 | 0 | 252 ms |
| backend/test/quiz.logic.test.ts | PASS | 6 | 0 | 0 | 5 ms |
| backend/test/quiz.routes.test.ts | PASS | 4 | 0 | 0 | 58 ms |
| backend/test/quiz.store.test.ts | PASS | 1 | 0 | 0 | 4 ms |
| backend/test/whiteboard.routes.test.ts | PASS | 3 | 0 | 0 | 50 ms |

## Coverage confirmed

Covered backend route/store/logic areas in scope: auth, classroom, learning, lesson answers, progress, quiz logic, quiz routes, quiz store, whiteboard, admin, keycloak auth, notifications, media access, and external video helpers.

## Warnings

- `npm install` reported 7 vulnerabilities: 6 moderate, 1 high.
- `npm install` reported 98 packages looking for funding.
- No build warnings were emitted.
- No test warnings or skipped tests were emitted by the requested verbose run.

## Defects

No defects found in this W1 backend unit/integration pass.

### Defect template

- Role/Screen: N/A
- Severity: N/A
- Repro: N/A
- Expected: N/A
- Actual: N/A
- Suspected file: N/A
- Screenshot: N/A
