# WORKFLOW — how work happens on lessonloop3

This is the canonical workflow doc. Everything that contradicts this doc — in older docs, in past commit messages, in chat history — is wrong. This doc is the source of truth.

---

## How to start a session

1. Read `START_HERE.md` first. It tells you which other files to read and in what order.
2. Read `STATUS.md` to know what's active and what's blocked.
3. If a walk doc is named in `STATUS.md`, read it in full.
4. Only then respond.

If you (the AI) are partway through reading and feel tempted to start producing output, stop. Finish reading. The state in your context window when you respond determines whether the response is correct.

---

## How to walk an area

A "walk" is a structured audit of one product area (e.g. parent portal, billing, calendar). One walk → one walk doc → many fix briefs.

1. Chat-Claude reads the area's source files in full — pages, hooks, edge functions, migrations, RLS policies.
2. Findings are recorded as a markdown table with columns: ID, Severity (HIGH/MED/LOW), Category, Finding, Location, Fix sketch.
3. Cross-cutting themes that span findings are gathered into a separate section ("CC-1 audit gap on parent surfaces", etc.).
4. Walk doc lands at `docs/audits/{YYYY-MM}-area-{N}-{name}.md` via a PR titled `audit({area-slug}): walk findings`.
5. `STATUS.md` updates to point at the new walk doc.
6. `LESSONLOOP_PRODUCTION_ROADMAP.md` area entry updates to "walk complete, X HIGH / Y MED / Z LOW".

Walk PRs are docs-only. They never include code changes.

### Required pre-flight check before authoring any RLS-lockdown migration

When a finding is "drop a permissive RLS policy", DO NOT rely on reading the migration the audit doc references. Migrations on the same table can stack across days/months and the audit-doc author may only have read one of them.

Before authoring the lockdown migration:

1. Run a SQL query against production via Lovable's SQL panel that returns ALL current policies on the target table:

   ```sql
   SELECT
     pol.polname AS policy_name,
     CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END AS command,
     pg_get_expr(pol.polqual, pol.polrelid) AS using_expr,
     pg_get_expr(pol.polwithcheck, pol.polrelid) AS with_check_expr
   FROM pg_policy pol
   JOIN pg_class c ON c.oid = pol.polrelid
   WHERE c.relname = '<target_table>'
   ORDER BY command, policy_name;
   ```

2. Compare the result to what the audit doc describes. If there are extra policies the audit didn't mention, they may be benign duplicates OR a structural bypass of the fix you're about to ship. Read every extra policy's definition. Decide whether to drop it as part of the same lockdown or treat it as out-of-scope (with a written reason in the migration's "Why" block).

3. The lockdown migration's "Why" block must state that this pre-flight check was done and what was found, even if the answer was "no surprises".

This rule was added in PR #368 (2026-04-29) after the J8-F9 follow-up closure — PR #367 dropped one of two parent-write policies on `guardian_payment_preferences` because the audit walker had only seen the second-set migration; the first-set FOR ALL policy from four hours earlier kept the J8-F9 attack live until post-deploy verification caught it. Pre-flight `pg_policy` check would have surfaced it before authoring.

---

## How to ship a fix batch

This is the loop, end to end:

1. **Chat-Claude proposes a fix plan** for the active area. The plan groups findings into:
   - **(a) Ship-as-batch** — RLS lockdowns, currency sweeps, doc-only stale flags. Multiple findings → one PR.
   - **(b) Ship-individually** — cross-cutting refactors that touch many files (TZ sweep, money-math RPC change). One finding/theme → one PR.
   - **(c) Decisions needed** — product questions Jamie must answer before fixes can be authored.
2. **Jamie approves the plan and answers (c).**
3. **Chat-Claude emits one prompt envelope per shippable unit.** Each envelope is paste-ready and tells Jamie exactly which surface, exactly what to paste back, and exactly what comes next.
4. **Jamie executes the prompts in order.** Pastes each into the surface specified. Pastes the result back to chat-Claude.
5. **Chat-Claude verifies each step's output before issuing the next prompt.** If a result is wrong, fix-up prompt; do not chain forward.
6. **At the end of a fix batch, the PR is merged, Lovable applies migrations / deploys edge functions, the walk doc and STATUS.md are auto-updated by the same PR.**
7. **No QA per-fix or per-area.** QA happens once at the end of all areas, with Jamie's tester, against the entire app.

