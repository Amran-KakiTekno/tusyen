# W6 Admin Surface API QA/QC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w6-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Data suffix: w6df8dd38bxi49y
- Base URL: http://localhost
- Env snapshot: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Probe: Playwright APIRequestContext plus docker Redis CLI and ntfy public poll
- Started: 2026-05-17T15:27:16.774Z
- Finished: 2026-05-17T15:27:19.139Z
- Scope: every current backend/src/admin/routes.ts route under /api/admin plus W6 guardrails

## Summary

- Overall result: PASS
- Admin route coverage: 34/34 routes have successful admin behavior and non-admin guard evidence.
- Request assertions: 88 passed, 0 failed.
- Non-admin guard checks: 34/34 returned HTTP 403.
- Defects found: 0.

## W6 guardrail evidence

- Users CRUD/status: created teacher/student/parent/toggle users; listed, viewed, patched, bulk-disabled/restored, status-disabled/restored, and soft-deleted the toggle user.
- User soft-delete: DELETE /api/admin/users/:id left the user retrievable with is_active=false and blocked deleted-user login.
- Parent links: created parent-student link, listed it by filters, then soft-deleted it from active listings.
- Classrooms CRUD/enrollment: created and patched classroom, enrolled student, removed enrollment, re-enrolled student, assigned lesson, then disabled classroom.
- Classroom disable preservation: inactive classroom remained queryable via isActive=false, disappeared from active search, and preserved the re-enrolled student list.
- Syllabus: created, listed, patched, and soft-deleted one syllabus item.
- Lessons question types: created, edited, and previewed 14/14 question types: multiple_choice, true_false, fill_blank, matching, representation_match, missing_step, step_order, numeric, diagram_label, error_diagnosis, prediction, code_trace, data_interpret, scenario.
- Notifications: /notifications/test topic w6-mp9xi49y returned success and ntfy public poll evidence was checked.
- System/stat surfaces: /stats, /logs, /system, /health all checked.
- Cache clear: seeded Redis keys, called /cache/clear, and verified matching key count changed 2 -> 0.

## Route matrix

| Route | Method | Admin result | Non-admin guard | Notes |
|---|---:|---|---|---|
| /api/admin/users | GET | PASS (200) | PASS (403) | list/search users: 200 |
| /api/admin/users/:id | GET | PASS (200, 200, 200) | PASS (403) | get teacher detail: 200; verify disabled user retrievable: 200; verify soft-deleted user inactive: 200 |
| /api/admin/users | POST | PASS (200, 200, 200, 200) | PASS (403) | create teacher teacher: 200; create student student: 200; create parent parent: 200; create student toggle: 200 |
| /api/admin/users/bulk-status | PATCH | PASS (200, 200) | PASS (403) | bulk disable user: 200; bulk restore user: 200 |
| /api/admin/users/:id | PATCH | PASS (200) | PASS (403) | patch teacher: 200 |
| /api/admin/users/:id | DELETE | PASS (200) | PASS (403) | soft-delete user: 200 |
| /api/admin/users/:id/status | PATCH | PASS (200, 200) | PASS (403) | status disable user: 200; status restore user: 200 |
| /api/admin/parent-links | GET | PASS (200, 200) | PASS (403) | list parent link: 200; verify parent link hidden: 200 |
| /api/admin/parent-links | POST | PASS (200) | PASS (403) | create parent link: 200 |
| /api/admin/parent-links/:id | DELETE | PASS (200) | PASS (403) | soft-delete parent link: 200 |
| /api/admin/classrooms | GET | PASS (200, 200, 200) | PASS (403) | list classroom: 200; verify disabled classroom hidden active: 200; verify disabled classroom preserved inactive: 200 |
| /api/admin/classrooms | POST | PASS (200) | PASS (403) | create classroom: 200 |
| /api/admin/classrooms/:id | PATCH | PASS (200) | PASS (403) | patch classroom: 200 |
| /api/admin/classrooms/:id | DELETE | PASS (200) | PASS (403) | disable classroom: 200 |
| /api/admin/classrooms/:id/students | POST | PASS (200, 200) | PASS (403) | enroll student: 200; re-enroll student: 200 |
| /api/admin/classrooms/:id/students | GET | PASS (200, 200, 200) | PASS (403) | list enrolled student: 200; verify enrollment removed: 200; verify disabled classroom preserves enrollment: 200 |
| /api/admin/classrooms/:id/students/:studentId | DELETE | PASS (200) | PASS (403) | remove enrollment: 200 |
| /api/admin/classrooms/:id/lessons | POST | PASS (200) | PASS (403) | assign lesson to classroom: 200 |
| /api/admin/stats | GET | PASS (200) | PASS (403) | read stats: 200 |
| /api/admin/logs | GET | PASS (200) | PASS (403) | read logs: 200 |
| /api/admin/system | GET | PASS (200) | PASS (403) | read system: 200 |
| /api/admin/syllabus | POST | PASS (200) | PASS (403) | create syllabus: 200 |
| /api/admin/syllabus/:id | PATCH | PASS (200) | PASS (403) | patch syllabus: 200 |
| /api/admin/syllabus/:id | DELETE | PASS (200) | PASS (403) | soft-delete syllabus: 200 |
| /api/admin/syllabus | GET | PASS (200, 200) | PASS (403) | list syllabus: 200; verify syllabus hidden: 200 |
| /api/admin/lessons | POST | PASS (200) | PASS (403) | create lesson with 14 question types: 200 |
| /api/admin/lessons | GET | PASS (200, 200) | PASS (403) | list lessons: 200; verify lesson inactive listed: 200 |
| /api/admin/lessons/:id | GET | PASS (200, 200) | PASS (403) | preview created lesson: 200; preview edited lesson: 200 |
| /api/admin/lessons/:id | PATCH | PASS (200) | PASS (403) | edit lesson with 14 question types: 200 |
| /api/admin/lessons/:id | DELETE | PASS (200) | PASS (403) | soft-delete lesson: 200 |
| /api/admin/notifications/health | GET | PASS (200, 200) | PASS (403) | notification health before: 200; notification health after: 200 |
| /api/admin/notifications/test | POST | PASS (200) | PASS (403) | publish notification test: 200 |
| /api/admin/health | GET | PASS (200) | PASS (403) | read admin health: 200 |
| /api/admin/cache/clear | POST | PASS (200) | PASS (403) | clear cache: 200 |

