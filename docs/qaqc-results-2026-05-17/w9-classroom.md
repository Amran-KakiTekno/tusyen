# W9 Classroom Lifecycle QA/QC

- Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w9-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Executed at: 2026-05-17T15:26:54.995Z
- Base URL: http://localhost
- Env snapshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md
- Tooling: Playwright APIRequestContext against live Caddy/API stack
- Scope: /classroom/* plus /admin/classrooms/* counterparts
- Deliverable only: no commits, no env edits, no repo file changes outside this markdown

## Result

Overall status: PASS

Checks passed: 26/26

## QA actors and data

- admin: admin admin@tusyen.test (ef0acc79-0195-4b34-b105-0bbd48c47285)
- teacher.owner: teacher teacher.owner.w9.df8dd38b@tusyen.test (45d494bc-238d-4138-9f4a-a4bb9961fba4)
- teacher.newowner: teacher teacher.newowner.w9.df8dd38b@tusyen.test (5896c056-e421-46d5-a86e-b1fafecd9df3)
- student.primary: student student.primary.w9.df8dd38b@tusyen.test (3f69f98f-d4f7-4401-85c4-a5df125b0c52)
- student.blocked: student student.blocked.w9.df8dd38b@tusyen.test (93f289d2-6f19-4680-9e84-0e925614e613)
- Classroom: W9 Classroom Lifecycle df8dd38b (d30f90f2-ff04-4509-a72f-56d7f7379aac)
- Join code: WVC8VZ
- Reassigned teacher id: 5896c056-e421-46d5-a86e-b1fafecd9df3
- Disabled by teacher id: 5896c056-e421-46d5-a86e-b1fafecd9df3
- Lesson used for assign/unassign: Latihan Kecerunan Graf Lanjutan ME67FW (fade384d-33b1-4a77-bb1b-1d5b8f16f867)

## Coverage matrix

| Status | Check | Expected | Actual |
|---|---|---|---|
| PASS | Login as admin | 200 with token for admin@tusyen.test | 200 {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJlZjBhY2M3OS0wMTk1LTRiMzQtYjEwNS0wYmJkNDhjNDcyODUiLCJlbWFpbCI6ImFkbWluQHR1c3llbi50ZXN0Iiwicm9sZSI6ImFkbWluIiwianRpIjoiNWY0OWRhOTQtOWUyYS00YmJmLWEyN2ItNmIyZDAxNTRhMDk3IiwiaWF0IjoxNzc5MDMxNjE1LCJle |
| PASS | Create/reuse teacher actor | 200 created or 409 existing for teacher.owner.w9.df8dd38b@tusyen.test | 200 {"success":true,"user":{"id":"45d494bc-238d-4138-9f4a-a4bb9961fba4","email":"teacher.owner.w9.df8dd38b@tusyen.test","full_name":"W9 Owner Teacher df8dd38b","role":"teacher","phone_number":null,"date_of_birth":null,"is_active":true,"created_at":"2026-05-17T |
| PASS | Login as teacher | 200 with token for teacher.owner.w9.df8dd38b@tusyen.test | 200 {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0NWQ0OTRiYy0yMzhkLTQxMzgtOWY0YS1hNGJiOTk2MWZiYTQiLCJlbWFpbCI6InRlYWNoZXIub3duZXIudzkuZGY4ZGQzOGJAdHVzeWVuLnRlc3QiLCJyb2xlIjoidGVhY2hlciIsImp0aSI6ImVhMGVhOWQzLWUzZmItNDBlNS05ZTRmLThhYzJjYWZjZjU1Z |
| PASS | Create/reuse teacher actor | 200 created or 409 existing for teacher.newowner.w9.df8dd38b@tusyen.test | 200 {"success":true,"user":{"id":"5896c056-e421-46d5-a86e-b1fafecd9df3","email":"teacher.newowner.w9.df8dd38b@tusyen.test","full_name":"W9 Reassigned Teacher df8dd38b","role":"teacher","phone_number":null,"date_of_birth":null,"is_active":true,"created_at":"202 |
| PASS | Login as teacher | 200 with token for teacher.newowner.w9.df8dd38b@tusyen.test | 200 {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ODk2YzA1Ni1lNDIxLTQ2ZDUtYTg2ZS1iMWZhZmVjZDlkZjMiLCJlbWFpbCI6InRlYWNoZXIubmV3b3duZXIudzkuZGY4ZGQzOGJAdHVzeWVuLnRlc3QiLCJyb2xlIjoidGVhY2hlciIsImp0aSI6IjNmNjFiZWVmLWEyZmYtNDZmNS1iNDQ1LTFlZGUyN2M5Y |
| PASS | Create/reuse student actor | 200 created or 409 existing for student.primary.w9.df8dd38b@tusyen.test | 200 {"success":true,"user":{"id":"3f69f98f-d4f7-4401-85c4-a5df125b0c52","email":"student.primary.w9.df8dd38b@tusyen.test","full_name":"W9 Primary Student df8dd38b","role":"student","phone_number":null,"date_of_birth":null,"is_active":true,"created_at":"2026-05 |
| PASS | Login as student | 200 with token for student.primary.w9.df8dd38b@tusyen.test | 200 {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIzZjY5Zjk4Zi1kNGY3LTQ0MDEtODVjNC1hNWRmMTI1YjBjNTIiLCJlbWFpbCI6InN0dWRlbnQucHJpbWFyeS53OS5kZjhkZDM4YkB0dXN5ZW4udGVzdCIsInJvbGUiOiJzdHVkZW50IiwianRpIjoiZDg2Njg1OGUtNDQyNS00YTVhLWIwZTQtNzNlZmExZDhiZ |
| PASS | Create/reuse student actor | 200 created or 409 existing for student.blocked.w9.df8dd38b@tusyen.test | 200 {"success":true,"user":{"id":"93f289d2-6f19-4680-9e84-0e925614e613","email":"student.blocked.w9.df8dd38b@tusyen.test","full_name":"W9 Blocked Student df8dd38b","role":"student","phone_number":null,"date_of_birth":null,"is_active":true,"created_at":"2026-05 |
| PASS | Login as student | 200 with token for student.blocked.w9.df8dd38b@tusyen.test | 200 {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI5M2YyODlkMi02ZjE5LTQ2ODAtOWU4NC0wZTkyNTYxNGU2MTMiLCJlbWFpbCI6InN0dWRlbnQuYmxvY2tlZC53OS5kZjhkZDM4YkB0dXN5ZW4udGVzdCIsInJvbGUiOiJzdHVkZW50IiwianRpIjoiODU4OGM0NmEtMmUwOS00YTMyLWI4N2YtMGY5MGJjYjRiM |
| PASS | Teacher creates classroom with 6-character join code | 200, classroom id, uppercase 6-character joinCode | 200 id=d30f90f2-ff04-4509-a72f-56d7f7379aac joinCode=WVC8VZ |
| PASS | Wrong classroom join code rejected | 404 or 403 for wrong join code | 404 {"error":"Invalid classroom or join code"} |
| PASS | Student joins classroom with correct code | 200 success true | 200 {"success":true,"message":"Successfully joined classroom"} |
| PASS | Teacher roster reflects joined student | Roster includes primary student after join | 200 count=1 |
| PASS | Student classroom list reflects enrollment | Student /api/classroom includes newly joined classroom | 200 classrooms=1 |
| PASS | Student leaves classroom and roster updates | Leave returns success and roster no longer includes student | leave=200; roster=200; count=0 |
| PASS | Student re-joins after leaving | Rejoin returns success and roster includes student again | rejoin=200; roster=200; count=1 |
| PASS | Lesson source available for assignment | At least one active lesson in /api/learning/catalog | 200 lessonCount=6 |
| PASS | Lesson assignment appears in classroom and student learning lessons | Assignment success; lesson visible via /classroom/:id/lessons and /learning/lessons?classroomId= | assign=200; classroomLessons=200/1; studentLessons=200/1 |
| PASS | Lesson unassignment removed from classroom and student learning lessons | Unassign success; lesson absent from both classroom and student lesson lists | unassign=200; classroomLessons=200/0; studentLessons=200/0 |
| PASS | Classroom analytics returns plausible counts | 200; totalStudents=1; progress/at-risk non-negative; averageProgress 0-100; five weekday buckets | 200 {"totalStudents":1,"activeToday":0,"averageProgress":0,"progressCount":0,"atRiskCount":0,"weeklyActivity":[{"day":"Isnin","count":0},{"day":"Selasa","count":0},{"day":"Rabu","count":0},{"day":"Khamis","count":0},{"day":"Jumaat","count":0}],"weakTopics":[]} |
| PASS | Admin reassigns classroom owner teacher | 200 and teacher_id=5896c056-e421-46d5-a86e-b1fafecd9df3 | 200 teacher_id=5896c056-e421-46d5-a86e-b1fafecd9df3 |
| PASS | Reassigned teacher can access classroom details | 200 classroom details for reassigned teacher | 200 {"classroom":{"id":"d30f90f2-ff04-4509-a72f-56d7f7379aac","teacher_id":"5896c056-e421-46d5-a86e-b1fafecd9df3","name":"W9 Classroom Lifecycle df8dd38b","description":"QA classroom for w9-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e","subject":"Matematik" |
| PASS | Previous owner loses classroom management access after reassignment | 403 for previous owner after teacher_id reassignment | 403 {"error":"Access denied"} |
| PASS | Teacher disables classroom | 200 and classroom.is_active=false | 200 is_active=false |
| PASS | Disabled classroom blocks new joins | 403 Classroom is inactive | 403 {"error":"Classroom is inactive"} |
| PASS | Disabled classroom data is preserved for admin | Inactive admin search finds classroom with student_count=1 and roster still includes primary student | inactiveSearch=200/1; student_count=1; adminStudents=200/1 |

## Analytics evidence

```json
{
  "totalStudents": 1,
  "activeToday": 0,
  "averageProgress": 0,
  "progressCount": 0,
  "atRiskCount": 0,
  "weeklyActivity": [
    {
      "day": "Isnin",
      "count": 0
    },
    {
      "day": "Selasa",
      "count": 0
    },
    {
      "day": "Rabu",
      "count": 0
    },
    {
      "day": "Khamis",
      "count": 0
    },
    {
      "day": "Jumaat",
      "count": 0
    }
  ],
  "weakTopics": []
}
```

## Endpoint status trace

| Method | Path | Status |
|---|---|---|
| POST | /api/auth/login | 200 |
| POST | /api/admin/users | 200 |
| POST | /api/auth/login | 200 |
| POST | /api/admin/users | 200 |
| POST | /api/auth/login | 200 |
| POST | /api/admin/users | 200 |
| POST | /api/auth/login | 200 |
| POST | /api/admin/users | 200 |
| POST | /api/auth/login | 200 |
| POST | /api/classroom | 200 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/join | 404 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/join | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/students | 200 |
| GET | /api/classroom | 200 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/leave | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/students | 200 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/join | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/students | 200 |
| GET | /api/learning/catalog?limit=10 | 200 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/lessons | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/lessons | 200 |
| GET | /api/learning/lessons?classroomId=d30f90f2-ff04-4509-a72f-56d7f7379aac&limit=50 | 200 |
| DELETE | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/lessons/fade384d-33b1-4a77-bb1b-1d5b8f16f867 | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/lessons | 200 |
| GET | /api/learning/lessons?classroomId=d30f90f2-ff04-4509-a72f-56d7f7379aac&limit=50 | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/analytics | 200 |
| PATCH | /api/admin/classrooms/d30f90f2-ff04-4509-a72f-56d7f7379aac | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac | 200 |
| GET | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac | 403 |
| PATCH | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac | 200 |
| POST | /api/classroom/d30f90f2-ff04-4509-a72f-56d7f7379aac/join | 403 |
| GET | /api/admin/classrooms?isActive=false&search=W9%20Classroom%20Lifecycle%20df8dd38b | 200 |
| GET | /api/admin/classrooms/d30f90f2-ff04-4509-a72f-56d7f7379aac/students | 200 |

## Defects

No defects found in this API lifecycle pass.

## Residual risk

- This was API-level QA only; no browser screenshots were captured.
- The lifecycle creates persistent QA users, classroom, enrollment, and inactive classroom records under the W9 namespace for traceability.
- Lesson assignment notification delivery was not validated beyond the assignment API returning success.
- Progress-producing lesson submission was out of scope; analytics plausibility was checked for counts and shape on a newly created classroom.
