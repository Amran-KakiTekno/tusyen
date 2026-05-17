# QA/QC Environment Snapshot

- Run date: 2026-05-17T23:12:41.2662687+08:00
- Repository root: D:\2026\tusyen
- Base URL: http://localhost
- Results directory: docs/qaqc-results-2026-05-17

## Docker Compose

``text
NAME             IMAGE                                      COMMAND                  SERVICE      CREATED          STATUS                    PORTS
edu_api          tusyen-api                                 "docker-entrypoint.s…"   api          2 minutes ago    Up 2 minutes (healthy)    127.0.0.1:3000->3000/tcp
edu_caddy        caddy:2.8.4-alpine                         "caddy run --config …"   caddy        36 minutes ago   Up 36 minutes             127.0.0.1:80->80/tcp, 127.0.0.1:443->443/tcp
edu_centrifugo   centrifugo/centrifugo:v5.4.9               "centrifugo -c confi…"   centrifugo   36 minutes ago   Up 36 minutes             127.0.0.1:8000->8000/tcp
edu_keycloak     quay.io/keycloak/keycloak:24.0.5           "/opt/keycloak/bin/k…"   keycloak     36 minutes ago   Up 36 minutes             127.0.0.1:8080->8080/tcp
edu_minio        minio/minio:RELEASE.2024-05-10T01-41-38Z   "/usr/bin/docker-ent…"   minio        36 minutes ago   Up 36 minutes (healthy)   127.0.0.1:9000-9001->9000-9001/tcp
edu_ntfy         binwiederhier/ntfy:v2.10.0                 "ntfy serve"             ntfy         36 minutes ago   Up 36 minutes             127.0.0.1:2586->80/tcp
edu_postgres     postgres:16.3-alpine                       "docker-entrypoint.s…"   postgres     36 minutes ago   Up 36 minutes (healthy)   127.0.0.1:5432->5432/tcp
edu_redis        redis:7.2.5-alpine                         "docker-entrypoint.s…"   redis        36 minutes ago   Up 36 minutes             127.0.0.1:6379->6379/tcp

``

## Health Checks

### API /api/health

``json
{
    "status":  "healthy",
    "database":  "connected",
    "redis":  "connected",
    "notifications":  {
                          "enabled":  true,
                          "connected":  true,
                          "statusCode":  200,
                          "url":  "http://ntfy",
                          "publicUrl":  "http://localhost:2586"
                      },
    "timestamp":  "2026-05-17T15:12:39.185Z"
}
``

### ntfy /v1/health

``json
{
    "healthy":  true
}
``

## Git

- HEAD: addf9f59caaa0dec034971e48d2a37c09db726aa

``text
 M .env.example
 M .gitignore
 M Caddyfile
 M README.md
 M backend/package-lock.json
 M backend/package.json
 M backend/scripts/db-hygiene.js
 M backend/scripts/migrate.js
 M backend/scripts/seed-demo.js
 M backend/src/admin/routes.ts
 M backend/src/auth/keycloak.ts
 M backend/src/auth/routes.ts
 M backend/src/auth/types.d.ts
 M backend/src/classroom/routes.ts
 M backend/src/config.ts
 M backend/src/index.ts
 M backend/src/learning/routes.ts
 M backend/src/progress/routes.ts
 M backend/src/quiz/logic.ts
 M backend/src/quiz/routes.ts
 M backend/src/quiz/store.ts
 M backend/src/sync/routes.ts
 M backend/src/websocket/handlers.ts
 M backend/test/auth.routes.test.ts
 M backend/test/classroom.routes.test.ts
 M backend/test/keycloak-auth.test.ts
 M backend/test/learning.routes.test.ts
 M backend/test/progress.routes.test.ts
 M backend/test/quiz.logic.test.ts
 M backend/test/quiz.routes.test.ts
 M centrifugo/config.json
 M docker-compose.yml
 M docs/playwright-qaqc.md
 M flutter_app/lib/core/network/api_endpoints.dart
 M flutter_app/lib/main.dart
 M flutter_app/lib/quiz_support.dart
 M keycloak/realm-export.json
 M package-lock.json
 M package.json
 M scripts/extract_stem_textbooks_to_db.py
 M scripts/ocr_missing_text_pages_to_sidecars.py
 M tests/qaqc/full-feature-regression.spec.ts
 M tests/qaqc/platform-health.spec.ts
 M tests/qaqc/production-shell.spec.ts
 M tests/qaqc/support/api.ts
 M tests/qaqc/support/app.ts
 M tests/qaqc/v2-responsive.mobile.spec.ts
 M tests/qaqc/v2-role-smoke.spec.ts
 M web_app/app.js
 M web_app/components/admin.jsx
 M web_app/components/parent.jsx
 M web_app/components/shared.jsx
 M web_app/components/student.jsx
 M web_app/components/teacher.jsx
 M web_app/index.html
 M web_app/styles.css
