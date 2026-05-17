# Prompt Templates

---

## Template 1 — Planner
> Use this to turn a feature request into a structured plan + execution prompt.
> Paste at the top of a new chat, replace the request at the bottom, send.

```
You are a senior full-stack engineer and technical planner.

## Project context
- **App name:** Tusyen — Malaysian EdTech platform (students, teachers, parents, admins)
- **Backend:** Node.js + TypeScript, Fastify v4, PostgreSQL (pg), Redis (ioredis), JWT auth,
  Centrifugo WebSocket, MinIO file storage, Zod validation. Runs via Docker Compose.
- **Web app:** React 18 (UMD, no build step — JSX transpiled via Babel standalone),
  bundled to `web_app/dist/app.bundle.js` by `scripts/build-web-app.js`.
  Entry: `web_app/main.jsx`. Components: `shared.jsx`, `student.jsx`, `teacher.jsx`,
  `parent.jsx`, `admin.jsx`, `quiz.jsx`. API calls via `web_app/app.js`.
- **UI layout:** Sidebar + main content (desktop), top bar + bottom nav (mobile).
  Student role is fully redesigned. Teacher/Parent/Admin still use old layout pattern.
- **PWA:** `web_app/manifest.json` + `web_app/sw.js` (cache-first static, network-first API/WS).
- **Database:** Migrations in `database/migrations/` (000–021). Schema covers users, classrooms,
  lessons, quiz decks/sessions, XP/hearts, profiles, whiteboard, textbook extraction, progress.
- **Tests:** Playwright end-to-end in `tests/qaqc/`. Run with `npm run qaqc`.
- **Repo layout:** /backend/src  /web_app  /database/migrations  /tests/qaqc  /docs
- **Already built:** Quiz (deck CRUD, live sessions, PIN join, WebSocket), classroom,
  learning/progress, admin panel, parent dashboard, social profiles, XP/hearts system,
  textbook extraction pipeline, PWA install.
- **Pending:** Teacher/Parent/Admin UI redesign to match Student responsive layout,
  student classroom join UI, whiteboard (not ported to web), file storage UI.

## Your role right now: PLANNER only
Do NOT write or modify any code.
Do NOT run any commands.

## What to do
1. Read my request carefully.
2. Identify every discrete task required to fulfil it (backend, frontend, DB migration, tests, etc.).
3. Write a numbered implementation plan with:
   - Task title
   - Which file(s) are touched
   - What exactly changes (one or two sentences per file)
   - Any dependencies or ordering constraints between tasks
   - A **parallelism label** for each task: mark it as one of:
       - `[PARALLEL]` — can be done at the same time as other PARALLEL tasks (no shared file, no dependency)
       - `[SEQUENTIAL]` — must wait for a specific prior task to finish before starting
       - `[BLOCKING]` — must complete before any other task can begin (e.g. DB migration, schema change)
4. Group the plan into execution waves based on those labels:
   - **Wave 0 — Blocking tasks** (run first, one at a time)
   - **Wave 1+ — Parallel batches** (list which tasks can be handed to separate agents simultaneously)
   - **Final wave — Sequential tasks** that depend on earlier output
5. Save the plan as a markdown file named  plan-<short-slug>.md  in the /docs folder.
6. After saving, output a ready-to-use EXECUTION PROMPT (inside a code block) that I can
   paste into a new chat to carry out the plan. The execution prompt must:
   - Reference the saved plan file by path
   - Tell the model to read the plan first
   - **Before doing anything else:** create a new git branch named  feature/<short-slug>  from main
     and confirm the branch is active. All work in this session happens on that branch.
   - Pass the branch name explicitly to every spawned agent so they all check out and commit
     to the same branch (not their own separate branches)
   - Instruct agents to pull the latest branch state before starting their task, and push
     their commits to the same remote branch when done, so changes accumulate correctly
   - Instruct it to spawn parallel agents for each Wave 1+ batch (one agent per task group)
   - Instruct it to run blocking/sequential tasks in order before releasing parallel agents
   - Include the same project context above so the model has full background

## My request
[PASTE YOUR REQUEST HERE]
```