### Variant: Lovable-owned fixes (frontend / `src/**/*.tsx`)

When a fix touches only files in Lovable's lane (React components, pages, hooks, contexts, styling — see "Roles, restated"), the loop has a different shape because Lovable commits directly to `main` as `gpt-engineer-app[bot]`. There is no PR to review or merge. The fix arrives in two coordinated commits:

**Commit 1 — Lovable push (the code change):**

1. Chat-Claude writes a single Lovable prompt envelope (`WHERE: Lovable — chat panel`) describing the exact change, every callsite, and the canonical replacement pattern. The prompt must be specific to the byte — no "sweep all hardcoded values" hand-waves; list every file and every line.
2. Jamie pastes the prompt into Lovable. Lovable applies the change and pushes to `main`.
3. Jamie confirms the commit landed (one-line confirmation: commit SHA + "Lovable pushed").
4. Chat-Claude pulls and verifies the diff matches what was specified. If anything is wrong (extra files touched, callsites missed, drift from spec), chat-Claude writes a corrective Lovable prompt; do not chain forward.
5. **Commit message note:** Lovable rewrites commit messages — it will paraphrase whatever you ask for into a short summary. Do not waste tokens specifying verbose conventional-commit messages in Lovable prompts. The commit SHA is the unambiguous reference; POLISH_NOTES carries the conventional-commit-style context.

**Commit 2 — Claude Code follow-up (the docs):**

1. Once Lovable's commit is verified clean, chat-Claude writes a Claude Code prompt envelope that:
   - Strikes through closed audit findings in the relevant walk doc, appending the SHA of Lovable's commit and the date as the closure note (`[shipped {DATE}, Lovable commit {SHA}]` — no PR number because there isn't one).
   - Appends one POLISH_NOTES section in the canonical shape, naming the Lovable commit SHA in place of a PR number.
   - Updates STATUS.md (`Last updated`, `Fixes shipped`).
   - Updates the roadmap status table if the area's HIGH count materially advances.
   - Commits the docs in a single commit on a `docs/{closure-slug}` branch, pushes, opens a PR, and prints the PR URL.
2. Jamie reviews and merges the docs PR.

**Why two commits, not one:** Lovable does not edit `docs/audits/`, `POLISH_NOTES.md`, `STATUS.md`, or `LESSONLOOP_PRODUCTION_ROADMAP.md`. Asking it to would muddy its lane and risk it touching files outside its remit. Claude Code does the docs work, full stop.

**Verification:** Lovable-owned fixes that need server-side proof (e.g. did this currency change actually surface in production builds?) get the same SQL/console verification step that PR-shaped fixes get — added as a final envelope in chat-Claude's response.

**When in doubt:** if a fix touches BOTH `src/**/*.tsx` AND `supabase/migrations/**` or `supabase/functions/**`, split it. Lovable does the frontend half; Claude Code does the backend half + the docs commit. Two coordinated commits is fine; one PR straddling both surfaces is not.

---

## The prompt envelope

