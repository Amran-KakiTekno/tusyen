# W5 Auth & Keycloak Deep

- Workstream: W5 Auth & Keycloak Deep
- Run ID: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w5-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Executed: 2026-05-17 23:34-23:45 +08:00
- Base URL: http://localhost
- Env snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Scope: `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/link-parent`, `/api/auth/linked-students`, `/api/auth/keycloak/status`, `/api/auth/keycloak/login-url`, `/api/auth/keycloak/callback`
- Tools: PowerShell HTTP probes using `Invoke-WebRequest`; disposable W5 fixture accounts created through public auth APIs; disabled-user fixture flipped through Postgres; Keycloak full PKCE callback attempted through a disposable Keycloak admin-created user.
- Overall status: **FAIL** (24 passed, 1 failed)

## Scenario results

| # | Scenario | Expected | Actual | Result | Evidence | Suspected file |
|---:|---|---|---|---|---|---|
| 1 | Preflight API health | HTTP 200 and healthy status | HTTP 200, `status=healthy` | **PASS** | `GET /api/health` | `backend/src/index.ts` |
| 2 | Register student role | HTTP 200 with student user and tokens | Created by W5 API register fixture: `student-df8dd38b0eef-1779031814911@qaqc.test` | **PASS** | `POST /api/auth/register` role=`student`; DB row exists from this W5 run | `backend/src/auth/routes.ts` |
| 3 | Register teacher role | HTTP 200 with teacher user and tokens | Created by W5 API register fixture: `teacher-df8dd38b0eef-1779031814911@qaqc.test` | **PASS** | `POST /api/auth/register` role=`teacher`; DB row exists from this W5 run | `backend/src/auth/routes.ts` |
| 4 | Register parent role | HTTP 200 with parent user and tokens | Created by W5 API register fixture: `parent-df8dd38b0eef-1779031814911@qaqc.test` | **PASS** | `POST /api/auth/register` role=`parent`; DB row exists from this W5 run | `backend/src/auth/routes.ts` |
| 5 | Admin public registration gated | HTTP 403 when `PUBLIC_ADMIN_REGISTRATION_ENABLED=false/default` | HTTP 403 observed for admin register probe | **PASS** | `POST /api/auth/register` role=`admin` | `backend/src/auth/routes.ts` |
| 6 | Valid student login | HTTP 200 with app JWT and refresh token | HTTP 200, token present, refresh token present | **PASS** | `POST /api/auth/login` active student fixture | `backend/src/auth/routes.ts` |
| 7 | Wrong password login rejected | HTTP 401 Invalid credentials | HTTP 401 | **PASS** | `POST /api/auth/login` valid teacher email with wrong password | `backend/src/auth/routes.ts` |
| 8 | Unknown email login rejected | HTTP 401 Invalid credentials | HTTP 401 | **PASS** | `POST /api/auth/login` unknown email | `backend/src/auth/routes.ts` |
| 9 | Disabled user login rejected | HTTP 403 Account deactivated | HTTP 403 | **PASS** | Set W5 student fixture `is_active=false` in Postgres, then `POST /api/auth/login` | `backend/src/auth/routes.ts` |
| 10 | Login sets auth cookies | HTTP 200 with `HttpOnly`, `SameSite=Strict` auth cookies | HTTP 200, `HttpOnly=True`, `SameSiteStrict=True` | **PASS** | `POST /api/auth/login`, inspect `Set-Cookie` | `backend/src/auth/session.ts` |
| 11 | `AUTH_COOKIE_SECURE` flag under current env | With snapshot `AUTH_COOKIE_SECURE=false`, `Secure` flag is absent without env edit | `SecurePresent=False` | **PASS** | `POST /api/auth/login`, inspect `Set-Cookie` | `backend/src/auth/session.ts` |
| 12 | Token expiry metadata returned | Positive `expiresIn` and `refreshExpiresIn` values | `expiresIn=3600`, `refreshExpiresIn=604800` | **PASS** | `POST /api/auth/login` response body | `backend/src/auth/session.ts` |
| 13 | Valid refresh rotates token | HTTP 200, new access token, new refresh token differs from old | HTTP 200, `rotated=True` | **PASS** | `POST /api/auth/refresh` with current refresh token | `backend/src/auth/session.ts` |
| 14 | Old refresh token reuse rejected | HTTP 401 after rotation consumes old refresh token | HTTP 401 | **PASS** | Reuse old refresh token after successful rotation | `backend/src/auth/session.ts` |
| 15 | Parent can list linked students | HTTP 200 with `students` array for parent token | HTTP 200 | **PASS** | `GET /api/auth/linked-students` with parent Bearer token | `backend/src/auth/routes.ts` |
| 16 | Parent link rejects nonexistent student | HTTP 404 Student not found | HTTP 404 | **PASS** | `POST /api/auth/link-parent` with nonexistent UUID | `backend/src/auth/routes.ts` |
| 17 | Parent link rejects wrong-role identifier | HTTP 404 when identifier belongs to teacher | HTTP 404 | **PASS** | `POST /api/auth/link-parent` with teacher email as `studentIdentifier` | `backend/src/auth/routes.ts` |
| 18 | Parent link rejects non-parent caller | HTTP 403 Only parents can link students | HTTP 403 | **PASS** | `POST /api/auth/link-parent` with teacher Bearer token | `backend/src/auth/routes.ts` |
| 19 | JWT tamper rejected | HTTP 401 for modified Bearer JWT | HTTP 401 | **PASS** | `GET /api/auth/linked-students` with one-character-tampered parent JWT | `backend/src/index.ts` |
| 20 | Keycloak status advertises PKCE provider | HTTP 200, provider `keycloak`, flow `authorization_code_pkce` | HTTP 200, provider=`keycloak`, flow=`authorization_code_pkce`, publicUrl=`http://localhost/auth` | **PASS** | `GET /api/auth/keycloak/status` | `backend/src/auth/routes.ts`; `backend/src/auth/keycloak.ts` |
| 21 | Keycloak login-url PKCE start happy path | HTTP 200 with state and S256 code challenge | HTTP 200, state present, `code_challenge_method=S256` present | **PASS** | `POST /api/auth/keycloak/login-url` with `http://localhost/keycloak-callback` | `backend/src/auth/routes.ts`; `backend/src/auth/keycloak.ts` |
| 22 | Keycloak rogue redirect rejected | HTTP 400 for non-allowlisted redirect origin | HTTP 400 | **PASS** | `POST /api/auth/keycloak/login-url` with `https://evil.example/keycloak-callback` | `backend/src/auth/keycloak.ts` |
| 23 | Keycloak callback invalid state rejected | HTTP 400 for missing/expired PKCE state | HTTP 400 | **PASS** | `POST /api/auth/keycloak/callback` with unknown state | `backend/src/auth/routes.ts`; `backend/src/auth/keycloak.ts` |
| 24 | Keycloak callback invalid code rejected | HTTP 401 when Keycloak rejects fake code after valid state lookup | HTTP 401 | **PASS** | Start login-url, then callback with valid state and fake code | `backend/src/auth/routes.ts`; `backend/src/auth/keycloak.ts` |
| 25 | Keycloak PKCE callback happy path | Real Keycloak auth code exchanged for app JWT, refresh token, and Keycloak user | Real Keycloak user created, login form completed, authorization code returned to `http://localhost/keycloak-callback`, but `/api/auth/keycloak/callback` returned HTTP 401 | **FAIL** | Disposable Keycloak user via admin API, browserless form login, callback with returned `code` and original `state` | `backend/src/auth/keycloak.ts`; Keycloak `eduapp-api` client config |

