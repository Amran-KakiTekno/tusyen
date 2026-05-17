# L2 Quiz Live Flow Logic QA/QC

- Workstream: L2 Quiz Live Flow Logic
- Run ID: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `l2-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Base URL: `http://localhost`
- Env snapshot: `docs/qaqc-results-2026-05-17/_env-snapshot.md`
- Status: **NOT READY**
- Files/env changed: this deliverable and screenshots only. No commits and no env edits.

## Tooling note

Browser plugin was used first against `http://localhost` and confirmed the real Caddy-served app rendered with no teacher Quiz-tab console errors. The in-app Browser could not provide isolated teacher/student cookie contexts, and alternate loopback hostnames (`127.0.0.1`, `l2.localhost`) were blocked by the Browser environment, so the simultaneous two-role flow used Playwright isolated contexts after the Browser-first pass.

## Test data

- Teacher: `teacher.l2stage-mp9ytpeo@tusyen.test`
- Student: `student.l2stage-mp9ytpeo@tusyen.test`
- Classroom: `L2 Quiz Live 9YTPEO`
- Classroom ID: `92f16520-b1b8-4e6c-95fe-38f7baa77ba9`
- Deck: `L2 Flow Deck 9YTPEO` (UI display truncates to `L2 Flow Deck`)
- Deck ID: `3361b62d-4f95-4adc-b5ad-b10c7a4d20d7`
- Session ID: `f5a69ccc-dc62-4cfe-9744-d6b461173feb`
- PIN: `857096`
- Participant token: `87352f04-b464-49de-9be2-5a0010be319d`

## Verdict

The core live quiz flow works end to end for deck creation, authenticated student PIN join, lobby update, question start, timer sync, answer feedback, teacher advance, time-up late rejection, session end, XP award, and history/home XP visibility.

Release is blocked by four L2 issues:

- PIN copy has no discoverable copy confirmation/control on the teacher lobby.
- Accepted wrong live quiz answers still do not deduct persisted hearts.
- The baseline known student summary defect is confirmed: final review lists correctness per question, but not the student's answer and correct answer.
- Rejoining a finished session shows the ended-session error instead of cleanly opening the previous summary.

## Flow coverage

| Area | Result | Evidence |
|---|---:|---|
| Browser-first app identity | PASS | Browser opened `http://localhost`, title `Tusyen - EduApp Malaysia`, teacher Quiz tab rendered, no console errors. |
| Teacher Quiz tab | PASS | `browser-teacher-quiz-tab.png`, `01-teacher-quiz-class-selected.png` |
| Teacher create deck | PASS | UI-created 3-question deck with timers 20s, 20s, 5s. API confirmed deck ID `3361b62d-4f95-4adc-b5ad-b10c7a4d20d7`. |
| Add questions | PASS | `02-teacher-deck-form-filled.png` shows all 3 questions and answer options. |
| Start session and PIN display | PASS | Session entered lobby with PIN `857096`; `04-teacher-lobby-pin.png`. |
| PIN copy confirmation | FAIL | No discoverable Copy PIN/Salin PIN control or confirmation was found on the teacher lobby. |
| Student join by PIN | PASS | Authenticated student entered PIN and joined; `07-student-lobby-after-pin.png`. |
| Lobby live player list | PASS | Teacher lobby updated after join; `08-teacher-lobby-player-list.png`. |
| Teacher starts quiz | PASS | Teacher start moved the session into Q1; `09-teacher-question1-live.png`. |
| Student sees question | PASS | Student saw Q1; `10-student-question1-live.png`. |
| Timer sync | PASS | Teacher and student both sampled `18s` remaining on Q1. |
| Answer within timer and feedback | PASS | Student answered Q1 correctly and received feedback; `11-student-q1-feedback.png`. |
| Teacher advance moves player | PASS | Teacher advance moved student to Q2; `12-student-question2-after-advance.png`. |
| Wrong answer accepted | PASS | Student answered Q2 incorrectly and received wrong-answer feedback; `13-student-q2-wrong-feedback.png`. |
| Time up auto-lock / late submissions | PASS | Q3 timed out; late API submission returned `400 { "error": "Question time expired" }`; `15-student-question3-timeup.png`. |
| End session leaderboard | PASS | Final result showed one participant ranked 1 with `906 XP`; `16-teacher-final-leaderboard.png`, `17-student-final-leaderboard-summary.png`. |
| XP delta visible | PASS | Final student result and history showed `+906 XP`; home still showed XP total. |
| Hearts deducted | FAIL | Hearts stayed `5 -> 5` after an accepted wrong Q2 answer. |
| Student post-game per-question summary | FAIL | Summary lists per-question accuracy, but not student's selected answer and correct answer. |
| Quiz history score | PASS | `/api/quiz/me/summary` and UI history showed the ended session and `+906 XP`. |
| XP appears on home | PASS | `20-student-home-xp-after-quiz.png`. |
| Rejoin finished session | FAIL | Re-entering PIN `857096` showed `Kuiz ini telah tamat...` instead of clean summary-only behavior. |
| Console health | WARN | Student browser logged one expected 400 after finished-session rejoin attempt; tied to rejoin defect. |

## Defects

### 1. PIN copy confirmation/control is missing from teacher lobby