**Every prompt chat-Claude gives Jamie uses this exact shape. No exceptions.**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHERE: [exact surface — see "Surface glossary" below]
WHY: [one sentence — what this step accomplishes]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[the paste-ready prompt or SQL or instruction]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHEN DONE: Paste back [exactly this thing].
NEXT STEP: [what surface, what action — even if "wait for me to confirm"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

A multi-step fix produces N envelopes, numbered "Step X of N". Jamie always knows which step they're on, where it goes, and what comes after.

---

## Surface glossary

Use the exact `WHERE:` strings below in every envelope.

| `WHERE:` value | What it means | When to use |
|---|---|---|
| `Claude Code — new session` | Open Claude Code in the browser, start a fresh chat. | Every new shippable unit. New sessions get a clean context window. |
| `Claude Code — same session as previous` | Continue in the open Claude Code tab. | Only if the next step depends on context Claude Code already has loaded (rare). |
| `Lovable — chat panel` | Lovable's main chat interface. | Telling Lovable to apply a migration, deploy an edge function, or sync from GitHub. |
| `Lovable — SQL panel` | Lovable's "Run SQL" / SQL editor view. | Running verification queries against production Supabase. |
| `GitHub web — Pull Requests page` | github.com/sublimeanger/lessonloop3/pulls | Reviewing diff, merging PRs. |
| `GitHub web — direct PR URL` | The compare URL chat-Claude provides. | Opening a freshly pushed PR. |
| `Wait` | Jamie does nothing; waiting on chat-Claude or on Lovable. | Between async steps (e.g. waiting for `types.ts` to regenerate). |

---

## Roles, restated

| Role | Owns | Never does |
|---|---|---|
| Jamie | Decisions, pastes, merges | Code, doc edits, local commands |
| Chat-Claude | Walks, plans, prompts | Direct repo writes, deploys |
| Claude Code | Migration source, edge fn source, doc updates inside fix commits | Deploys, migration apply, product decisions |
| **Lovable** | Owns React/TS frontend. Applies migrations. Deploys edge functions. Runs SQL via its SQL panel. Commits direct to main as `gpt-engineer-app[bot]`. | Touches `supabase/migrations/*.sql` source files. Edits backend logic. Updates audit docs, POLISH_NOTES, STATUS.md, or the roadmap — those are always Claude Code's responsibility regardless of which surface authored the fix itself. |
| QA tester | End-of-cycle whole-app testing | Per-area testing |

---

## What Claude Code's commits always include

When Claude Code ships a fix, the same commit (or PR) includes:

1. The migration / edge function / hook / component change.
2. Strikethrough of the closed finding(s) in the relevant walk doc, with `[shipped {YYYY-MM-DD}, PR #{N}]` appended.
3. POLISH_NOTES.md entry appended in the canonical shape (see "POLISH_NOTES shape" below).
4. STATUS.md update — `Last updated`, `Active area` shipped count, `In flight` cleared if this was the last in-flight item.
5. Roadmap area-status update if the area's HIGH count materially advances (every 25% milestone is enough).

If any of those are missing, the PR is incomplete and goes back for revision.

---

## POLISH_NOTES shape

Each PR appends ONE section. The shape:

```markdown
---

## Area {N} — {Name} — {short batch description} (closed/in-flight {YYYY-MM-DD})

{One-paragraph summary of what this batch ships and why.}

### {Finding-ID} (commit `<SHA>`, PR #`<N>`) — {short title}

- Migration / Edge fn / Component: {filename(s)}
- {Two to four bullet points of substance — what was wrong, what changed, why this approach}
- Lovable apply / deploy: {DATETIME} UTC
- PR: {URL}
- Verification: {one-line summary of the SQL or behavioural check that confirmed the fix}
```

Multiple findings shipped in one PR get multiple `### Finding-ID` blocks under one `## Area N` heading.

---

## When chat-Claude must escalate to Jamie

- A walk-doc finding is ambiguous about *what* should happen (e.g. "product decision — escalate"). Surface it before the fix plan, never inside a fix prompt.
- A fix touches a contract: pricing, billing math, refund netting, payroll. Confirm with Jamie before authoring.
- A finding's fix would require guessing at intent. Read more code first; if still unclear, escalate.
- A migration or edge function change has irreversible production impact (data deletion, RLS that could lock Jamie out). Confirm before pushing.

Escalations go into `STATUS.md` under "Awaiting Jamie decision" and stay there until answered.

---

## Archive policy

- **Walk docs:** when an area is fully shipped (all HIGH + MED + LOW addressed or formally withdrawn), the walk doc moves to `docs/archive/audit-{YYYY-MM}/` in the same PR that closes the last finding.
- **POLISH_NOTES:** when a quarter ends, the previous quarter's sections move to `docs/archive/polish-{YYYY-Q{N}}/`.
- **Roadmap history:** old "Resuming this work" / "Overall progress" snapshots move to `docs/archive/roadmap-history/` once they're more than 30 days old.

Nothing is deleted. Everything is archived.