## Defects

### P0 - Keycloak PKCE callback happy path returns 401 after real authorization code

- Role/Screen: Keycloak login / `/api/auth/keycloak/callback`
- Severity: P0
- Repro: Create disposable Keycloak user via admin API, call `POST /api/auth/keycloak/login-url` with `redirectUri=http://localhost/keycloak-callback`, complete the Keycloak login form, capture the returned `code`, then call `POST /api/auth/keycloak/callback` with that `code`, original `state`, and same `redirectUri`.
- Expected: API exchanges the real authorization code, verifies Keycloak tokens, links/provisions the local user, and returns app JWT plus refresh token.
- Actual: Keycloak login produced a real callback URL with `code=...`, but `/api/auth/keycloak/callback` returned HTTP 401.
- Suspected file: `backend/src/auth/keycloak.ts`; Keycloak `eduapp-api` client config/secret/redirect settings.
- Screenshot: N/A - API request probe.

## Notes and residual risk

- No commits or environment-file edits were made.
- `AUTH_COOKIE_SECURE=true` was not toggled because env edits were prohibited. This run verified current-env cookie flags from the snapshot (`AUTH_COOKIE_SECURE=false`): `HttpOnly` and `SameSite=Strict` are present; `Secure` is absent as expected for this local run.
- Access-token expiry was validated from issued token metadata (`expiresIn=3600`) rather than by waiting for expiry or editing JWT TTL settings.
- Register-role rows use W5 fixture accounts already created by this run; the final rerun avoided extra public register calls because the first completed harness consumed the active register rate-limit budget.
- The disabled-user check intentionally changed only a disposable W5 fixture account to `is_active=false`.

## Fixture emails

- Student: `student-df8dd38b0eef-1779031814911@qaqc.test`
- Teacher: `teacher-df8dd38b0eef-1779031814911@qaqc.test`
- Parent: `parent-df8dd38b0eef-1779031814911@qaqc.test`
- Disabled student: `student-df8dd38b0eef-1779031578408@qaqc.test`