- Role/Screen: Teacher / Live quiz lobby PIN
- Severity: Medium
- Repro: Teacher opens Quiz, starts deck `L2 Flow Deck 9YTPEO`, reaches lobby for PIN `857096`, then attempts to copy the displayed PIN.
- Expected: A visible Copy PIN/Salin PIN control copies the 6-digit PIN and shows confirmation.
- Actual: No discoverable copy control or confirmation was found on the lobby screen.
- Suspected file: `web_app/components/quiz.jsx`
- Screenshot: `docs/qaqc-results-2026-05-17/screenshots/quiz-flow/04-teacher-lobby-pin.png`

### 2. Wrong live quiz answer does not deduct persisted hearts

- Role/Screen: Student / Live quiz wrong-answer feedback and hearts
- Severity: High
- Repro: Student joins live session `f5a69ccc-dc62-4cfe-9744-d6b461173feb`, answers Q2 incorrectly within timer (`Ipoh L2`), then compare hearts before/after through `/api/progress/student/:studentId/hearts`.
- Expected: Persisted hearts decrease by 1 after an accepted wrong answer, e.g. `5 -> 4`.
- Actual: Hearts stayed `5 -> 5`.
- Suspected file: `backend/src/quiz/store.ts` or `backend/src/quiz/routes.ts`
- Screenshot: `docs/qaqc-results-2026-05-17/screenshots/quiz-flow/13-student-q2-wrong-feedback.png`

### 3. Baseline known defect confirmed: student summary omits selected/correct answers

- Role/Screen: Student / Final live quiz summary and history review
- Severity: Major
- Repro: Complete the live quiz with one correct answer, one wrong answer, and one timed-out question, then inspect the student final summary.
- Expected: Each question row lists the question, the student's answer, and the correct answer.
- Actual: Summary shows per-question accuracy only:
  - `Q1: 100%, 1/1 betul`
  - `Q2: 0%, 0/1 betul`
  - `Q3: 0%, 0/0 betul - 1 tidak menjawab`
  It does not show `Four L2`, `Ipoh L2`, `Kuala Lumpur L2`, or `Fifteen L2` as answer/correct-answer review details.
- Suspected file: `web_app/components/quiz.jsx` and/or `web_app/components/student.jsx`
- Screenshot: `docs/qaqc-results-2026-05-17/screenshots/quiz-flow/17-student-final-leaderboard-summary.png`

### 4. Rejoining a finished session shows ended-session error instead of clean summary

- Role/Screen: Student / Rejoin finished quiz by PIN
- Severity: Medium
- Repro: After session `f5a69ccc-dc62-4cfe-9744-d6b461173feb` ends, return to Quiz, enter PIN `857096`, and click join again.
- Expected: Student sees the previous completed summary/history for their attempt without a join error.
- Actual: UI shows the recent session and `+906 XP`, but the join panel also shows `Kuiz ini telah tamat. Minta PIN sesi baharu daripada guru.` and browser console logs a 400.
- Suspected file: `web_app/components/quiz.jsx` or `backend/src/quiz/routes.ts`
- Screenshot: `docs/qaqc-results-2026-05-17/screenshots/quiz-flow/19-student-rejoin-finished-session.png`

## Screenshot inventory

- `screenshots/quiz-flow/browser-teacher-quiz-tab.png`
- `screenshots/quiz-flow/browser-teacher-new-deck-form.png`
- `screenshots/quiz-flow/01-teacher-quiz-class-selected.png`
- `screenshots/quiz-flow/02-teacher-deck-form-filled.png`
- `screenshots/quiz-flow/03-teacher-deck-created.png`
- `screenshots/quiz-flow/04-teacher-lobby-pin.png`
- `screenshots/quiz-flow/05-teacher-lobby-before-student.png`
- `screenshots/quiz-flow/06-student-history-before-join.png`
- `screenshots/quiz-flow/07-student-lobby-after-pin.png`
- `screenshots/quiz-flow/08-teacher-lobby-player-list.png`
- `screenshots/quiz-flow/09-teacher-question1-live.png`
- `screenshots/quiz-flow/10-student-question1-live.png`
- `screenshots/quiz-flow/11-student-q1-feedback.png`
- `screenshots/quiz-flow/12-student-question2-after-advance.png`
- `screenshots/quiz-flow/13-student-q2-wrong-feedback.png`
- `screenshots/quiz-flow/14-student-question3-before-timeup.png`
- `screenshots/quiz-flow/15-student-question3-timeup.png`
- `screenshots/quiz-flow/16-teacher-final-leaderboard.png`
- `screenshots/quiz-flow/17-student-final-leaderboard-summary.png`
- `screenshots/quiz-flow/18-student-quiz-history-after-game.png`
- `screenshots/quiz-flow/19-student-rejoin-finished-session.png`
- `screenshots/quiz-flow/20-student-home-xp-after-quiz.png`

## Residual risk

- Guest join was not tested because the env snapshot showed `ALLOW_GUEST_QUIZ_JOIN` unset/disabled and no env edits were allowed.
- Browser plugin was used first, but simultaneous two-role execution required Playwright isolated contexts because the in-app Browser session shares cookies and blocked alternate loopback hostnames.
- QA data was intentionally left in place to avoid destructive cleanup of shared state.
