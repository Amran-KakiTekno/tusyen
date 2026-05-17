# L1 Student Learning Flow QA/QC

- Run id: `qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Namespace: `l1-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e`
- Repo: `D:\2026\tusyen`
- Env snapshot: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md`
- Base URL tested: `http://localhost`
- Role: Student demo account, `student@tusyen.test`
- Date: 2026-05-17
- Screenshots: `D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student-flow\`
- Scope: Browser-led flow logic QA, with no commits and no env edits.

## Tooling note

Browser plugin was used first for the live app login, Home, Learn, History subject/topic, and empty lesson checks. Browser screenshot and later CDP calls timed out, so screenshot capture and continuation were performed with a one-off Playwright Chromium run against the same `http://localhost` stack. Console errors/warnings were checked during the Playwright runs; none were observed.

## Summary verdict

Status: Failed L1 gate due to blocking and high-value learning-flow defects.

The student can log in, reach Home, open Learn, switch subjects, open a Math lesson, review a content gate, start a 5-question exercise, answer question by question, submit, see a score, retry, and return to Learn.

The gate fails because Learn -> History -> current topic opens an empty lesson, prior attempts/best score are not shown before start, and the post-submit result review does not show required per-question correctness, correct answers, explanations, or all submitted questions.

## Flow checklist

| Check | Result | Evidence |
| --- | --- | --- |
| Login as student demo | Pass | `01-home-dashboard.png` |
| Home dashboard renders with progress after auth settles | Pass | `16-home-continue-card.png`, `12-home-after-submit.png` |
| Home continue/resume opens the next lesson | Pass | `16-home-continue-card.png`, `17-home-continue-target.png` |
| Learn opens from Home/sidebar | Pass | `02-learn-entry.png` |
| Pick subject | Pass | `03-history-topic-list.png`, `05-math-topic-list.png` |
| Pick History current topic from Learn | Fail | `04-history-empty-lesson.png` |
| Review content blocks before exercise | Partial | `06-content-review-before-start.png` |
| Content review unlock gate renders/unlocks | Pass | `06-content-review-before-start.png`, `07-exercise-question-1.png` |
| Previous attempts and best score shown before start | Fail | `06-content-review-before-start.png` |
| Exercise modal shows progress | Pass, data is 5 questions | `09-exercise-question-3.png` |
| Exercise modal shows remaining hearts | Pass | `09-exercise-question-3.png` |
| Exercise modal shows time spent | Fail | `09-exercise-question-3.png` |
| Submit shows score | Pass | `11-result-summary.png` |
| Result shows per-question correctness, selected answer, correct answer, explanation | Fail, baseline known defect confirmed | `11-result-summary.png` |
| Retry creates a fresh attempt and is not stale | Pass | `14-retry-new-attempt.png` |
| Return to Learn after submit | Pass through global Learning nav | `13-return-to-learn-after-submit.png` |
| Streak first lesson vs second | Partial | Streak stayed at 1 after repeated scored attempts; second distinct scored lesson could not be validated because other visible candidate lessons were empty or had 0 questions. |

## Walk performed

1. Logged in through the student demo account.
2. Waited for the authenticated Home dashboard to settle.
3. Confirmed Home progress and continue card.
4. Clicked Home continue card.
5. Confirmed it opened `Perkembangan Nasionalisme di Tanah Melayu` content review with 2 questions.
6. Navigated to Learn.
7. Picked History.
8. Clicked `Mula topik semasa` for `Nasionalisme di Tanah Melayu`.
9. Confirmed this Learn path opens an empty lesson state instead of content/exercise.
10. Returned to Learn and picked Mathematics.
11. Opened `Kecerunan dan Pintasan Graf Linear`.
12. Confirmed review gate and start button.
13. Started exercise after waiting for timer readiness.
14. Answered questions 1 through 5 using the first available option on each question.
15. Submitted via `Lihat Keputusan`.
16. Reviewed result summary.
17. Returned Home and then Learn.
18. Repeated a scored attempt and clicked `Cuba Semula dari Awal`.
19. Confirmed retry resets to content review and then starts a fresh question 1 state.
20. Checked Biology as a second-lesson candidate and found `Mitosis dalam Sel` has 0 questions.

## Findings

### L1-STU-001 - Learn History current topic opens empty lesson instead of content

- Role/Screen: Student / Learn -> History -> current topic
- Severity: High
- Repro: Login as student demo, open Learning, select History, click `Mula topik semasa`.
- Expected: Topic opens the matching lesson content blocks and allows the student to start the exercise.
- Actual: The screen opens `Sejarah - Nasionalisme di Tanah Melayu` with `Belum ada pelajaran tersedia` and only `Cari Pelajaran`.
- Suspected file: `web_app/components/student.jsx`, likely selected topic to selected lesson mapping near the Learn/Lesson handoff. Also check `backend/src/learning/routes.ts` catalog/topic payload.
- Screenshot: `screenshots/student-flow/04-history-empty-lesson.png`

Notes: Home continue is able to open `Perkembangan Nasionalisme di Tanah Melayu` content review, so the issue appears specific to the Learn subject/topic picker path rather than all History content.

### L1-STU-002 - Previous attempts and best score are missing before starting

