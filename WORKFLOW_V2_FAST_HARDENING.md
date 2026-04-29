# WORKFLOW V2 — Fast Hardening Operating Model

**Status:** active from 2026-04-29. Supersedes `WORKFLOW.md` sections "How to ship a fix batch" and "Variant: Lovable-owned fixes" for fix-batch work. Walk PRs and tiny one-line fixes still use V1 (see "When V1 still applies" below).

## Why V2 exists

V1 ("one prompt envelope per fix") had Jamie acting as a clipboard between chat-Claude, Claude Code, Lovable, GitHub, and SQL panels. Excellent quality, hours per area. V2 keeps the quality bar and removes the human relay.

## Roadmap authority

`LESSONLOOP_PRODUCTION_ROADMAP.md` remains the canonical area plan for LessonLoop production hardening.

WORKFLOW V2 changes the execution model only. It does not reduce scope, skip areas, or change the launch bar.

Every planned area in the roadmap must still be:

1. walked end-to-end
2. captured in an audit doc under `docs/audits/`
3. grouped into batches
4. fixed through batch PRs
5. verified at repo level by the agent
6. applied / deployed / verified through Lovable where needed
7. marked complete in `STATUS.md` and the roadmap

Future agents must read the roadmap before proposing next work. Area order follows the roadmap unless Jamie explicitly changes it. Agents do NOT invent area structure from chat history.

The doc system as a whole:

- `LESSONLOOP_PRODUCTION_ROADMAP.md` — what areas exist and what must be completed.
- `WORKFLOW_V2_FAST_HARDENING.md` — how each area gets walked, batched, fixed and handed off.
- `STATUS.md` — where we are right now and what the next session should do.
- `docs/audits/{YYYY-MM}-area-{N}-{name}.md` — detailed findings for the active area.

## Rule 0 — Production-access boundary (READ FIRST)

Lovable is the production SQL migration apply and edge-function deployment surface. Lovable is not optional and is not a frontend-only tool. The boundary that no agent crosses:

- Claude Code / Codex / chat-Claude **write**: migrations, edge function source, React/TS, docs, tests, PRs.
- Claude Code / Codex / chat-Claude **never**: apply migrations to production, deploy edge functions to production, call the Supabase Management API, verify production Supabase state by any means.
- After PR merge, Jamie manually triggers Lovable to apply migrations and deploy edge functions. Jamie manually runs verification SQL in the Lovable SQL panel. Jamie confirms behaviour in the app.

Every batch PR must include a "Lovable after-merge actions" section listing exactly what Jamie needs Lovable to do. If a section subheading has nothing under it, write `(none)` — never omit.

## Rule 1 — Mandatory next-session handoff in `STATUS.md`

Every Claude Code / Codex session has a finite context window. Chat history from previous sessions cannot be relied on. `STATUS.md` is the canonical source of truth for "where am I right now" — it is read by every future session before any work begins.

Every batch PR must update the "Next session handoff" block in `STATUS.md`. Short, scannable, target ≤15 bullets, written for a fresh AI session with no chat context.

The handoff block format is canonical:

- **Active area:** the current area (e.g. Area 2 — Parent Portal)
- **Current batch:** the in-flight batch ID and short description, or "(none in flight)"
- **Last merged PR / branch:** PR number and branch name of the most recent merge, or "(none in flight)"
- **What shipped:** 1–2 sentence summary of the batch's actual changes
- **Lovable after-merge actions:** migrations to apply / edge functions to deploy / SQL to run, or "(none)"
- **Lovable status:** one of `pending until Jamie confirms` / `confirmed complete YYYY-MM-DD HH:MM UTC` / `N/A`
- **Production SQL verification:** required + queries listed in PR body, or not required for this batch
- **App behaviour checks:** 1–2 sentence summary, or "(none)"
- **Next batch in active area:** Batch ID + short description, or "Area complete"
- **Next area after this one closes:** derived from `LESSONLOOP_PRODUCTION_ROADMAP.md`, or "see roadmap"
- **Roadmap progress:** brief snapshot derived from the roadmap status table
- **Next session first instruction:** one specific actionable sentence pointing at a concrete next action

Rules for the handoff:

