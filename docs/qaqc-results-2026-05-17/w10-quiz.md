# W10 Live Quiz QA/QC - Tusyen

- Run ID: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `w10-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Base URL: `http://localhost`
- Env snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Probe time: 2026-05-17T23:30-23:33 Asia/Singapore
- Tools used: Playwright request API, Node `ws` WebSocket client
- Files/env changed: none, except this deliverable
- Browser/headed note: not used; defects are API/WS lifecycle issues and did not require UI screenshots

## Verdict

NOT READY for W10 Live Quiz release gate.

The core live quiz lifecycle works end to end for teacher-created decks, session PIN, authenticated student join, timer controls, answer submission, late rejection, reconnect, XP award, leaderboard, and summary. Release is blocked by persisted hearts not decrementing after an accepted wrong live quiz answer. There is also a student classroom-session visibility failure and a WebSocket contract mismatch against the event names requested in this QA scope.

## Environment confirmation

From `_env-snapshot.md` and live health check:

- Docker stack was up through Caddy at `http://localhost`.
- `/api/health` returned healthy with database and Redis connected.
- Applied migrations included `002_quiz_live.sql`, `012_quiz_deck_stem_question_types.sql`, `013_quiz_timer_controls.sql`, and `014_student_hearts.sql`.
- `ALLOW_GUEST_QUIZ_JOIN` was not set in `.env`, so disabled/rejected guest join was the expected path.

## Test data created

Primary lifecycle probe:

- Teacher: `teacher.w10-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mp9xmi2q@tusyen.test`
- Student: `student.w10-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mp9xmi2q@tusyen.test`
- Classroom ID: `d05df58f-1cad-46b9-92c6-36edd830fb9c`
- Live deck ID: `3cfe76e0-e3f6-4cb3-aa2c-7abc6227f743`
- Session ID: `805b8b05-b26e-4c1e-b2b5-97e12d8c63ae`
- PIN: `934436`

Supplemental timer/hearts probe:

- Student ID: `ecfcf784-901e-44ac-9954-7250f85159c2`
- Classroom ID: `6628eea7-79a1-40d9-92d5-f6cfa2fbf216`
- Live deck ID: `0e1a96e1-af7b-44c0-901b-4a1c38c71ef7`
- Session ID: `88d21507-3630-4c82-9f4a-bf9e0b3b29e8`
- PIN: `567484`

## Coverage summary

| Area | Result | Evidence |
|---|---:|---|
| Health through Caddy | PASS | `/api/health` 200, DB/Redis connected |
| Demo admin login | PASS | `admin@tusyen.test` login 200 |
| Isolated teacher/student actors | PASS | Admin-created teacher/student both logged in |
| Classroom create/enroll | PASS | Teacher created classroom; student joined by code; `/api/classroom` included the class |
| Deck CRUD | PASS | Created, read, patched, deleted unused deck |
| Multiple-choice + true/false | PASS | Patched deck preserved `true_false` and `multiple_choice` with points/time limits |
| Live session and PIN | PASS | Session created in `lobby`; PIN matched 6 digits |
| Authenticated student join | PASS | `/api/quiz/join` 200 with participant token |
| Guest join when disabled | PASS | Anonymous join rejected 401: `Student authentication is required to join quiz sessions` |
| Student session state with participant token | PASS | `/api/quiz/sessions/:id/state?participantToken=...` 200 |
| Host start and advance | PASS | Player/host received quiz session/question WS events |
| Timer start | PASS | 30-second question had exact 30s between `questionStartedAt` and `questionEndsAt` |
| Timer pause | PASS | Pause before expiry persisted `questionPausedAt` and `questionRemainingMs: 29661` |
| Timer resume | PASS | Resume cleared `questionPausedAt` and recalculated `questionEndsAt` |
| Timer add_time | PASS | `add_time` returned updated `questionEndsAt` |
| Correct answer scoring | PASS | Correct answer returned `isCorrect: true`, `pointsAwarded: 891` |
| Late answer rejection | PASS | 1-second question submitted after delay returned 400 `Question time expired` |
| Reconnect with participant token | PASS | Reconnected socket received `AUTH_SUCCESS` and `QUIZ_STATE` for same participant |
| Host end leaderboard | PASS | End snapshot status `ended`, leaderboard contained student score |
| XP on end | PASS | `xpAwards` included student with amount `891` in supplemental run |
| Student quiz summary | PASS | `/api/quiz/me/summary` returned `quizXpTotal` and recent ended session |
| Student classroom quiz session list | FAIL | Enrolled student GET returned 500 `Only teachers can view quiz sessions` |
| Hearts decrement wrong answer | FAIL | Accepted wrong answer left hearts `5 -> 5` |
| WS exact event contract | WARN/FAIL | Semantic events observed, but requested exact names were not emitted and no answer-submitted event exists |

## WebSocket evidence

Observed host event types:

