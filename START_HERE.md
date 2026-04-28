# START_HERE — bootstrap protocol for AI sessions

**If you are an AI assistant (Claude in chat, Claude Code, Codex, anything else) working on lessonloop3, you must read these files in this order, in full, before producing any response or running any command:**

1. `START_HERE.md` (this file)
2. `STATUS.md` — what's currently active, what's blocked, what's next
3. `WORKFLOW.md` — how work gets done in this repo
4. `LESSONLOOP_PRODUCTION_ROADMAP.md` — the one-screen status table at the top, then the active area's section
5. The walk doc for the area named in `STATUS.md`, if one exists (path also in `STATUS.md`)
6. `claude.md` — project-specific Claude Code context (Stripe, edge functions, etc.)

Do not skip. Do not summarise from training data. Do not guess at filenames or layouts. The repo state changes daily; your training data is months stale.

---

## What kind of session is this?

**Starting a new walk?** Read `WORKFLOW.md` §"How to walk an area".

**Authoring fixes against an existing walk?** Read `WORKFLOW.md` §"How to ship a fix batch".

**Picking up a previous chat (handover)?** Read the last 3 entries in `POLISH_NOTES.md` and the `## Active work` block in `STATUS.md`.

**Don't know what kind of session this is?** Ask Jamie. Don't guess.

---

## Quality bar

Every fix is shipped to a world-class standard. No "good enough", no "minor cleanup deferred", no "this is small so it doesn't matter". If a finding exists in a walk doc, it is either:

- Fixed properly, with all related findings closed in the same PR
- Formally withdrawn with reasoning recorded in the walk doc
- Escalated to Jamie as a product decision and recorded in `STATUS.md` under "Awaiting Jamie decision"

Nothing is skipped silently. Nothing is half-done. Nothing ships with a "we'll come back to this" comment.

---

## Hard constraints — Jamie's working environment

- **Jamie never works locally.** No terminal. No local dev server. No local DB.
- **Three execution surfaces only:** Claude Code (web), Lovable (chat + SQL panel), GitHub web.
- **Every prompt produced by chat-Claude follows the prompt envelope shape defined in `WORKFLOW.md`.** No exceptions.
- **Smoke testing is server-side SQL only**, run by Jamie via Lovable's SQL panel. Browser DevTools snippets are never to be given to Jamie.
- **Doc updates are never a Jamie task.** Strikethrough audit-doc rows, POLISH_NOTES appends, STATUS.md updates — all happen as part of the same Claude Code commit that ships the fix.

---

## Roles — who does what

| Role | What they do | What they never do |
|---|---|---|
| **Jamie** | Approves plans. Answers product decisions. Pastes prompts into the surface specified. Pastes results back. Reviews and merges PRs. Tells Lovable to apply. | Writes code. Edits docs. Runs local commands. Reads SKILL.mds or implementation detail. |
| **Chat-Claude** (this surface, Claude.ai) | Walks areas. Proposes fix plans. Authors prompt envelopes. Maintains walk docs. Updates roadmap area-status. | Executes anything. Touches the repo directly. Asks Jamie for clarification on technical detail. |
| **Claude Code** (web) | Writes migrations. Writes edge functions. Updates docs as part of fix commits. Pushes branches. Returns PR URLs. | Deploys. Applies migrations. Decides product questions. Skips findings. Compromises on quality. |
| **Lovable** | Owns React/TS frontend. Applies migrations. Deploys edge functions. Runs SQL via its SQL panel. | Touches `supabase/migrations/*.sql` source files. Edits backend logic. |
| **QA tester** (Jamie's tester, end-of-cycle) | Tests the entire app once all areas are fix-complete. | Per-area testing. Per-fix testing. |

---

## When in doubt

Ask Jamie. Do not guess. Do not produce partial work. Do not invent filenames, line numbers, or paths — read them from the repo.

If a walk doc says "escalate to Jamie" on a finding, that finding does not get fixed until Jamie has answered. The answer goes into `STATUS.md` and the walk doc both.
