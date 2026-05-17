# W14 React Student UI QA/QC

Run id: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e  
Namespace: w14-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e  
Repo: D:\2026\tusyen  
Base URL: http://localhost  
Date: 2026-05-17  
Role: Student  
Result: FAIL, due to high-severity student action and realtime defects.

The flow under test is: http://localhost -> student login -> required student screens and primary CTAs -> expected rendered response without console errors, unexpected server alerts, or mobile layout regressions.

## Tooling and environment

| Item | Result |
|---|---|
| Env snapshot | Read D:\2026\tusyen\docs\qaqc-results-2026-05-17\_env-snapshot.md |
| Full app URL | http://localhost |
| Browser plugin | Used first for desktop browser-driven testing and screenshots |
| Browser fallback | Mobile Browser screenshot capture failed with `Timed out running CDP command "Page.captureScreenshot"`; mobile and multi-window checks used regular Playwright fallback |
| Desktop viewport | 1366x900 |
| Mobile viewport | 375x812 |
| Auth user | student@tusyen.test / password123 |
| Teacher window | teacher@tusyen.test / password123 |
| Env edits | None |
| Commits | None |

## Coverage summary

| Area | Status | Evidence |
|---|---|---|
| Home dashboard | PASS | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\01-home-dashboard.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\01-home-dashboard-mobile.png |
| Learn subject/topic/content | PASS with downstream exercise failures | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\02-learning-subjects.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\03-learning-topic-content.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\04-lesson-content.png |
| Lesson exercise modal | FAIL | Q1-Q4 screenshots captured; see DEF-01 and DEF-02 |
| Classrooms list | PASS | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\11-classrooms-list.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\03-classrooms-mobile.png |
| Join-by-code | PASS | Teacher-created class `W14 Join Df8dd38b 88pq`, code `BKTA1R`, joined successfully |
| Classroom detail/posts | PASS with discussion defect | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\12-classroom-detail-posts.png |
| Posts like/comment/media | PARTIAL | Media cards rendered; comment submit worked; discussion panel showed server error |
| Quiz history + PIN join | FAIL | PIN form rendered; join action rejected student auth |
| Profile | PASS | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\17-profile.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\06-profile-mobile.png |
| Progress | PASS | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\18-progress.png, D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\07-progress-mobile.png |
| Realtime teacher post -> student feed | FAIL | Teacher post appeared after reload, but not in already-open student feed |
| PWA icon if HTTPS | N/A for HTTPS, PASS over active HTTP origin | `https://localhost` closed connection; `http://localhost/manifest.json` returned 200 with 3 icons and `icons/icon-192.png` returned 200 |
| Mobile top bar + bottom nav | PASS | Present on all checked mobile screens |
| Mobile horizontal scroll | PASS | 375px viewport had scrollWidth 375 and overflowAmount 0 on Home, Learning, Classrooms, Posts, Quiz, Profile, Progress |
| Console health | PASS for tested pages | Browser/Playwright console errors were empty during captured passes |
| Unexpected server/UI errors | FAIL | Exercise, discussion, and quiz showed user-visible server/auth errors |

## Exercise question type evidence

| Modal step | Observed type/content | Screenshot |
|---|---|---|
| Q1 | Multiple choice, 4 answers | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\05-exercise-modal-q1.png |
| Q2 | True/false style, 2 answers | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\07-exercise-modal-q2.png |
| Q3 | Matching-style prompt with answer choices | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\08-exercise-modal-q3.png |
| Q4 | Scenario prompt, but options render as only A/B/C/D | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\09-exercise-modal-q4.png |
| Result | Completion page rendered, but student submission was rejected | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\10-exercise-result.png |

## Join-by-code evidence

| Step | Result | Screenshot |
|---|---|---|
| Teacher created class | `W14 Join Df8dd38b 88pq`, code `BKTA1R` | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\24-join-code-teacher-class-created.png |
| Student entered code | Join form accepted code | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\25-join-code-filled.png |
| Student joined class | New class appeared in Classrooms | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\26-join-code-success.png |

## Realtime evidence

| Step | Result | Screenshot |
|---|---|---|
| Student feed before teacher post | Feed open for `Tingkatan 4 Matematik Fokus` | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\19-realtime-student-before.png |
| Teacher composing post | Second window used teacher UI | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\20-realtime-teacher-composer.png |
| Teacher post created | Post title `W14 realtime df8dd38b y6q98` visible in teacher feed | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\21-realtime-teacher-post-created.png |
| Student feed without reload | Post did not appear within 12 seconds | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-realtime-student-feed-not-updated.png |
| Student feed after reload | Same post appeared, confirming permission/feed visibility | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\23-realtime-student-after-reload-visible.png |

## Defects

### DEF-01

