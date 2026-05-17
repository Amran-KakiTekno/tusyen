# W24 Aggregate & Triage

Date: 2026-05-17
Status: **YELLOW**

## Environment
- Snapshot: [`_env-snapshot.md`](./_env-snapshot.md)
- Stack health and Stage-0 prereqs succeeded before Stage 1 onward.

## Coverage matrix

| Workstream | Result | Key finding |
| --- | --- | --- |
| W1 | Partial / Failed | Backend suite had 1 major failure in `test/auth.routes.test.ts` parent alerts case (500).
| W2 | Pass | Flutter unit + e2e and web build passed.
| W3 | Partial | Smoke pass, but language-switch spec had major UI regressions.
| W4 | Pass | Full feature regression passed with `DEMO_ADMIN_LOGIN_ENABLED=true`.
| W5 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W6 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W7 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W8 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W9 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W10 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W11 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W12 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W13 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W14 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W15 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W16 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W17 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W18 | Not Run | Multi-agent dispatch limit prevented fan-out execution.
| W19 | Partial | Language selector failures found in modal and role screens; one untranslated/hardcoded string.
| L1 | Not Run | Parallel dispatch prevented flow logic execution.
| L2 | Partial / Confirmed | Baseline quiz review defect confirmed in `student.jsx`.
| L3 | Not Run | Parallel dispatch prevented flow logic execution.
| L4 | Not Run | Parallel dispatch prevented flow logic execution.
| L5 | Not Run | Parallel dispatch prevented flow logic execution.
| W20 | Not Run | Parallel dispatch prevented authz matrix execution.
| W21 | Not Run | Parallel dispatch prevented production hardening execution.
| W22 | Not Run | Parallel dispatch prevented websocket isolation execution.
| W23 | Not Run | Parallel dispatch prevented abuse validation execution.

## Severity summary
- Blocker: 0
- Major: 3
- Minor: 1
- Cosmetic: 0
- Total Blocker + Major: **3**

## Defect list (classified)

1. **[Major] Parent alert route returns 500 in auth parent routes test**
   - Source: `backend/test/auth.routes.test.ts`
   - Repro: run backend suite with `npm test -- --run --reporter=verbose`
   - Expected: parent alert derivation for linked students returns 200.
   - Actual: failing assertion with 500 status.
   - Suggested owner: backend + auth/store owner (`backend/src/auth/routes.ts`)
   - Deliverable: [`w1-backend-tests.md`](./w1-backend-tests.md)

2. **[Major] Language switch does not work reliably for guest/role screens**
   - Source: `web_app` role shell/language components (see `w19` evidence)
   - Repro: Playwright `language-switch.spec.ts`
   - Expected: language toggle updates visible UI and persists.
   - Actual: unauthenticated toggle timeouts and `.language-toggle-icon` not clickable in multiple flows.
   - Suggested owner: frontend i18n owner (`web_app/components/shared.jsx` and role shells).
   - Deliverable: [`w3-playwright-smoke.md`](./w3-playwright-smoke.md), [`w19-i18n.md`](./w19-i18n.md)

3. **[Major] Quiz summary omits selected answer and related correctness details**
   - Source: `web_app/components/student.jsx:2060-2081`
   - Expected: post-quiz screen should show user answer and correct answer per question.
   - Actual: review row shows only question label and status; selected answer missing; correct answer only conditionally shown for incorrect items.
   - Suggested fix proposal: include `item.selectedAnswer`/`item.selected` for every item and align with expected fields from API, not just `isCorrect`.
   - Deliverable: [`l2-flow-quiz.md`](./l2-flow-quiz.md)

## Untested / out-of-scope
- W5, W6, W7, W8, W9, W10, W11, W12, W13
- W14, W15, W16, W17, W18
- W20, W21, W22, W23
- L1, L3, L4, L5

Primary reason: tool-level constraint on high fan-out parallel sub-agent dispatch prevented these workstreams from being launched in this run.

## Recommended next actions
1. Re-run QA in a session with stable parallel agent availability and execute all Stage 2, Stage 3, Stage 3.5, Stage 4 workstreams.
2. Fix confirmed backend parent alert regression and rerun W1 fully.
3. Add robust Playwright i18n coverage for all language surfaces and hardcoded string audit.
4. Implement baseline quiz review fix at `web_app/components/student.jsx` and add regression assertion in L2 flow + relevant UI test.
5. Regenerate QA artifacts and update `docs/qaqc-results-2026-05-17/` with complete flow screenshots (desktop + mobile per role).