?? backend/.eslintrc.cjs
?? backend/src/audit.ts
?? backend/src/auth/session.ts
?? database/migrations/012_quiz_deck_stem_question_types.sql
?? database/migrations/013_quiz_timer_controls.sql
?? database/migrations/014_student_hearts.sql
?? database/migrations/015_free_learning.sql
?? docs/prompt-header-plan.md
?? docs/qaqc-codex-prompt-2026-05-17.md
?? docs/qaqc-full-plan-2026-05-17.md
?? docs/qaqc-results-2026-05-17/
?? minio/
?? scripts/build-web-app.js
?? scripts/enrich_textbook_lessons.py
?? scripts/extract_textbooks_to_json.py
?? scripts/generate_textbook_elaborations.py
?? scripts/gpt_textbook_enrichment_prompt.md
?? scripts/textbook_elaboration_reports/
?? scripts/textbook_json/
?? tests/qaqc/language-switch.spec.ts
?? web_app/components/quiz.jsx
?? web_app/dist/
?? web_app/icons/
?? web_app/main.jsx
?? web_app/manifest.json
?? web_app/sw.js

``

## QA-affecting toggles

- DEMO_ADMIN_LOGIN_ENABLED: .env=true; process=
- PUBLIC_ADMIN_REGISTRATION_ENABLED: .env=<not set in .env>; process=
- ALLOW_GUEST_QUIZ_JOIN: .env=<not set in .env>; process=
- AUTH_COOKIE_SECURE: .env=false; process=
- NODE_ENV: .env=development; process=

## Applied migrations

``json
[   {     "file_name": "001_initial.sql",     "applied_at": "2026-05-17T14:36:36.471Z"   },   {     "file_name": "002_quiz_live.sql",     "applied_at": "2026-05-17T14:36:36.486Z"   },   {     "file_name": "003_xp_events.sql",     "applied_at": "2026-05-17T14:36:36.493Z"   },   {     "file_name": "004_social_profiles.sql",     "applied_at": "2026-05-17T14:36:36.501Z"   },   {     "file_name": "005_rich_content_and_media.sql",     "applied_at": "2026-05-17T14:36:36.517Z"   },   {     "file_name": "006_lesson_content_review.sql",     "applied_at": "2026-05-17T14:36:36.529Z"   },   {     "file_name": "007_whiteboard_recording_production.sql",     "applied_at": "2026-05-17T14:36:36.541Z"   },   {     "file_name": "008_database_hygiene.sql",     "applied_at": "2026-05-17T14:36:36.549Z"   },   {     "file_name": "009_keycloak_auth_integration.sql",     "applied_at": "2026-05-17T14:36:36.558Z"   },   {     "file_name": "010_stem_exercise_types.sql",     "applied_at": "2026-05-17T14:36:36.571Z"   },   {     "file_name": "011_textbook_extraction.sql",     "applied_at": "2026-05-17T14:36:36.581Z"   },   {     "file_name": "012_quiz_deck_stem_question_types.sql",     "applied_at": "2026-05-17T14:36:36.587Z"   },   {     "file_name": "013_quiz_timer_controls.sql",     "applied_at": "2026-05-17T14:36:36.596Z"   },   {     "file_name": "014_student_hearts.sql",     "applied_at": "2026-05-17T14:36:36.601Z"   },   {     "file_name": "015_free_learning.sql",     "applied_at": "2026-05-17T14:36:36.617Z"   } ]
``

## Web bundle

- Path: D:\2026\tusyen\web_app\dist\app.bundle.js
- LastWriteTime: 2026-05-17T23:11:34.5573547+08:00
- SizeBytes: 1108900
- SHA256: 9CACEEFAE4EE25AEFB8B19FA605AB8624683B4627FC0D0874C3B3729B23D2E28