1. The block must be present in `STATUS.md` at all times. If a batch is in flight, the handoff describes that batch. If between batches, it describes the most recent merge and what comes next.
2. Lines must be short and scannable. No prose paragraphs. No nested sub-bullets.
3. **Lovable status** is the most important line — three valid values: `pending until Jamie confirms`, `confirmed complete YYYY-MM-DD HH:MM UTC`, or `N/A`.
4. Jamie does not have to hand-edit repo docs to confirm Lovable status. Jamie confirms in chat. The agent updates `STATUS.md` in the next batch PR — or in a tiny docs-only PR if the status update is required immediately (e.g. a HALT cleared by Jamie's confirmation that Lovable applied).
5. **Next session first instruction** must be a single, specific, actionable sentence — not a vague handoff like "continue work on Area 2".
6. **Next area after this one closes** and **Roadmap progress** are derived from the roadmap, not from chat history.

## Rule 2 — Bootstrap order for any new session

`START_HERE.md` instructs every new agent to read, in this exact order:

1. `START_HERE.md` (this file)
2. `STATUS.md` — especially the "Next session handoff" block at the top
3. `WORKFLOW_V2_FAST_HARDENING.md` — current operating model
4. `LESSONLOOP_PRODUCTION_ROADMAP.md` — canonical area plan
5. The active walk doc named in `STATUS.md`, if one exists
6. `WORKFLOW.md` — V1, retained for history; consult only if V2 doesn't answer something
7. `claude.md` — project-specific Claude Code context

Reading order is not a suggestion. It is how a fresh session orients without chat history.

## Rule 3 — Six rules for batch execution

1. **Batch is the unit, not the finding.** Chat-Claude proposes batch packs of related findings; Jamie approves the pack as a whole.
2. **One paste-ready agent prompt per batch.** No micro-prompts. The prompt contains the full batch spec — every finding, every file/pattern, replacement rules, after-merge action list, doc-update plan including handoff update.
3. **Agent owns the entire batch end-to-end at the repo level.** Implement every finding; update walk doc + `POLISH_NOTES` + `STATUS.md` handoff + roadmap when materially changed; run repo-level verification (grep, typecheck, build, lint); open the PR with structured body.
4. **Repo-level verification is the agent's ceiling.** The agent verifies things that don't require production access. The agent never claims production state is verified.
5. **Jamie owns production.** Jamie merges the PR. Jamie asks Lovable to apply migrations and deploy edge functions. Jamie runs verification SQL in Lovable. Jamie confirms app behaviour in chat.
6. **When in doubt, the agent halts and asks.** Halt conditions:
   - (a) a finding's intent is ambiguous after reading the code
   - (b) production state must be verified before continuing (provide SQL for Jamie to run in Lovable)
   - (c) any irreversible production action would be needed
   - (d) the implementation drifts beyond the batch's stated scope

   The halt produces one chat message (format below); the agent does not chain envelopes. Before halting, the agent updates `STATUS.md` "Next session handoff" so a fresh session can resume from the repo alone.

## Required PR body sections (every batch PR)

Every batch PR includes these H2 sections, in this order:

- `## Summary` — 1–2 paragraphs covering what this batch ships, what findings close, anything notable.
- `## Findings closed` — bullet list of finding IDs and surface, or `(none)` for workflow-only PRs.
- `## Repo-level verification (done by agent)` — TypeScript check / build / lint / batch-specific grep or file-count assertions, each with pass/fail or N/A.
- `## Lovable after-merge actions (Jamie does these)` — four H3 subsections: `### 1. Migrations to apply`, `### 2. Edge functions to deploy`, `### 3. Production SQL verification`, `### 4. App behaviour checks`. Each subsection has content or `(none)`. Never omit a subsection.
- `## Next session handoff update` — confirms `STATUS.md` "Next session handoff" was updated; states Lovable status (pending / N/A) and next batch.
- `## Roadmap impact` — one of: `No roadmap change — {brief}` / `Area X row updated: A/B → C/B` / `Area X status: pending → in-progress` / `New batch added to Area X plan` / `Area renamed/split/merged: details`.

If any subsection has nothing in it, write `(none)`. Structure must be parseable.

## Halt and surface format

When the agent halts under Rule 3.6, it sends one chat message in this shape:

- `HALT: Batch {N} — {batch slug}`
- `Reason: {a/b/c/d from Rule 3.6}`
- `What I found: {1–3 sentences of concrete state}`
- `What I need from you: {a single, specific question with 2–3 options, OR a SQL query for Jamie to run in Lovable and paste back}`
- `What I have NOT done yet: {scope I will resume from once you answer}`

Before halting, the agent updates `STATUS.md` "Next session handoff" — Current batch field becomes `Batch {N} — HALTED at {step}`, and Next session first instruction reads `Resume from halt: {what's needed from Jamie}`. Then stop.

## When the roadmap must be updated by an agent

The agent edits `LESSONLOOP_PRODUCTION_ROADMAP.md` (one-screen status table + relevant area's detail block) when:

1. An area's HIGH-shipped count materially changes
2. An area moves status (⚪ pending → 🟡 in progress → 🟢 closed)
3. A new batch is introduced under an area
4. A planned area is renamed, split, or merged

If none of those conditions apply, the agent writes `No roadmap change — {brief}` in the Roadmap impact section. Never silent.

## Surface model

- **Claude Code (web)** — default agent for batches. Backend (migrations, edge fn source, RLS, RPCs) and large multi-file frontend sweeps.
- **Codex** — batches >50% TypeScript refactor or complex frontend logic.
- **Lovable** — production migration apply, edge function deploy, SQL verification panel. Also: small surgical UI changes Jamie explicitly asks Lovable to make.
- **Jamie** — approves batches, decides product questions, merges PRs, drives Lovable post-merge, confirms Lovable status in chat.

## Roles

| Role | Owns | Never does |
|---|---|---|
| Jamie | Batch approval, product decisions, merging PRs, driving Lovable post-merge, confirming Lovable status in chat, area sign-off | Pasting micro-prompts, hand-editing repo docs to confirm production state, running production SQL the agent claims is needed |
| Chat-Claude | Walking areas, proposing batch packs, writing the single agent prompt per batch | Executing anything, touching the repo directly |
| Claude Code / Codex (the agent) | Implementing entire batches at the repo level, opening PRs with required structure including handoff update | Production access, doc-update follow-up PRs, asking Jamie about implementation detail, marking Lovable status as confirmed |
| Lovable | Production migration apply, edge function deploy, SQL panel | Backend source code, doc updates, large mechanical sweeps |

## Doc updates inside batch PRs

Every batch PR includes:

1. Walk doc strikethrough for closed findings
2. `POLISH_NOTES` section appended in canonical shape
3. `STATUS.md` `Last updated` field + `Fixes shipped` line + mandatory `Next session handoff` block update
4. `LESSONLOOP_PRODUCTION_ROADMAP.md` when conditions in "When the roadmap must be updated by an agent" apply

## When V1 still applies

- Walk PRs (audit doc creation only) — V1 "How to walk an area" still applies. Docs-only.
- Tiny standalone fixes — V1 micro-prompts are fine if writing a full batch prompt would cost more than the fix saves.
- Default to V2 for everything else.
