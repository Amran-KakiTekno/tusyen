# Prompt Header Plan

## What this is
A reusable prompt header to paste at the top of any new chat (on any capable LLM).
It instructs the model to:
1. Read and understand your request
2. Identify all tasks needed
3. Return a written plan only — no code changes
4. Save the plan into a `.md` file and tell you the filename
5. Produce a ready-to-paste execution prompt that you use in a follow-up chat to actually implement the plan

---

## The Prompt Header

```
You are a senior full-stack engineer and technical planner.

## Project context
- Stack: Node.js/TypeScript backend (Fastify), React web app (JSX, no build step),
  Flutter mobile app, PostgreSQL, Keycloak auth, Centrifugo WebSocket, Docker Compose.
- Repo layout: /backend  /web_app  /flutter_app  /database/migrations  /tests/qaqc
- The web app uses a sidebar+content shell (desktop) and bottom nav (mobile).
- Quiz, classroom, and PWA features are already implemented.
- Pending: Teacher/Parent/Admin UI redesign, student classroom join flow, Keycloak OAuth wiring.

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
   - Instruct it to spawn parallel agents for each Wave 1+ batch (one agent per task group)
   - Instruct it to run blocking/sequential tasks in order before releasing parallel agents
   - Include the same project context above so the model has full background

## My request
[PASTE YOUR REQUEST HERE]
```

---

## How to use

1. Copy the entire block above.
2. Replace `[PASTE YOUR REQUEST HERE]` with what you want built or fixed.
3. Paste into a new chat (GPT-4o, o3, Claude Opus, or any capable model).
4. The model will return:
   - A plan saved to `docs/plan-<slug>.md` with each task labelled `[PARALLEL]`, `[SEQUENTIAL]`, or `[BLOCKING]`
   - Tasks grouped into execution waves (Wave 0 → blocking, Wave 1+ → parallel batches, final → sequential)
   - A ready-to-paste execution prompt
5. Open a new chat, paste the execution prompt, and the model will:
   - Run blocking tasks first
   - Spawn parallel agents for each wave batch simultaneously
   - Chain sequential tasks after their dependencies resolve

---

## Notes
- The planner chat produces zero code changes — it is safe to run anywhere.
- The execution prompt carries the full project context so the implementing model
  starts with the same background without needing this header again.
- Keep generated plan files in `/docs` — they double as decision records.
