# Project status

**Last updated:** 2026-04-29 (Batch 2C / branch `claude/fix-rls-guardian-scoping-Szciu` — term_continuation RLS recursion fix + J1-F31 + defensive rendering)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight) post-merge
- **Last merged PR / branch:** PR #375 / `claude/fix-rls-guardian-scoping-Szciu` (Batch 2C) — open at end of this session, awaiting merge. PR #374 / `claude/fix-makeup-flow-integrity-jshxb` (Batch 2B) — confirmed complete by Lovable 2026-04-29 07:35 UTC.
- **What shipped:** Production-live blank-render in parent portal fixed (CC-F15: term_continuation RLS mutual recursion 42P17 between `term_continuation_runs` and `term_continuation_responses` parent SELECT policies broken via two new SECURITY DEFINER recursion-breaker helpers). J1-F31 closed (multi-org guardian scoping in `respond_to_makeup_offer` + `cancel_booked_makeup`: read waitlist row first to obtain `org_id`, scope guardian lookup by both `user_id` and `org_id`, defensive `IS DISTINCT FROM` check). `SectionErrorBoundary` now wraps `useParentContinuationPending` consumer in both `PortalHome.tsx` and `PortalContinuation.tsx` so a single hook 500 cannot blank the page tree (portal-defense-1).
- **Lovable after-merge actions:** Apply migration `20260514100000_continuation_rls_recursion_fix_and_j1_f31.sql`. (none) for edge functions — no edge fn changes in this batch.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** Required — see PR body Lovable after-merge actions §3 for queries A–E (verify both helpers exist with `prosecdef=true`; both rewritten policies reference the helpers and not cross-table subqueries; `EXPLAIN SELECT 1 FROM term_continuation_runs/responses` no longer raises 42P17; both replaced RPCs include `g.org_id = _entry.org_id` and the defensive `IS DISTINCT FROM` check; pre-existing audit triggers from PR #374 still installed).
- **App behaviour checks:** Parent portal loads in a real browser without HTTP 500 (both as parent and as staff impersonating-parent). Continuation widget renders or shows empty state. DevTools network tab shows 200 on `/term_continuation_runs` and `/term_continuation_responses` requests. If a multi-org test parent exists, cancel/decline/accept a make-up in each org succeeds. Optional: simulate query failure on `useParentContinuationPending` and verify the boundary fallback renders inside the continuation section while the rest of the page renders normally.
- **Next batch in active area:** Batch 2D — J2-F24 location reschedule policy override.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at **8/15 HIGH** (was 7/14; +1 closed, +1 denominator — J1-F31 was newly-discovered and shipped in the same PR that filed it); Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After PR #375 merges and Jamie confirms Lovable applied the migration + ran SQL queries A–E + verified portal load in a real browser, paste Batch 2D's prompt into a fresh Claude Code session.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 18 HIGH (across 15 fix briefs — J1-F31 added in this batch), 25 MED, ~110 LOW + portal-defense-1 (MED, this batch)
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + docs PR #370). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency); CC-F8 closed by Batch 2A PR #373; broader CC-3 sweep — PR #373; J1-F1 + J1-F4 + J1-F29 + CC-1 partial — PR #374; CC-F15 + J1-F31 + portal-defense-1 — this PR.
- Status: 6 of 14 HIGH remaining → 7 of 15 HIGH remaining (J1-F31 newly discovered + closed in this PR). Net: 8/15 HIGH closed. Next: Batch 2D — J2-F24 location reschedule policy override.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT (Jamie's verification method note: portal preview was blanked by CC-F15 recursion, so RPCs were exercised at SQL level — same code path, same SECURITY DEFINER, same triggers). `audit_make_up_waitlist` trigger fired correctly on every state change.

## In flight

- (none — Batch 2C PR open and awaiting merge + Lovable apply + SQL verification)

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