Role/Screen: Student / Learn lesson exercise modal  
Severity: High  
Repro: Login as `student@tusyen.test`, open Learning -> Biologi -> Mula topik semasa -> Saya sudah baca, mula latihan; answer through question 4.  
Expected: Question 4 answer buttons contain meaningful answer text for each A/B/C/D option.  
Actual: Question 4 answer buttons render only the option letters A, B, C, D.  
Suspected file: web_app/components/student.jsx  
Screenshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-exercise-q4-empty-options.png

### DEF-02

Role/Screen: Student / Learn lesson exercise result  
Severity: High  
Repro: Login as `student@tusyen.test`, open Learning -> Biologi lesson, answer all four modal questions, click Lihat Keputusan.  
Expected: Student exercise submission succeeds, correct answers are scored, and no role rejection appears.  
Actual: Result screen shows `Only students can submit exercises` while the sidebar role is student, and the score remains 0/4.  
Suspected file: backend/src/progress/routes.ts or web_app/components/student.jsx  
Screenshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-exercise-submit-student-rejected.png

### DEF-03

Role/Screen: Student / Posts discussion  
Severity: High  
Repro: Login as student, open Classrooms -> Lihat pos, click a post discussion CTA such as Lihat perbincangan.  
Expected: Discussion panel opens with comments and no server error; comment form can submit normally.  
Actual: Discussion panel displays alert `Internal Server Error` while comments are expanded. A comment could still be submitted afterward, but the error remains visible.  
Suspected file: backend/src/classroom/routes.ts or web_app/components/student.jsx  
Screenshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-post-discussion-internal-server-error.png

### DEF-04

Role/Screen: Student / Quiz PIN join  
Severity: High  
Repro: Login as student, open Quiz, enter `000000` in PIN kuiz 6 digit, click Sertai kuiz.  
Expected: Student receives a normal invalid/expired PIN message or joins a valid session; the app recognizes the logged-in student.  
Actual: The screen displays `Student authentication is required to join quiz sessions` while the sidebar role is student.  
Suspected file: backend/src/quiz/routes.ts or web_app/components/quiz.jsx  
Screenshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-quiz-pin-student-auth-required.png

### DEF-05

Role/Screen: Student / Posts realtime feed  
Severity: High  
Repro: Open student Posts feed for `Tingkatan 4 Matematik Fokus`; in a second teacher window create post `W14 realtime df8dd38b y6q98`; wait 12 seconds without reloading the student page.  
Expected: The new teacher post appears automatically in the open student feed.  
Actual: The post does not appear until the student feed is reloaded. After reload, the same post is visible, confirming this is a realtime delivery/update issue rather than a permission issue.  
Suspected file: web_app/components/student.jsx or backend/src/sync/routes.ts or backend/src/websocket/handlers.ts  
Screenshot: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop\defect-realtime-student-feed-not-updated.png

## Mobile checks

| Screen | Top bar | Bottom nav | Horizontal overflow | Screenshot |
|---|---:|---:|---:|---|
| Home | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\01-home-dashboard-mobile.png |
| Learning | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\02-learning-mobile.png |
| Classrooms | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\03-classrooms-mobile.png |
| Posts | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\04-posts-mobile.png |
| Quiz | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\05-quiz-mobile.png |
| Profile | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\06-profile-mobile.png |
| Progress | PASS | PASS | 0px | D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile\07-progress-mobile.png |

## Screenshot inventory

Desktop directory: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\desktop  
Mobile directory: D:\2026\tusyen\docs\qaqc-results-2026-05-17\screenshots\student\mobile

Key desktop screenshots:

| File | Purpose |
|---|---|
| 01-home-dashboard.png | Home dashboard happy path |
| 02-learning-subjects.png | Learning subject list |
| 03-learning-topic-content.png | Learning topic/content entry |
| 04-lesson-content.png | Lesson content before exercise |
| 05-exercise-modal-q1.png | Exercise Q1 |
| 07-exercise-modal-q2.png | Exercise Q2 |
| 08-exercise-modal-q3.png | Exercise Q3 |
| 09-exercise-modal-q4.png | Exercise Q4 defect source |
| 10-exercise-result.png | Exercise result defect source |
| 11-classrooms-list.png | Classrooms list and join form |
| 12-classroom-detail-posts.png | Classroom posts/media |
| 13-posts-like-comment-media.png | Posts discussion error source |
| 14-post-comment-attempt.png | Comment submission evidence |
| 15-quiz-history-pin.png | Quiz history/PIN screen |
| 16-quiz-pin-join-attempt.png | Quiz PIN auth defect source |
| 17-profile.png | Profile happy path |
| 18-progress.png | Progress happy path |
| 19-realtime-student-before.png | Realtime student before state |
| 21-realtime-teacher-post-created.png | Teacher post created |
| 23-realtime-student-after-reload-visible.png | Realtime post visible only after reload |
| 26-join-code-success.png | Join-code success |

## Residual risk

This was a browser-driven bug hunt against the running local stack, not a full automated regression run. I did not edit app code, environment files, or commits. Browser desktop evidence came from the Browser plugin. Mobile screenshots and multi-window realtime checks used Playwright because Browser mobile screenshot capture timed out.
