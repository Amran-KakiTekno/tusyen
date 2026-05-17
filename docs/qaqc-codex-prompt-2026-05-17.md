# Prompt for GPT-5.3 Codex Spark — Execute Tusyen Full QA/QC

Copy-paste the block below to GPT-5.3 Codex Spark. It points at the plan file and tells the agent how to coordinate parallel execution.

---

```
You are coordinating a comprehensive QA/QC pass for the Tusyen self-hosted education platform. The full plan is in this file (read it in full before doing anything else):

  docs/qaqc-full-plan-2026-05-17.md

Repository root: D:\2026\tusyen (Windows, PowerShell). The stack runs on Docker (Caddy → Fastify API → Postgres/Redis/MinIO/Keycloak/Centrifugo/ntfy). React web app lives in web_app/, legacy Flutter app in flutter_app/, backend in backend/, Playwright suite in tests/qaqc/. Demo accounts use password123 (student@tusyen.test, teacher@tusyen.test, parent@tusyen.test, admin@tusyen.test).

YOUR JOB
1. Read docs/qaqc-full-plan-2026-05-17.md end-to-end.
2. Execute Stage 0 (Pre-Flight) yourself, sequentially.
3. For Stages 1 through 4 (workstreams W1–W23 plus L1–L5), dispatch each workstream to a separate parallel sub-agent. Use the maximum parallelism your runtime supports. Brief each sub-agent with:
   - Its workstream ID, goal, scope, tools, pass criteria, and deliverable path (all from the plan).
   - The shared run-id / isolation rules from the plan.
   - The path of the env snapshot from Stage 0 so it has reproducible context.
   - The defect-logging template from the plan (Role/Screen, Severity, Repro, Expected, Actual, Suspected file, Screenshot).
4. After every Stage 1–4 workstream has produced its deliverable .md file in docs/qaqc-results-2026-05-17/, execute Stage 5 (W24) yourself: read every deliverable and synthesize SUMMARY.md.

NON-NEGOTIABLE RULES
- Read the plan first. Do not improvise scope. If you need to skip or modify a workstream, document it in SUMMARY.md under "Untested / out-of-scope".
- Frontend UI/UX work (Stage 3) is FIRST-CLASS. Agents must actively bug-hunt — not just confirm screens render. Drive the UI in a real browser (Playwright headed / actual click-through). Capture screenshots into docs/qaqc-results-2026-05-17/screenshots/.
- Flow-logic work (Stage 3.5, L1–L5) tests whether each user journey closes the loop. A feature is NOT pass just because the API returns 200; the user must be able to complete their mental model on screen.
- The baseline known defect is documented in the plan: the post-quiz "Tamat! / Semakan ringkas" review screen lists each question but omits the user's selected answer, the correct answer, and the explanation. Confirm this in L2 and log a fix proposal with file:line in SUMMARY.md.
- Every workstream that creates persistent data namespaces with its own run-id. Do not delete the demo seed accounts. Best-effort cleanup at the end.
- All defects logged with severity (Blocker / Major / Minor / Cosmetic) using the template in the plan.
- Do NOT modify production .env values. If a workstream needs a production-mode toggle (W21), spin up a separate temporary env or document the limitation.
- Do NOT commit anything. Just produce the deliverable .md files and screenshots.

ENVIRONMENT
- Windows 11 + PowerShell. Use PowerShell syntax (Invoke-RestMethod, $env:VAR, etc.). The Bash tool is also available for POSIX scripts.
- Docker Desktop must be running. If it is not, ask the user to start it before proceeding.
- For Stage 0, if anything fails (containers don't come up, seed fails, build fails), STOP and report — do not start downstream stages on a broken stack.

DELIVERABLES (final state of docs/qaqc-results-2026-05-17/)
- _env-snapshot.md  ← from Stage 0
- SUMMARY.md        ← from Stage 5 (W24), overall verdict + defect list + recommendations
- w1..w23-*.md      ← one per Stage 1–4 workstream
- l1..l5-*.md       ← one per Stage 3.5 flow-logic workstream
- screenshots/<role>/<viewport>/*.png  ← for every UI defect, plus one happy-path screenshot per screen

WHEN YOU ARE DONE
Reply with:
1. Path to SUMMARY.md.
2. Top-line verdict: GREEN / YELLOW / RED.
3. Count of Blocker + Major defects.
4. List of any workstreams skipped or partial, with reason.

Start now: read docs/qaqc-full-plan-2026-05-17.md.
```

---

## Operator Notes (not part of the prompt — for the human running Codex)

- Before sending: make sure Docker Desktop is running and `docker compose ps` from `D:\2026\tusyen` would show the expected containers (or be willing to start them).
- The plan assumes `DEMO_ADMIN_LOGIN_ENABLED=true` for QA. If your local `.env` has it off, set it before kickoff or the admin workstreams (W6, W17, L5) will fail at login.
- This run uses ~28 workstreams. If Codex Spark's parallel limit is lower, it will batch — that just stretches wall-time, not correctness.
- The final `SUMMARY.md` is the artifact to review. Open it, triage Blocker/Major items, then decide whether to fix-and-rerun or ship with known issues.