## Important artifacts

- Teacher user id: 63774e24-f278-49fd-9391-bfde2bcef33f
- Student user id: f21f5428-9b70-404c-8e3f-6c23066c07c1
- Parent user id: c6cbccba-757e-42e9-9ce5-7efe150032c4
- Soft-deleted toggle user id: 997acd76-d604-44ee-86b8-39ffac7c4ba6
- Parent link id: 483ab975-d147-4f23-99b0-4cdd801ed73a
- Classroom id: f2c92ad6-6723-42ff-9ca3-b6445aa801d0
- Syllabus id: 5056e0b7-7516-428a-824d-5c0f6796dce0
- Lesson id: ee5c6b1d-01fd-4aab-8ac6-3471acb20710
- Notification topic: w6-mp9xi49y
- Redis keys checked: stats:student:w6df8dd38bxi49y, leaderboard:classroom:w6df8dd38bxi49y

## Defects

No defects found in the W6 admin API surface during this probe.

## Residual risk

- This is API-level QA/QC only; no browser UI screenshots were taken for this W6 surface.
- The notification publish check verifies ntfy HTTP visibility for the smoke topic, not mobile push receipt on a physical device.
- Cache clear is intentionally broad for stats and leaderboard patterns; this probe used namespaced keys but the endpoint deletes all matching application cache keys by design.

## Raw check log