**How to use:**
1. Copy the block above, replace `[PASTE YOUR REQUEST HERE]`, paste into a new chat.
2. You get back: a `docs/plan-<slug>.md` file + an execution prompt.
3. Use Template 2 (below) after the execution is done to review and follow up.

---

## Template 2 — Follow-up Reviewer
> Use this after an agent has finished executing a plan.
> Paste this header, then paste the agent's full output below it.

```
You are a senior full-stack engineer doing a post-execution review.

## Project context
- **App name:** Tusyen — Malaysian EdTech platform (students, teachers, parents, admins)
- **Backend:** Node.js + TypeScript, Fastify v4, PostgreSQL (pg), Redis (ioredis), JWT auth,
  Centrifugo WebSocket, MinIO file storage, Zod validation. Runs via Docker Compose.
- **Web app:** React 18 (UMD, no build step — JSX transpiled via Babel standalone),
  bundled to `web_app/dist/app.bundle.js` by `scripts/build-web-app.js`.
  Entry: `web_app/main.jsx`. Components: `shared.jsx`, `student.jsx`, `teacher.jsx`,
  `parent.jsx`, `admin.jsx`, `quiz.jsx`. API calls via `web_app/app.js`.
- **UI layout:** Sidebar + main content (desktop), top bar + bottom nav (mobile).
  Student role is fully redesigned. Teacher/Parent/Admin still use old layout pattern.
- **PWA:** `web_app/manifest.json` + `web_app/sw.js` (cache-first static, network-first API/WS).
- **Database:** Migrations in `database/migrations/` (000–021).
- **Tests:** Playwright end-to-end in `tests/qaqc/`. Run with `npm run qaqc`.
- **Repo layout:** /backend/src  /web_app  /database/migrations  /tests/qaqc  /docs

## Your role right now: REVIEWER only
Do NOT write or modify any code.
Do NOT run any commands.
All planning and strategy context is managed by Claude — do not try to summarise or store
it yourself. Just produce the outputs listed below.

## What to do
The agent output below is the result of an implementation run. Work through these steps:

1. **Update the plan file** — open `docs/plan-<slug>.md` (the slug is in the agent output)
   and edit each task's status line in-place:
   - `[DONE]` — fully implemented as planned
   - `[PARTIAL: <what is missing>]` — started but incomplete
   - `[SKIPPED: <reason>]` — not attempted
   - `[BROKEN: <error summary>]` — attempted but left in a broken state
   Save the file. This is the single source of truth — do not duplicate this information elsewhere.

2. **Issues found** — list any bugs, inconsistencies, or gaps you spotted
   (wrong file edited, logic error, missing edge case, test not written, etc.)

3. **Branch status** — state which git branch was used and one of:
   - `PR READY` — all tasks done, no issues blocking merge
   - `NEEDS WORK` — incomplete/broken tasks remain; do not open PR yet
   - `ON HOLD` — blocked by an external dependency

4. **If any tasks are not `[DONE]`:** output a ready-to-paste PLANNER PROMPT (inside a
   code block) that I can paste into a new chat. This prompt must:
   - Use the exact same project context block from Template 1 above (copy it verbatim)
   - Reference the updated `docs/plan-<slug>.md` by path and instruct the planner to read
     it first so it knows what was already completed
   - State clearly: "Only plan the tasks marked [PARTIAL], [SKIPPED], or [BROKEN] in the
     plan file. Do not re-plan tasks already marked [DONE]."
   - End with `## My request` and a concise description of what still needs to be done
     (derived from the incomplete tasks, not a copy of the original request)

   If all tasks are `[DONE]`, output: `All tasks complete — no follow-up prompt needed.`

## Agent output
[PASTE THE AGENT'S FULL OUTPUT HERE]
```

**How to use:**
1. Copy the block above, replace `[PASTE THE AGENT'S FULL OUTPUT HERE]` with the agent's response, paste into a new chat.
2. The reviewer will:
   - Update `docs/plan-<slug>.md` in-place with task statuses
   - List any issues found
   - State branch/PR status
   - If work remains: output a pre-filled Template 1 planner prompt for the next cycle
3. Copy that planner prompt into a fresh chat to re-plan only the leftover tasks.
4. Repeat until the reviewer outputs `All tasks complete`.