- Role/Screen: Student / Lesson content review
- Severity: Medium
- Repro: Complete or retry the Math lesson, return to `Kecerunan dan Pintasan Graf Linear`, and inspect the pre-start content review.
- Expected: Before starting, the lesson shows previous attempt count and best score.
- Actual: The screen only shows title, topic, estimated time, question count, summary, and `Saya sudah baca, mula latihan`.
- Suspected file: `web_app/components/student.jsx`, content review component state. Backend has progress/attempt fields in `backend/src/learning/routes.ts`, so verify whether they are returned to the lesson detail payload.
- Screenshot: `screenshots/student-flow/06-content-review-before-start.png`

### L1-STU-003 - Exercise modal lacks elapsed time spent

- Role/Screen: Student / Exercise modal
- Severity: Medium
- Repro: Open Math lesson, start exercise, advance to question 3.
- Expected: Modal shows progress, remaining hearts, and time spent.
- Actual: Progress is shown as `Questions 3 / 5`, hearts are shown, but the timer is a countdown value such as `44s`; elapsed time spent is not shown.
- Suspected file: `web_app/components/student.jsx`, exercise timer/header rendering around the question modal.
- Screenshot: `screenshots/student-flow/09-exercise-question-3.png`

Notes: The denominator is 5 because this lesson has 5 published questions. That is data-consistent, but the elapsed time-spent requirement is not met.

### L1-STU-004 - Result summary omits required per-question review details

- Role/Screen: Student / Post-submit result
- Severity: High
- Repro: Complete all 5 Math exercise questions and click `Lihat Keputusan`.
- Expected: Result shows per-question correctness, user's selected answer, correct answer, and explanation when present.
- Actual: Result shows score `2/5`, accuracy `40%`, hearts, and `Semakan ringkas`, but each row only shows a generic status and `Jawapan anda`. It does not show correct answers or explanations. It also lists only Questions 1 to 4 despite a 5-question attempt.
- Suspected file: `web_app/components/student.jsx`, result rendering around `Semakan ringkas` and result answer mapping. Also check `backend/src/learning/routes.ts` submit response shape for selected/correct/explanation fields.
- Screenshot: `screenshots/student-flow/11-result-summary.png`

Notes: Baseline known defect confirmed if the expected detailed review is not implemented elsewhere. This is the biggest learner-feedback gap in the tested flow.

### L1-STU-005 - Biology Learn page leaks Math weak/completed topic data

- Role/Screen: Student / Learn -> Biology
- Severity: Medium
- Repro: Open Learning, select Biology.
- Expected: Biology subject page shows Biology-specific weak topics, completed topics, and lesson recommendations.
- Actual: Biology page shows `Mitosis dalam Sel`, but the weak topic and completed lesson area also show Math content: `Fungsi Linear` and `Kecerunan Dan Pintasan Y`.
- Suspected file: `web_app/components/student.jsx`, subject filtering for weak/completed topics. Also check progress aggregation in `backend/src/progress/routes.ts`.
- Screenshot: `screenshots/student-flow/15-biology-topic-list.png`

Notes: This blocked a clean second scored lesson/streak validation because Biology's visible Biology lesson had `0 soalan`.

## Passing observations

- Student demo login works.
- Home dashboard eventually loads correct student progress after authentication settles.
- Home continue card is clickable and resumes to a content review page.
- Math content gate renders and unlocks exercise after `Saya sudah baca, mula latihan`.
- Math exercise can be answered question by question.
- The exercise preserves hearts through the tested path and records selected answers.
- Submit produces a result score and XP delta.
- Retry does not show stale result state. It resets to content review, and starting again opens a fresh `Questions 1 / 5` exercise state.
- Returning to Learn after submit works through the global Learning navigation.
- No relevant browser console errors or warnings were observed in the Playwright continuation runs.

## Screenshots captured

- `screenshots/student-flow/01-home-dashboard.png` - Home immediately after student login during an early run.
- `screenshots/student-flow/02-learn-entry.png` - Learn entry on Mathematics.
- `screenshots/student-flow/03-history-topic-list.png` - History subject topic list.
- `screenshots/student-flow/04-history-empty-lesson.png` - History Learn path empty lesson defect.
- `screenshots/student-flow/05-math-topic-list.png` - Math subject topic list.
- `screenshots/student-flow/06-content-review-before-start.png` - Math content review before start.
- `screenshots/student-flow/07-exercise-question-1.png` - Exercise question 1.
- `screenshots/student-flow/08-exercise-after-q1-answer.png` - Question 1 after answer recorded.
- `screenshots/student-flow/09-exercise-question-3.png` - Exercise question 3 state.
- `screenshots/student-flow/10-exercise-question-3-answered.png` - Question 3 after answer recorded.
- `screenshots/student-flow/11-result-summary.png` - Result summary defect evidence.
- `screenshots/student-flow/12-home-after-submit.png` - Home after returning from submit.
- `screenshots/student-flow/13-return-to-learn-after-submit.png` - Learn after submit.
- `screenshots/student-flow/14-retry-new-attempt.png` - Retry starts a fresh question 1.
- `screenshots/student-flow/15-biology-topic-list.png` - Biology page with leaked Math topic data.
- `screenshots/student-flow/16-home-continue-card.png` - Settled Home continue card.
- `screenshots/student-flow/17-home-continue-target.png` - Home continue target content review.

## Residual risks

- This was browser-flow QA, not a backend API test suite.
- The second distinct scored lesson/streak behavior could not be fully validated because the visible non-Math candidates were either empty from Learn or had no published questions.
- Browser plugin was used first, but screenshot capture required Playwright continuation because the Browser runtime timed out on screenshot and later CDP operations.
- No source code was modified, and no commits were made.