```text
CONNECTED
AUTH_SUCCESS
QUIZ_STATE
QUIZ_PARTICIPANT_JOINED
QUIZ_SESSION_STARTED
QUIZ_TIMER_UPDATED
QUIZ_LEADERBOARD_UPDATED
QUIZ_QUESTION_STARTED
QUIZ_SESSION_ENDED
```

Observed player event types:

```text
CONNECTED
AUTH_SUCCESS
QUIZ_STATE
QUIZ_SESSION_STARTED
QUIZ_TIMER_UPDATED
QUIZ_LEADERBOARD_UPDATED
QUIZ_QUESTION_STARTED
QUIZ_SESSION_ENDED
```

Requested event names vs actual:

| Requested | Observed equivalent |
|---|---|
| `CONNECTED` | `CONNECTED` |
| `AUTH_SUCCESS` | `AUTH_SUCCESS` |
| `PLAYER_JOINED` | `QUIZ_PARTICIPANT_JOINED` |
| `QUESTION_STARTED` | `QUIZ_SESSION_STARTED`, `QUIZ_QUESTION_STARTED` |
| `ANSWER_SUBMITTED` | Not observed |
| `LEADERBOARD_UPDATE` | `QUIZ_LEADERBOARD_UPDATED` |
| `SESSION_ENDED` | `QUIZ_SESSION_ENDED` |

## Defects

### 1. Student cannot list classroom quiz sessions despite enrollment

- Role/Screen: Student / Classroom live quiz session discovery
- Severity: High
- Repro: Create a classroom as teacher, enroll a student, create a quiz session for that classroom, then call `GET /api/quiz/classrooms/:classroomId/sessions` with the enrolled student token.
- Expected: Enrolled student can see active classroom quiz sessions, or receives a controlled 403 if this endpoint is intentionally teacher-only.
- Actual: API returned 500 with body `{ "statusCode": 500, "error": "Internal Server Error", "message": "Only teachers can view quiz sessions" }`.
- Suspected file: `backend/src/quiz/routes.ts` and `backend/src/quiz/store.ts`
- Screenshot: Not captured; API evidence only.

### 2. Accepted wrong live quiz answer does not decrement persisted hearts

- Role/Screen: Student / Live Quiz accepted wrong answer and hearts
- Severity: High
- Repro: Join a live quiz as an authenticated student, answer a true/false question incorrectly before expiry, then compare `GET /api/progress/student/:studentId/hearts` before and after.
- Expected: Accepted wrong live quiz answer decrements persisted `current` hearts by 1.
- Actual: Wrong answer was accepted as incorrect with `pointsAwarded: 0`, but hearts stayed `5 -> 5`.
- Suspected file: `backend/src/quiz/store.ts` or `backend/src/quiz/routes.ts`; `backend/src/progress/routes.ts` appears to only read/create `student_hearts`.
- Screenshot: Not captured; API evidence only.

Supplemental evidence:

```json
{
  "before": { "current": 5, "max": 5 },
  "answer2": { "status": 200, "isCorrect": false, "pointsAwarded": 0 },
  "after": { "current": 5, "max": 5 }
}
```

### 3. WebSocket event contract does not match requested names and has no answer-submitted event

- Role/Screen: Host/Student / Live Quiz WebSocket contract
- Severity: Medium
- Repro: Observe `/ws/quiz/:sessionId` while a student joins, host starts/advances, student answers, leaderboard updates, and host ends.
- Expected: Requested event names observed exactly: `CONNECTED`, `AUTH_SUCCESS`, `PLAYER_JOINED`, `QUESTION_STARTED`, `ANSWER_SUBMITTED`, `LEADERBOARD_UPDATE`, `SESSION_ENDED`.
- Actual: Actual emitted names are `CONNECTED`, `AUTH_SUCCESS`, `QUIZ_STATE`, `QUIZ_PARTICIPANT_JOINED`, `QUIZ_SESSION_STARTED`, `QUIZ_TIMER_UPDATED`, `QUIZ_LEADERBOARD_UPDATED`, `QUIZ_QUESTION_STARTED`, `QUIZ_SESSION_ENDED`. No `ANSWER_SUBMITTED` or `QUIZ_ANSWER_SUBMITTED` event was emitted; answer submission only triggered `QUIZ_LEADERBOARD_UPDATED`.
- Suspected file: `backend/src/quiz/routes.ts` and `backend/src/quiz/realtime.ts`
- Screenshot: Not captured; WS message log above.

## Residual risk

- Guest-allowed join path was not tested because `ALLOW_GUEST_QUIZ_JOIN` was disabled and no production `.env` changes were allowed.
- No Browser/headed UI screenshots were captured; this pass focused on API and WS lifecycle correctness.
- The probes created QA users/classes/decks/sessions and did not clean live session decks to avoid touching unrelated state or triggering FK issues on session-linked quiz questions.
