# Plan: Auth / Quiz Fixes + CORS + Pagination + Hearts + Admin Tests

**Branch:** `feature/auth-quiz-fixes`  
**Date:** 2026-05-18  
**Scope:** Four self-contained tasks.

---

## Pre-flight Observations

| Item | Finding |
|---|---|
| Task 1.11 — Pagination `GET /progress/student/:id` | **Already implemented.** `progress/routes.ts` lines 21–79 already parse `limit`/`offset`, cap at 200, default to 50, and set `X-Total-Count`. **No work needed.** |
| Task 1.6 — Centrifugo `allowed_origins` | `docker-compose.yml` already passes `CENTRIFUGO_ALLOWED_ORIGINS` to the container with a default fallback. `config.json` still has the hardcoded array. Fix = update `config.json` only; add var to `.env.example`. |
| Task 2.17 — Hearts loading state | `student.jsx:2767` already renders `stats.hearts \|\| '...'` — the null guard is in place. **No fix needed; mark done.** |
| Task 4.3 — Admin unit tests | The test file already covers `PATCH /admin/users/:id` (line 70–114) and the parent-link lifecycle (lines 147–191). **All required cases are present.** Needs a run to confirm they pass. |
| Security fixes (revokeRefreshToken, quiz HTTP codes) | These are part of the request; need to be implemented. |
| New backend tests (auth.session, quiz.routes) | Not yet written; need to be added. |

---

## Tasks

### Wave 0 — No blocking migrations. Proceed directly to parallel waves.

---

### Wave 1 — Parallel Tasks

#### Task A — Fix `revokeRefreshToken` usedKey leak  `[PARALLEL]`

**File:** `backend/src/auth/session.ts`

**Lines:** 141–146 (current `revokeRefreshToken` implementation)

**Change:** Replace the single `redis.del(refreshKey(...))` call with `Promise.all` that also deletes the grace-window key `${REFRESH_PREFIX}used:${parsed.id}`.

```ts
export async function revokeRefreshToken(refreshToken: unknown) {
  const parsed = parseRefreshToken(refreshToken);
  if (!parsed) return false;
  await Promise.all([
    redis.del(refreshKey(parsed.id)),
    redis.del(`${REFRESH_PREFIX}used:${parsed.id}`),
  ]);
  return true;
}
```

**Verify:** `cd backend && npx vitest run` — all 58 tests pass.

---

#### Task B — Fix review route HTTP status codes  `[PARALLEL]`

**File:** `backend/src/quiz/routes.ts`

**Lines:** 274–276 (catch block of `GET /sessions/:sessionId/review`)

**Current code:**
```ts
const code = msg.includes('not authorized') || msg.includes('not found') ? 403 : 500;
```

**Change:** Replace with the three-way derivation so `not found` returns 404 and `not yet ended` returns 400:

```ts
const code =
  msg.includes('not authorized') ? 403 :
  msg.includes('not found') ? 404 :
  msg.includes('not yet ended') ? 400 : 500;
```

**Verify:** `cd backend && npx vitest run` — existing tests pass.

---

#### Task C — Fix Centrifugo `allowed_origins` for production  `[PARALLEL]`

**File 1:** `centrifugo/config.json`

**Change:** Replace the hardcoded array:
```json
"allowed_origins": ["http://localhost", "http://127.0.0.1"]
```
With an empty array (Centrifugo 5 env override `CENTRIFUGO_ALLOWED_ORIGINS` takes precedence when set):
```json
"allowed_origins": []
```

**File 2:** `.env.example`

**Change:** Add under the `# Centrifugo Configuration` section:
```env
# Space- or comma-separated origins allowed to open WebSocket connections.
# Must be set for any non-localhost deployment.
CENTRIFUGO_ALLOWED_ORIGINS=https://yourdomain.com
```

**Note:** `docker-compose.yml` already passes `CENTRIFUGO_ALLOWED_ORIGINS: ${CENTRIFUGO_ALLOWED_ORIGINS:-http://localhost,http://127.0.0.1}` to the centrifugo service — no change needed there.

---

### Wave 2 — Sequential Tasks (depend on Wave 1 A/B)

#### Task D — Write `backend/test/auth.session.test.ts`  `[SEQUENTIAL — after Task A]`

**File:** `backend/test/auth.session.test.ts` *(new file)*

**Tests to write** (mock `redis` and `crypto` as needed; follow the vitest + vi.mock pattern used in existing test files):

1. **`consumeRefreshToken` — first call returns record**  
   Seed `redis.get(key)` with a valid record JSON. Call `consumeRefreshToken`. Assert it returns a `RefreshTokenRecord` with correct `userId`.

