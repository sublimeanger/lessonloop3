# Project status

**Last updated:** 2026-04-29 (Batch 2E / branch `claude/fix-money-math-mismatch-WEYJL` — CC-2 money-math mismatch closing J1-F17 + J3-F7 + CC-F7)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight) post-merge
- **Last merged PR / branch:** PR #377 / `claude/fix-money-math-mismatch-WEYJL` (Batch 2E) — open at end of this session, awaiting merge. Batch 2D (PR #376) — confirmed complete 2026-04-29 UTC; 5/5 tests PASS against Crescendo Music Agency demo org (org policy `self_service`; locations Crescendo Central=NULL, Crescendo North=`admin_locked`, Online=`request_only`); DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity (`admin_locked → self_service` flipped lesson UI on hard refresh).
- **What shipped:** J1-F17 + J3-F7 + CC-F7 closed. `get_parent_dashboard_data` RPC replaced so all three guardian-level aggregates (outstanding/overdue_count/oldest_unpaid) OR both payer types scoped to the parent's children. `useParentInvoices` hook adds a student_guardians lookup before the invoices query and uses the same OR-filter. `parent-loopassist-chat` edge function uses the same OR-filter (studentIds was already in scope). Per-child aggregate inside the RPC intentionally untouched (student-only is correct semantically).
- **Lovable after-merge actions:** Apply `supabase/migrations/20260515100000_cc2_money_math_mixed_payer.sql`. Deploy `supabase/functions/parent-loopassist-chat`.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** Required — see PR body Lovable after-merge actions §3 for queries A–D (function exists with same signature + STABLE SECURITY DEFINER + `proconfig=[search_path=public]`; `prosrc` contains the OR-clauses 3 times; empirical mixed-payer parent test; pre-fix delta sanity).
- **App behaviour checks:** Mixed-payer test parent sees correct outstanding totals across both payer types on dashboard, invoice list, and LoopAssist response. Single-payer parent unchanged.
- **Next batch in active area:** Batch 2F — J3-F19 refund netting in stripe-create-payment-intent.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at **11/15 HIGH** (was 9/15; +J1-F17 +J3-F7); Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After PR #377 merges and Jamie confirms Lovable applied the migration + deployed the edge fn + verified mixed-payer behaviour, paste Batch 2F's prompt into a fresh Claude Code session.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 18 HIGH (across 15 fix briefs — J1-F31 added in this batch), 25 MED, ~110 LOW + portal-defense-1 (MED, this batch)
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + docs PR #370). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency); CC-F8 closed by Batch 2A PR #373; broader CC-3 sweep — PR #373; J1-F1 + J1-F4 + J1-F29 + CC-1 partial — PR #374; CC-F15 + J1-F31 + portal-defense-1 — PR #375; J2-F24 — PR #376; J1-F17 + J3-F7 + CC-F7 — this PR.
- Status: 4 of 15 HIGH remaining (was 6; J1-F17 and J3-F7 closed, both HIGH). Net: 11/15 HIGH closed. Next: Batch 2F — J3-F19 refund netting in stripe-create-payment-intent.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT (Jamie's verification method note: portal preview was blanked by CC-F15 recursion, so RPCs were exercised at SQL level — same code path, same SECURITY DEFINER, same triggers). `audit_make_up_waitlist` trigger fired correctly on every state change.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass (with caveat: `read_query` role bypasses RLS, so the proof is weaker than initially framed — the canonical proof is the real-browser GET on `/rest/v1/term_continuation_responses` under parent JWT, which returned 200 for `demo-parent-1` from the previously-blank `/portal/home` route). `SectionErrorBoundary` visible at `PortalHome.tsx:322`. Linter findings unchanged at 258, all pre-existing; all four functions touched have `proconfig=[search_path=public]`.
- **Batch 2D (PR #376) — Lovable status:** confirmed complete 2026-04-29 UTC. All 5 tests PASS against Crescendo Music Agency demo org (org policy `self_service`; locations: Crescendo Central=NULL, Crescendo North=`admin_locked`, Online=`request_only`). DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity (`admin_locked → self_service` flipped lesson UI on hard refresh).

## In flight

- (none — Batch 2E PR open and awaiting merge)

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