| Check | Method | Path | Status | Expected | Result | Details |
|---|---:|---|---:|---|---|---|
| non-admin guard | GET | /api/admin/users | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/users/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/users | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/users/bulk-status | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/users/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/users/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/users/00000000-0000-4000-8000-000000000000/status | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/parent-links | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/parent-links | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/parent-links/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/classrooms | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/classrooms | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/classrooms/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/classrooms/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/classrooms/00000000-0000-4000-8000-000000000000/students | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/classrooms/00000000-0000-4000-8000-000000000000/students | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/classrooms/00000000-0000-4000-8000-000000000000/students/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/classrooms/00000000-0000-4000-8000-000000000000/lessons | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/stats | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/logs?limit=1 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/system | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/syllabus | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/syllabus/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/syllabus/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/syllabus | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/lessons | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/lessons | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/lessons/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | PATCH | /api/admin/lessons/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | DELETE | /api/admin/lessons/00000000-0000-4000-8000-000000000000 | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/notifications/health | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/notifications/test | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | GET | /api/admin/health | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| non-admin guard | POST | /api/admin/cache/clear | 403 | HTTP 403 | PASS | {"error":"Admin access required"} |
| create teacher teacher | POST | /api/admin/users | 200 | HTTP 200 + contract | PASS | {"success":true,"user":{"id":"63774e24-f278-49fd-9391-bfde2bcef33f","email":"teacher.w6df8dd38bxi49y@tusyen.test","full_name":"W6 teacher w6df8dd38bxi49y","role":"teacher","phone_number":null,"date_of_birth":null,"is_active":true,"created_a... |
| create student student | POST | /api/admin/users | 200 | HTTP 200 + contract | PASS | {"success":true,"user":{"id":"f21f5428-9b70-404c-8e3f-6c23066c07c1","email":"student.w6df8dd38bxi49y@tusyen.test","full_name":"W6 student w6df8dd38bxi49y","role":"student","phone_number":"+60120000001","date_of_birth":"2012-01-15T00:00:00.0... |
| create parent parent | POST | /api/admin/users | 200 | HTTP 200 + contract | PASS | {"success":true,"user":{"id":"c6cbccba-757e-42e9-9ce5-7efe150032c4","email":"parent.w6df8dd38bxi49y@tusyen.test","full_name":"W6 parent w6df8dd38bxi49y","role":"parent","phone_number":null,"date_of_birth":null,"is_active":true,"created_at":... |
| create student toggle | POST | /api/admin/users | 200 | HTTP 200 + contract | PASS | {"success":true,"user":{"id":"997acd76-d604-44ee-86b8-39ffac7c4ba6","email":"toggle.w6df8dd38bxi49y@tusyen.test","full_name":"W6 toggle w6df8dd38bxi49y","role":"student","phone_number":"+60120000001","date_of_birth":"2012-01-15T00:00:00.000... |
| list/search users | GET | /api/admin/users?search=w6df8dd38bxi49y&limit=20 | 200 | HTTP 200 + contract | PASS | {"users":[{"id":"997acd76-d604-44ee-86b8-39ffac7c4ba6","email":"toggle.w6df8dd38bxi49y@tusyen.test","full_name":"W6 toggle w6df8dd38bxi49y","role":"student","phone_number":"+60120000001","date_of_birth":"2012-01-15T00:00:00.000Z","is_active... |
| get teacher detail | GET | /api/admin/users/63774e24-f278-49fd-9391-bfde2bcef33f | 200 | HTTP 200 + contract | PASS | {"user":{"id":"63774e24-f278-49fd-9391-bfde2bcef33f","email":"teacher.w6df8dd38bxi49y@tusyen.test","full_name":"W6 teacher w6df8dd38bxi49y","role":"teacher","phone_number":null,"date_of_birth":null,"avatar_url":null,"is_active":true,"create... |
| patch teacher | PATCH | /api/admin/users/63774e24-f278-49fd-9391-bfde2bcef33f | 200 | HTTP 200 + contract | PASS | {"success":true,"user":{"id":"63774e24-f278-49fd-9391-bfde2bcef33f","email":"teacher.w6df8dd38bxi49y@tusyen.test","full_name":"W6 teacher patched w6df8dd38bxi49y","role":"teacher","phone_number":"+60125550000","date_of_birth":null,"is_activ... |
| bulk disable user | PATCH | /api/admin/users/bulk-status | 200 | HTTP 200 + contract | PASS | {"success":true,"updated":1} |
| bulk restore user | PATCH | /api/admin/users/bulk-status | 200 | HTTP 200 + contract | PASS | {"success":true,"updated":1} |
| status disable user | PATCH | /api/admin/users/997acd76-d604-44ee-86b8-39ffac7c4ba6/status | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify disabled user retrievable | GET | /api/admin/users/997acd76-d604-44ee-86b8-39ffac7c4ba6 | 200 | HTTP 200 + contract | PASS | {"user":{"id":"997acd76-d604-44ee-86b8-39ffac7c4ba6","email":"toggle.w6df8dd38bxi49y@tusyen.test","full_name":"W6 toggle w6df8dd38bxi49y","role":"student","phone_number":"+60120000001","date_of_birth":"2012-01-15T00:00:00.000Z","avatar_url"... |
| status restore user | PATCH | /api/admin/users/997acd76-d604-44ee-86b8-39ffac7c4ba6/status | 200 | HTTP 200 + contract | PASS | {"success":true} |
| soft-delete user | DELETE | /api/admin/users/997acd76-d604-44ee-86b8-39ffac7c4ba6 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify soft-deleted user inactive | GET | /api/admin/users/997acd76-d604-44ee-86b8-39ffac7c4ba6 | 200 | HTTP 200 + contract | PASS | {"user":{"id":"997acd76-d604-44ee-86b8-39ffac7c4ba6","email":"toggle.w6df8dd38bxi49y@tusyen.test","full_name":"W6 toggle w6df8dd38bxi49y","role":"student","phone_number":"+60120000001","date_of_birth":"2012-01-15T00:00:00.000Z","avatar_url"... |
| deleted user login blocked | POST | /api/auth/login | 403 | HTTP 401/403 | PASS | {"error":"Account deactivated"} |
| create parent link | POST | /api/admin/parent-links | 200 | HTTP 200 + contract | PASS | {"success":true,"link":{"id":"483ab975-d147-4f23-99b0-4cdd801ed73a","parent_id":"c6cbccba-757e-42e9-9ce5-7efe150032c4","student_id":"f21f5428-9b70-404c-8e3f-6c23066c07c1","is_active":true,"created_at":"2026-05-17T15:27:17.735Z"}} |
| list parent link | GET | /api/admin/parent-links?parentId=c6cbccba-757e-42e9-9ce5-7efe150032c4&studentId=f21f5428-9b70-404c-8e3f-6c23066c07c1 | 200 | HTTP 200 + contract | PASS | {"links":[{"id":"483ab975-d147-4f23-99b0-4cdd801ed73a","parent_id":"c6cbccba-757e-42e9-9ce5-7efe150032c4","student_id":"f21f5428-9b70-404c-8e3f-6c23066c07c1","is_active":true,"created_at":"2026-05-17T15:27:17.735Z","parent_name":"W6 parent ... |
| soft-delete parent link | DELETE | /api/admin/parent-links/483ab975-d147-4f23-99b0-4cdd801ed73a | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify parent link hidden | GET | /api/admin/parent-links?parentId=c6cbccba-757e-42e9-9ce5-7efe150032c4&studentId=f21f5428-9b70-404c-8e3f-6c23066c07c1 | 200 | HTTP 200 + contract | PASS | {"links":[]} |
| create classroom | POST | /api/admin/classrooms | 200 | HTTP 200 + contract | PASS | {"success":true,"classroom":{"id":"f2c92ad6-6723-42ff-9ca3-b6445aa801d0","teacher_id":"63774e24-f278-49fd-9391-bfde2bcef33f","name":"W6 Admin API w6df8dd38bxi49y","description":"Created by qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2... |
| list classroom | GET | /api/admin/classrooms?search=W6%20Admin%20API%20w6df8dd38bxi49y | 200 | HTTP 200 + contract | PASS | {"classrooms":[{"id":"f2c92ad6-6723-42ff-9ca3-b6445aa801d0","teacher_id":"63774e24-f278-49fd-9391-bfde2bcef33f","name":"W6 Admin API w6df8dd38bxi49y","description":"Created by qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e","subject":... |
| patch classroom | PATCH | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0 | 200 | HTTP 200 + contract | PASS | {"success":true,"classroom":{"id":"f2c92ad6-6723-42ff-9ca3-b6445aa801d0","teacher_id":"63774e24-f278-49fd-9391-bfde2bcef33f","name":"W6 Admin API w6df8dd38bxi49y patched","description":"Patched through W6 API probe","subject":"Mathematics",... |
| enroll student | POST | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students | 200 | HTTP 200 + contract | PASS | {"success":true} |
| list enrolled student | GET | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students | 200 | HTTP 200 + contract | PASS | {"students":[{"id":"f21f5428-9b70-404c-8e3f-6c23066c07c1","full_name":"W6 student w6df8dd38bxi49y","email":"student.w6df8dd38bxi49y@tusyen.test","joined_at":"2026-05-17T15:27:17.782Z","last_active_at":null}],"total":1} |
| remove enrollment | DELETE | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students/f21f5428-9b70-404c-8e3f-6c23066c07c1 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify enrollment removed | GET | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students | 200 | HTTP 200 + contract | PASS | {"students":[],"total":0} |
| re-enroll student | POST | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students | 200 | HTTP 200 + contract | PASS | {"success":true} |
| create syllabus | POST | /api/admin/syllabus | 200 | HTTP 200 + contract | PASS | {"success":true,"item":{"id":"5056e0b7-7516-428a-824d-5c0f6796dce0","subject":"Mathematics","form_level":4,"topic":"W6 Topic w6df8dd38bxi49y","subtopic":"Vectors","order_index":77,"content":{"namespace":"w6-2026-05-17-df8dd38b-0eef-4b6b-bc3... |
| list syllabus | GET | /api/admin/syllabus?subject=Mathematics&formLevel=4 | 200 | HTTP 200 + contract | PASS | {"syllabus":[{"id":"5056e0b7-7516-428a-824d-5c0f6796dce0","subject":"Mathematics","form_level":4,"topic":"W6 Topic w6df8dd38bxi49y","subtopic":"Vectors","order_index":77,"content":{"namespace":"w6-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3... |
| patch syllabus | PATCH | /api/admin/syllabus/5056e0b7-7516-428a-824d-5c0f6796dce0 | 200 | HTTP 200 + contract | PASS | {"success":true,"item":{"id":"5056e0b7-7516-428a-824d-5c0f6796dce0","subject":"Mathematics","form_level":4,"topic":"W6 Topic patched w6df8dd38bxi49y","subtopic":"Vectors patched","order_index":78,"content":{"namespace":"w6-2026-05-17-df8dd3... |
| create lesson with 14 question types | POST | /api/admin/lessons | 200 | HTTP 200 + contract | PASS | {"success":true,"lessonId":"ee5c6b1d-01fd-4aab-8ac6-3471acb20710"} |
| list lessons | GET | /api/admin/lessons?subject=Mathematics&formLevel=4&limit=20 | 200 | HTTP 200 + contract | PASS | {"lessons":[{"id":"ee5c6b1d-01fd-4aab-8ac6-3471acb20710","title":"W6 all question types w6df8dd38bxi49y","content":{"blocks":[{"body":"Safe API content block","type":"text","title":"QA content"}],"summary":"Create lesson for w6-2026-05-17-d... |
| preview created lesson | GET | /api/admin/lessons/ee5c6b1d-01fd-4aab-8ac6-3471acb20710 | 200 | HTTP 200 + contract | PASS | {"lesson":{"id":"ee5c6b1d-01fd-4aab-8ac6-3471acb20710","title":"W6 all question types w6df8dd38bxi49y","content":{"blocks":[{"body":"Safe API content block","type":"text","title":"QA content"}],"summary":"Create lesson for w6-2026-05-17-df8... |
| edit lesson with 14 question types | PATCH | /api/admin/lessons/ee5c6b1d-01fd-4aab-8ac6-3471acb20710 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| preview edited lesson | GET | /api/admin/lessons/ee5c6b1d-01fd-4aab-8ac6-3471acb20710 | 200 | HTTP 200 + contract | PASS | {"lesson":{"id":"ee5c6b1d-01fd-4aab-8ac6-3471acb20710","title":"W6 all question types edited w6df8dd38bxi49y","content":{"blocks":[{"body":"Safe edited API content block","type":"text","title":"QA content edited"}],"summary":"Edited lesson ... |
| assign lesson to classroom | POST | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/lessons | 200 | HTTP 200 + contract | PASS | {"success":true} |
| disable classroom | DELETE | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify disabled classroom hidden active | GET | /api/admin/classrooms?isActive=true&search=W6%20Admin%20API%20w6df8dd38bxi49y | 200 | HTTP 200 + contract | PASS | {"classrooms":[]} |
| verify disabled classroom preserved inactive | GET | /api/admin/classrooms?isActive=false&search=W6%20Admin%20API%20w6df8dd38bxi49y | 200 | HTTP 200 + contract | PASS | {"classrooms":[{"id":"f2c92ad6-6723-42ff-9ca3-b6445aa801d0","teacher_id":"63774e24-f278-49fd-9391-bfde2bcef33f","name":"W6 Admin API w6df8dd38bxi49y patched","description":"Patched through W6 API probe","subject":"Mathematics","form_level":... |
| verify disabled classroom preserves enrollment | GET | /api/admin/classrooms/f2c92ad6-6723-42ff-9ca3-b6445aa801d0/students | 200 | HTTP 200 + contract | PASS | {"students":[{"id":"f21f5428-9b70-404c-8e3f-6c23066c07c1","full_name":"W6 student w6df8dd38bxi49y","email":"student.w6df8dd38bxi49y@tusyen.test","joined_at":"2026-05-17T15:27:17.782Z","last_active_at":"2026-05-17T15:27:17.807Z"}],"total":1} |
| read stats | GET | /api/admin/stats | 200 | HTTP 200 + contract | PASS | {"stats":{"total_students":9,"total_teachers":7,"total_parents":5,"active_users":22,"inactive_users":1,"all_users":23,"active_classrooms":5,"total_enrollments":7,"total_lessons":7,"activities_today":5,"activities_previous_day":0,"new_studen... |
| read logs | GET | /api/admin/logs?limit=5 | 200 | HTTP 200 + contract | PASS | {"logs":[{"type":"success","message":"Pelajaran diterbitkan: W6 all question types edited w6df8dd38bxi49y","event_at":"2026-05-17T15:27:17.835Z"},{"type":"warn","message":"Akaun dinyahaktif: W6 toggle w6df8dd38bxi49y","event_at":"2026-05-17... |
| read system | GET | /api/admin/system | 200 | HTTP 200 + contract | PASS | {"config":{"nodeEnv":"development","port":3000,"corsAllowedOrigins":"http://localhost","keycloakRealm":"eduapp","keycloakClientId":"eduapp-api","ntfyEnabled":true,"publicAppUrl":"http://localhost","syncBatchSize":100,"maxSyncHistoryDays":30... |
| read admin health | GET | /api/admin/health | 200 | HTTP 200 + contract | PASS | {"status":"healthy","database":"connected","cache":"connected","notifications":{"enabled":true,"connected":true,"statusCode":200,"url":"http://ntfy","publicUrl":"http://localhost:2586"},"storage":{"database_size":"11 MB","total_files":"0"}} |
| notification health before | GET | /api/admin/notifications/health | 200 | HTTP 200 + contract | PASS | {"notifications":{"enabled":true,"connected":true,"statusCode":200,"url":"http://ntfy","publicUrl":"http://localhost:2586"}} |
| publish notification test | POST | /api/admin/notifications/test | 200 | HTTP 200 + contract | PASS | {"success":true,"result":{"ok":true,"topic":"w6-mp9xi49y","statusCode":200},"subscribeUrl":"http://localhost:2586/w6-mp9xi49y"} |
| notification health after | GET | /api/admin/notifications/health | 200 | HTTP 200 + contract | PASS | {"notifications":{"enabled":true,"connected":true,"statusCode":200,"url":"http://ntfy","publicUrl":"http://localhost:2586"}} |
| ntfy public poll contains smoke message | GET | http://localhost:2586/w6-mp9xi49y/json?poll=1 | 200 | HTTP 200 + message visible | PASS | {"id":"GMbtth0DZP7k","time":1779031637,"expires":1779074837,"event":"message","topic":"w6-mp9xi49y","title":"W6 w6df8dd38bxi49y","message":"W6 admin notification smoke w6df8dd38bxi49y","priority":3,"tags":["test_tube","tusyen"],"click":"htt... |
| clear cache | POST | /api/admin/cache/clear | 200 | HTTP 200 + contract | PASS | {"success":true,"message":"Cache cleared","deleted":2} |
| redis matching cache keys removed | REDIS | docker exec edu_redis redis-cli KEYS | 0 | 0 matching seeded keys after clear | PASS | before=2; after=0 |
| soft-delete lesson | DELETE | /api/admin/lessons/ee5c6b1d-01fd-4aab-8ac6-3471acb20710 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify lesson inactive listed | GET | /api/admin/lessons?isActive=false&limit=20 | 200 | HTTP 200 + contract | PASS | {"lessons":[{"id":"ee5c6b1d-01fd-4aab-8ac6-3471acb20710","title":"W6 all question types edited w6df8dd38bxi49y","content":{"blocks":[{"body":"Safe edited API content block","type":"text","title":"QA content edited"}],"summary":"Edited lesso... |
| soft-delete syllabus | DELETE | /api/admin/syllabus/5056e0b7-7516-428a-824d-5c0f6796dce0 | 200 | HTTP 200 + contract | PASS | {"success":true} |
| verify syllabus hidden | GET | /api/admin/syllabus?subject=Mathematics&formLevel=4 | 200 | HTTP 200 + contract | PASS | {"syllabus":[]} |