2. **`consumeRefreshToken` — second call within grace window returns same record**  
   After first call moves data to `usedKey`, stub `redis.get(key)` → null and `redis.get(usedKey)` → same JSON. Call again. Assert same record is returned.

3. **`consumeRefreshToken` — after `redis.del(usedKey)`, returns null**  
   Stub `redis.get(key)` → null and `redis.get(usedKey)` → null. Assert null is returned.

4. **`revokeRefreshToken` — deletes both keys**  
   Call `revokeRefreshToken` with a valid token string. Assert `redis.del` was called exactly twice — once for `auth:refresh:<id>` and once for `auth:refresh:used:<id>`.

**Verify:** `cd backend && npx vitest run test/auth.session.test.ts`

---

#### Task E — Add enrollment + review tests to `backend/test/quiz.routes.test.ts`  `[SEQUENTIAL — after Task B]`

**File:** `backend/test/quiz.routes.test.ts` *(append to existing `describe` block)*

**New test 1 — Student enrolled → 200 from `GET /quiz/classrooms/:id/sessions`:**
- Build app with student user.
- Mock `store.listQuizSessions` to resolve to an array of sessions.
- Assert status 200 and `response.json().sessions` is truthy.

**New test 2 — Student not enrolled → 403 from `GET /quiz/classrooms/:id/sessions`:**
- Build app with student user.
- Mock `store.listQuizSessions` to reject with `new Error('Student is not enrolled in this classroom')`.
- Assert status 403.

**New test 3 — `GET /sessions/:sessionId/review` — session not yet ended → 400:**
- Build app with any authenticated user.
- Mock `store.getSessionParticipantReview` (import it from `store` and add to the `vi.mock`) to reject with `new Error('Session has not yet ended')`.
- Assert status 400.

**New test 4 — `GET /sessions/:sessionId/review` — wrong participant token → 403 or 404:**
- Mock to reject with `new Error('Participant not found')`.
- Assert status 404 (because `not found` → 404 after Task B fix).

**New test 5 — `GET /sessions/:sessionId/review` — correct token → 200 with review array:**
- Mock to resolve with `[{ questionId: 'q1', correct: true }]`.
- Assert status 200 and `response.json().review` is an array.

**Note:** `getSessionParticipantReview` must be added to the `vi.mock('../src/quiz/store', ...)` factory and imported via `vi.mocked(store)`.

**Verify:** `cd backend && npx vitest run test/quiz.routes.test.ts`

---

### Wave 3 — Verification Pass

#### Task F — Confirm Task 2.17 (hearts) is already done  `[SEQUENTIAL — final]`

**File:** `web_app/components/student.jsx:2767`

**Observation:** `<StatPill icon="HP" value={String(stats.hearts || '...')} ...>` — the `|| '...'` guard is already in place. When `hearts` is `null`, the widget renders `"..."`. No code change needed.

**Action:** Read the line to confirm, then mark done.

---

#### Task G — Confirm Task 4.3 (admin tests) are complete  `[SEQUENTIAL — final]`

**File:** `backend/test/admin.routes.test.ts`

**Observation:** The file already contains:
- `it('preserves optional user fields during partial updates', ...)` — covers `PATCH /admin/users/:id`
- `it('creates and deactivates parent-student links', ...)` — covers the full `POST /admin/parent-links` + `DELETE /admin/parent-links/:id` lifecycle

**Action:** Run `cd backend && npx vitest run test/admin.routes.test.ts` to confirm all 4 existing tests pass. No new tests to write.

---

## Post-Wave Build & Test

After all tasks are committed:

```bash
node scripts/build-web-app.js
cd backend && npx vitest run test/admin.routes.test.ts
cd backend && npx vitest run
```

Then run the Playwright suite:

```bash
npm run qaqc
```

Open a PR from `feature/auth-quiz-fixes` into `main`. Squash merge. Delete branch.

---

## Parallelism Summary

| Wave | Tasks | Can run simultaneously? |
|---|---|---|
| 1 | A (revokeRefreshToken), B (quiz HTTP codes), C (Centrifugo CORS) | Yes — different files |
| 2 | D (auth.session.test.ts), E (quiz.routes.test.ts) | Yes — different files; D waits on A, E waits on B |
| 3 | F (hearts verify), G (admin tests run) | Yes — read-only verifications |

---

## Files Touched

| File | Task | Change type |
|---|---|---|
| `backend/src/auth/session.ts` | A | Edit (3 lines) |
| `backend/src/quiz/routes.ts` | B | Edit (3 lines) |
| `centrifugo/config.json` | C | Edit (1 line) |
| `.env.example` | C | Edit (add 2 lines) |
| `backend/test/auth.session.test.ts` | D | New file |
| `backend/test/quiz.routes.test.ts` | E | Append to existing file |
