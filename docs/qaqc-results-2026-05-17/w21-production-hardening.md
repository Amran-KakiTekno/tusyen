# W21 Production Hardening Audit

- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w21-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repository: `D:\2026\tusyen`
- Environment snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Audit date: 2026-05-18

## Scope

Verify that production-mode toggles documented in `README.md` take effect without modifying production `.env` values.

The provided snapshot shows the live stack at `http://localhost`, with local `.env` values in development mode and `DEMO_ADMIN_LOGIN_ENABLED=true`. Production checks were therefore run with temporary process-level environment variables inside the existing `edu_api` container on an alternate internal port. No production `.env` values were edited.

## Result

Status: **Pass with one hardening defect**

The required production toggles were enforced in the isolated production-mode probe. One additional defect was found: Keycloak redirect origin validation still allows localhost defaults in production even when `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS` is set to an exact production origin.

## Evidence Summary

| Check | Expected | Actual | Status |
| --- | --- | --- | --- |
| `NODE_ENV=production` with placeholder secrets | API/config fails fast | Config import failed with missing/placeholder secret errors, wildcard origin errors, `MINIO_USE_SSL` error, and `AUTH_COOKIE_SECURE` error | Pass |
| `DEMO_ADMIN_LOGIN_ENABLED=false` | `admin@tusyen.test` login returns 403 | `POST /auth/login` returned 403, `Demo admin login is disabled on this deployment` | Pass |
| `PUBLIC_ADMIN_REGISTRATION_ENABLED=false` | Public admin registration returns 403 | `POST /auth/register` role `admin` returned 403, `Public admin registration is disabled` | Pass |
| `JWT_ACCESS_EXPIRES_IN=1h` | Access token `exp - iat` is 3600 seconds | Student login returned `expiresIn=3600`; decoded JWT `expDelta=3600` | Pass |
| `AUTH_COOKIE_SECURE=true` | Auth cookies include `HttpOnly`, `SameSite=Strict`, `Secure` | Login `Set-Cookie` contained all three flags | Pass |
| `ALLOW_GUEST_QUIZ_JOIN=false` | Unauthenticated `/quiz/join` requires auth | `POST /quiz/join` without bearer token returned 401, `Student authentication is required to join quiz sessions` | Pass |
| `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS` rejects foreign origins/no wildcard | Foreign redirect origin rejected; wildcard rejected in production config | `https://evil.example.com/keycloak-callback` returned 400; wildcard/trycloudflare origin failed production config import | Pass |
| `CORS_ALLOWED_ORIGINS` rejects foreign origins/no wildcard | Foreign browser origin receives no CORS allow header; wildcard rejected in production config | `Origin: https://evil.example.com` returned no `Access-Control-Allow-Origin`; configured `https://learn.example.com` returned exact allow header; wildcard failed production config import | Pass |
| `MINIO_USE_SSL=true` enforced in production and HTTP endpoint refused | Production config rejects `MINIO_USE_SSL=false`; SSL client fails against HTTP MinIO | Config import failed when false; authenticated upload with SSL client to current HTTP endpoint returned 500 `EPROTO wrong version number` | Pass |

## Probe Details

Production placeholder fail-fast used temporary env only:

```text
NODE_ENV=production
JWT_SECRET=short
DATABASE_URL=postgres://eduuser:change-in-production@postgres:5432/eduapp
MINIO_SECRET_KEY=change-in-production
CENTRIFUGO_SECRET=change-in-production
CENTRIFUGO_API_KEY=change-in-production
KEYCLOAK_CLIENT_SECRET=change-in-production
CORS_ALLOWED_ORIGINS=https://*.trycloudflare.com
KEYCLOAK_ALLOWED_REDIRECT_ORIGINS=https://*.trycloudflare.com
MINIO_USE_SSL=false
AUTH_COOKIE_SECURE=false
```

Observed fail-fast error:

```text
Production configuration is incomplete: JWT_SECRET must be at least 32 characters; DATABASE_URL must be set; MINIO_SECRET_KEY must be set; CENTRIFUGO_SECRET must be set; CENTRIFUGO_API_KEY must be set; KEYCLOAK_CLIENT_SECRET must be set; CORS_ALLOWED_ORIGINS must use exact production origins; KEYCLOAK_ALLOWED_REDIRECT_ORIGINS must use exact production origins; MINIO_USE_SSL must be true in production; AUTH_COOKIE_SECURE must be true in production
```

