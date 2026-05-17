# W16 React Parent UI desktop + mobile QA/QC

- Workstream: W16 React Parent UI
- Run ID: qaqc-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Namespace: w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e
- Repo: D:\2026\tusyen
- Env snapshot: docs/qaqc-results-2026-05-17/_env-snapshot.md
- Base URL: http://localhost
- Role: Parent demo, parent@tusyen.test
- Demo child UUID used: 8d9cee43-012e-4f65-bca8-26f749f504b5
- Status: FAIL, parent post reaction and teacher-profile-from-post requirements did not pass.

## Tooling notes

Browser plugin was used first for the parent desktop bug hunt, DOM snapshots, console checks, interactions, and desktop screenshots. Browser screenshot capture timed out repeatedly at the 375px viewport, so mobile screenshot files were captured with Playwright fallback after Browser had already been attempted. The Browser viewport override was reset after the run.

## Scope covered

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Home linked child | Covered | Covered |
| Link child by UUID | Covered | Covered |
| Children list | Covered | Covered |
| Child progress drill-down | Covered | Covered |
| Posts from linked child classrooms | Covered | Covered |
| Like/comment on linked child classroom post | Covered | Partial, screenshot evidence only |
| Teacher profile from post | Failed | Failed |

## Findings

### 1. Role/Screen

Parent / Class Posts / Reaction button

Severity: P1

Repro: Login as parent, open `Pos Kelas / Class Posts`, click the assignment post reaction button `Tandai sudah baca 0`, wait, then click again and wait for the reacted/count state.

Expected: Reaction mirrors the student post interaction pattern: button should visibly change to reacted state and increment the count.

Actual: The button remained `Tandai sudah baca 0` with an unreacted heart after two clicks and a 7 second wait. The comment path on the same post worked and immediately increased `Maklum balas (1)` to `Maklum balas (2)`.

Suspected file: web_app/components/parent.jsx, backend/src/feed/routes.ts

Screenshot: docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-10-post-reaction-retry.png

### 2. Role/Screen

Parent / Class Posts / Teacher profile from post

Severity: P1

Repro: Login as parent, open `Pos Kelas / Class Posts`, attempt to open the teacher profile from the visible post author/teacher label.

Expected: Parent can open Cikgu Farah Aziz's teacher profile from a class post.

Actual: Desktop exposes only a generic `Pengumuman Teacher` label. Clicking it did not open a modal. Mobile exposes `PENGUMUMAN GURU` but no teacher-name button/link. The teacher profile modal did not appear in either viewport.

Suspected file: web_app/components/parent.jsx

Screenshot: docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-11-teacher-profile-from-post.png

### 3. Role/Screen

Parent / Link child by UUID / Browser session auth state

Severity: P2

Repro: In the Browser plugin parent session, open `Anak / Children`, open `Buka Panduan Tambah Anak`, enter `8d9cee43-012e-4f65-bca8-26f749f504b5`, check consent, and submit.

Expected: Because this child is already linked to the parent demo account, the UI should show the duplicate guard `Anak ini sudah dipaut pada akaun ibu bapa.`

Actual: The in-app Browser run returned `Only parents can link to students` even though the shell displayed role `parent`. A clean Playwright mobile context returned the expected duplicate guard, so this appears to be an inconsistent stale/session-auth path rather than a deterministic form validation failure.

Suspected file: web_app/app.js, backend/src/auth/routes.ts

Screenshot: docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-05-link-child-uuid-submitted.png

### 4. Role/Screen

Parent / Class Posts / Media rendering

Severity: P2

Repro: Login as parent on mobile, open `Pos Kelas / Class Posts`, inspect `W15 Media Post df8dd38b` in the linked Mathematics classroom.

Expected: Media in class posts should render as usable image/GIF/link previews, or at least preserve clickable URLs.

Actual: The media post content renders as raw, truncated text such as `Image: https: placehold.co... GIF: https: media.giphy.com...`, with no visible media preview or obvious openable link in the parent feed.

