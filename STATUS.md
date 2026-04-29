# Project status

**Last updated:** 2026-04-29 (PR: chore/v2-workflow-bootstrap)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** PR 0 — V2 workflow bootstrap (docs only). Batch 2A (CC-3 broader currency sweep) is queued and will run only after this PR merges.
- **Last merged PR / branch:** PR #370 — docs/area-2-CC-3-portal-currency-closure
- **What shipped:** `WORKFLOW_V2_FAST_HARDENING.md` created at repo root; `START_HERE.md` bootstrap order updated; `WORKFLOW.md` superseded-by-V2 header; `STATUS.md` gets this canonical Next session handoff block.
- **Lovable after-merge actions:** (none)
- **Lovable status:** N/A
- **Production SQL verification:** (none)
- **App behaviour checks:** (none)
- **Next batch in active area:** Batch 2A — CC-3 broader hardcoded-currency sweep across non-portal surfaces. Will be sent as a separate paste-ready prompt by chat-Claude after PR 0 merges.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at 4/14 HIGH; Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After PR 0 merges, paste Batch 2A's prompt into a fresh Claude Code session. Do not run V1 micro-prompts. Do not touch the `chore/polish-notes-stale-placeholders` branch.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 17 HIGH (across 14 fix briefs), 25 MED, ~110 LOW
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + this docs PR). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency).
- Status: 10 of 14 HIGH remaining. In progress: cross-cutting currency sweep (PR 3 admin sites, PR 4 edge functions, PR 5 foundation review).

## In flight

(none)

## Awaiting Jamie decision

(none — all open Area 2 product decisions answered 2026-04-28)

## Recent decisions on file

- **CC-F3** (2026-04-28): Parent-side LoopAssist does NOT ship. Dead-mounted component, hook (`useParentLoopAssist`), and edge function (`parent-loopassist-chat`) to be removed in a future fix PR.
- **J3-F11** (2026-04-28): iOS payment flow → Option C. Email "Pay invoice" links open Safari direct to the invoice's pay page (not the iOS app). In-app unpaid-invoice card opens Safari direct-to-pay-page. No "visit lessonloop.net" wall.
- **J5-F4 / J5-F5** (2026-04-28): Weekly Goal card requires an active child filter to render. No multi-child aggregation.

## Recently closed areas

- **Area 1 — Billing & invoicing** (closed earlier in April 2026 — see `LESSONLOOP_PRODUCTION_ROADMAP.md` §"Area 1")
- **Area 2 — Invoicing UX** (closed earlier in April 2026 — see archived POLISH_NOTES at `docs/archive/polish-2026-q1/`)

## Next up after Area 2

Area 3 — Students & guardians (per roadmap)