Isolated production API probe used temporary process-level env only:

```text
NODE_ENV=production
PORT=4017
JWT_SECRET=w21-production-jwt-secret-0123456789abcdef
KEYCLOAK_CLIENT_SECRET=w21-keycloak-client-secret
CENTRIFUGO_SECRET=w21-centrifugo-secret
CENTRIFUGO_API_KEY=w21-centrifugo-api-key
MINIO_SECRET_KEY=w21-minio-secret
MINIO_USE_SSL=true
AUTH_COOKIE_SECURE=true
DEMO_ADMIN_LOGIN_ENABLED=false
PUBLIC_ADMIN_REGISTRATION_ENABLED=false
ALLOW_GUEST_QUIZ_JOIN=false
JWT_ACCESS_EXPIRES_IN=1h
CORS_ALLOWED_ORIGINS=https://learn.example.com
KEYCLOAK_ALLOWED_REDIRECT_ORIGINS=https://learn.example.com
```

Notable response evidence:

```json
{"check":"demo_admin_login_disabled","passed":true,"status":403,"body":{"error":"Demo admin login is disabled on this deployment"}}
{"check":"public_admin_registration_disabled","passed":true,"status":403,"body":{"error":"Public admin registration is disabled"}}
{"check":"jwt_access_expires_in_1h","passed":true,"status":200,"expiresIn":3600,"expDelta":3600}
{"check":"auth_cookie_secure_flags","passed":true,"status":200,"setCookieSummary":{"hasHttpOnly":true,"hasSameSiteStrict":true,"hasSecure":true}}
{"check":"guest_quiz_join_requires_auth","passed":true,"status":401,"body":{"error":"Student authentication is required to join quiz sessions"}}
{"check":"keycloak_foreign_redirect_rejected","passed":true,"status":400,"body":{"error":"Keycloak redirect URI origin is not allowed."}}
{"check":"cors_foreign_origin_rejected","passed":true,"foreignStatus":200,"foreignAllowOrigin":null,"allowedStatus":200,"allowedAllowOrigin":"https://learn.example.com"}
{"check":"minio_ssl_http_endpoint_refused","passed":true,"status":500,"body":{"statusCode":500,"code":"EPROTO","error":"Internal Server Error","message":"write EPROTO ... wrong version number"}}
```

The main probe emitted all result rows before a shell-wrapper terminator issue returned a non-zero harness exit. The non-zero exit was not caused by a product assertion failure.

## Defects

### Defect 1: Keycloak production redirect allowlist still permits localhost defaults

- Role/Screen: Auth / Keycloak login URL
- Severity: Medium
- Repro: With temporary production env `NODE_ENV=production` and `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS=https://learn.example.com`, call `validateRedirectUriForRequest` for three origins.
- Expected: Only the configured exact production origin is allowed unless localhost is explicitly configured.
- Actual: `https://learn.example.com/keycloak-callback` is allowed, `https://evil.example.com/keycloak-callback` is rejected, but `http://localhost/keycloak-callback` is also allowed.
- Suspected file: `backend/src/auth/keycloak.ts`
- Screenshot: N/A, API/config audit.

Probe output:

```json
{"uri":"https://learn.example.com/keycloak-callback","allowed":true,"value":"https://learn.example.com/keycloak-callback"}
{"uri":"https://evil.example.com/keycloak-callback","allowed":false,"error":"Keycloak redirect URI origin is not allowed."}
{"uri":"http://localhost/keycloak-callback","allowed":true,"value":"http://localhost/keycloak-callback"}
```

Suggested fix: In `allowedRedirectOrigins`, only append localhost development defaults when `config.NODE_ENV !== 'production'`, or make localhost defaults opt-in through `KEYCLOAK_ALLOWED_REDIRECT_ORIGINS`.

## Residual Risk

- This audit used the existing containerized services and temporary process env. It did not edit `.env`, rebuild images, rotate secrets, or validate a real public TLS hostname.
- Secure cookies were verified by response headers over local HTTP. Browser storage/send behavior over real HTTPS should still be covered in staging.
- MinIO SSL enforcement was verified against the current local HTTP MinIO endpoint. A real TLS MinIO/S3 endpoint should be verified separately before production cutover.