Suspected file: web_app/components/parent.jsx

Screenshot: docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-07-class-posts.png

## Pass/fail checklist

| Mandate | Result | Evidence |
| --- | --- | --- |
| Buttons | Partial | Navigation, modal open, progress buttons, and comment submit worked. Reaction button failed. |
| States | Partial | Duplicate link state worked in clean mobile context. Browser session showed inconsistent role state. |
| Forms/errors | Pass | Add-child modal validates consent path and shows duplicate child message in clean mobile context. |
| Modals | Partial | Add-child modal opened and focused the input. Teacher profile modal was not reachable from posts. |
| Lists | Pass | Children, progress, and posts lists rendered. |
| Media | Fail | Media post rendered raw/truncated URL text instead of preview/link UI. |
| Mobile | Partial | Mobile layout screenshots captured at 375px, but Browser screenshot path required Playwright fallback. |
| Dark contrast | Pass | Dark theme rendered throughout the parent flow; no unreadable text found from DOM/screenshot pass. |
| Keyboard/focus | Partial | Add-child modal initially focused the ID input. Teacher profile focus path could not be tested because the entry point is missing. |
| Console | Partial | No Browser console warnings/errors on desktop. Clean mobile duplicate-link submission emitted the expected 409 network console resource error. |
| Network | Partial | Expected 409 on duplicate child link. Parent feed/progress/classroom requests returned content during the pass. |

## Required pass conditions

| Condition | Result | Notes |
| --- | --- | --- |
| Parent cannot see classrooms their child is not enrolled in | Pass | UI showed enrolled `Tingkatan 4 Matematik Fokus`, `Tingkatan 4 Sains Eksperimen`, and `Tingkatan 5 Bahasa Inggeris SPM`. DB comparison showed `W15 Teacher QA Class df8dd38b`, W8, W10, and extra `Kelas Matematik` classes were not enrolled and were absent from the parent post feed. |
| Comment/reaction mirror student | Fail | Parent comment was created and visible immediately. Parent reaction did not update count/state after repeated clicks. |

## Screen evidence

### Desktop screenshots

| Screen | Screenshot |
| --- | --- |
| Home linked child | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-01-home-linked-child.png |
| Children list | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-02-children-list.png |
| Link child modal | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-03-link-child-modal-open.png |
| Link child UUID filled | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-04-link-child-uuid-filled.png |
| Link child submitted | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-05-link-child-uuid-submitted.png |
| Child progress drill-down | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-06-child-progress-drilldown.png |
| Class posts | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-07-class-posts.png |
| Post expanded before comment | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-08-post-expanded-before-comment.png |
| Post like/comment | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-09-post-like-comment.png |
| Reaction retry defect | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-10-post-reaction-retry.png |
| Teacher profile from post defect | docs/qaqc-results-2026-05-17/screenshots/parent/desktop/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-desktop-11-teacher-profile-from-post.png |

### Mobile screenshots

| Screen | Screenshot |
| --- | --- |
| Home linked child | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-01-home-linked-child.png |
| Children list | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-02-children-list.png |
| Link child modal | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-03-link-child-modal-open.png |
| Link child UUID filled | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-04-link-child-uuid-filled.png |
| Link child submitted | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-05-link-child-uuid-submitted.png |
| Child progress drill-down | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-06-child-progress-drilldown.png |
| Class posts | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-07-class-posts.png |
| Teacher profile from post defect | docs/qaqc-results-2026-05-17/screenshots/parent/mobile/w16-2026-05-17-df8dd38b-0eef-4b6b-bc36-59f0d6f3db2e-mobile-08-teacher-profile-from-post.png |

## Residual risks

The repo and database were being touched by parallel QA work during this run. Parent feed content changed while testing, including an additional media post in the linked Mathematics classroom. Findings above are based on the observed state during W16 and avoid reverting or editing other workers' data.

No commits or environment edits were made.
