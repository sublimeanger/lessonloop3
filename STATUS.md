# Project status

**Last updated:** 2026-05-01 (Batch 1Z corrected re-apply / branch `claude/fix-transition-table-aCFuY` — Area 1 canary walk fix-pass corrective; supersedes PR #378's rolled-back migration)

## Next session handoff

- **Active area:** Area 1 (canary walk fix-pass corrected re-apply in flight); reverts to Area 2 — Parent Portal once this PR merges + Lovable confirms apply + queries A–H pass.
- **Current batch:** (none in flight) post-merge — this PR ships the corrective Batch 1Z re-apply only.
- **Last merged PR / branch:** PR #378 / `claude/area-1-canary-walk-batch-1z-amYwa` (original Batch 1Z). Lovable status: rolled back twice (PostgreSQL 0A000 on CW-F4 transition-table syntax). Sections 1 (CW-F3), 2 (CW-F9), 4 (CW-F2), 5 (CW-F1) un-applied; original per-row pdf_rev triggers remain in production.
- **What shipped:** Corrected Batch 1Z migration (`supabase/migrations/20260516110000_canary_walk_batch_1z_corrected.sql`). Splits CW-F4 trigger refactor into 9 event-specific functions + 9 triggers across `invoice_items`, `invoice_installments`, `payments` (one INSERT trigger per surface, one UPDATE, one DELETE — each declaring only its own transition tables). Sections 1, 2, 4, 5 byte-identical to PR #378's broken file (already idempotent — safe to re-run regardless of partial-state). Pattern verified end-to-end against PostgreSQL 16.13 in a sandbox before authoring.
- **Lovable after-merge actions:** Apply `supabase/migrations/20260516110000_canary_walk_batch_1z_corrected.sql`. Deploy `supabase/functions/create-billing-run` (CW-F6 fix from PR #378; was deferred during the failed apply). After CW-F2 row resolution, run `ALTER TABLE invoices VALIDATE CONSTRAINT invoices_payer_xor;`.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** Required — see PR body §3 for queries A–H (CW-F4 new triggers in place; old combined per-row triggers gone; CW-F9 drift resolved; CW-F1 demoted; CW-F2 violating row enumeration; CIWI auth carve-out present; record_manual_payment auto-allocate present; CW-F4 trigger sanity self-cleaning DO block).
- **App behaviour checks:** (optional) edit any draft invoice via staff UI — add 2 items in one save action, verify pdf_rev increments by exactly 1 (not 2); trigger any active recurring template's "Run now" via the staff UI and confirm it generates invoices without "Not authorised".
- **Next batch in active area:** Batch 2F — J3-F19 refund netting in stripe-create-payment-intent (resumes Area 2 after this corrective re-apply confirms).
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed (canary-walk verified, fix-pass re-applied via this PR); Area 2 in progress at **11/15 HIGH**; Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After this PR merges and Lovable confirms apply + queries A–H pass + Jamie resolves the 7 CW-F2 rows + runs `VALIDATE CONSTRAINT`, paste Batch 2F's prompt into a fresh Claude Code session.

---

## Active area

**Area 1 — Billing & invoicing (canary walk fix-pass — corrected re-apply in flight)**

- Walk: complete (`docs/audits/2026-04-area-1-canary-walk.md`)
- Findings: 10 (3 HIGH, 2 MED, 5 LOW); Batch 1Z closes 6 (CW-F1, CW-F2 NOT VALID + Jamie's row resolution + VALIDATE pending, CW-F3, CW-F4, CW-F6, CW-F9); 4 LOW filed in POLISH_NOTES under Track 0.X candidates (CW-F5, CW-F7, CW-F10, CW-F11).
- Status: Area 1 canary-walk closure verified. Reverts to Area 2 active once corrective Batch 1Z PR merges + Lovable confirms.
- **Batch 1Z (PR #378) — Lovable status:** rolled back twice (PostgreSQL 0A000 on CW-F4 transition-table syntax — `INSERT OR UPDATE OR DELETE` combined with `REFERENCING NEW TABLE / OLD TABLE` on a single trigger; Postgres requires one event per trigger when transition tables are declared). Sections 1 (CW-F3), 2 (CW-F9), 4 (CW-F2), 5 (CW-F1) un-applied; original per-row pdf_rev triggers remain in production. Re-apply via `claude/fix-transition-table-aCFuY` corrected branch.

**Area 2 — Parent Portal (returns active after Batch 1Z lands)**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 18 HIGH (across 15 fix briefs — J1-F31 added in earlier batches), 25 MED, ~110 LOW + portal-defense-1 (MED).
- Fixes shipped: 11 of 15 HIGH (Batches 2A–2E). Net: 11/15 HIGH closed. Next: Batch 2F — J3-F19 refund netting in stripe-create-payment-intent.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT (Jamie's verification method note: portal preview was blanked by CC-F15 recursion, so RPCs were exercised at SQL level — same code path, same SECURITY DEFINER, same triggers). `audit_make_up_waitlist` trigger fired correctly on every state change.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass (with caveat: `read_query` role bypasses RLS, so the proof is weaker than initially framed — the canonical proof is the real-browser GET on `/rest/v1/term_continuation_responses` under parent JWT, which returned 200 for `demo-parent-1` from the previously-blank `/portal/home` route). `SectionErrorBoundary` visible at `PortalHome.tsx:322`. Linter findings unchanged at 258, all pre-existing; all four functions touched have `proconfig=[search_path=public]`.
- **Batch 2D (PR #376) — Lovable status:** confirmed complete 2026-04-29 UTC. All 5 tests PASS against Crescendo Music Agency demo org (org policy `self_service`; locations: Crescendo Central=NULL, Crescendo North=`admin_locked`, Online=`request_only`). DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity (`admin_locked → self_service` flipped lesson UI on hard refresh).
- **Batch 2E (PR #377) — Lovable status:** confirmed complete 2026-04-29 23:42 UTC. Mixed-payer parent verification PASS (Helen Douglas, +£80 recovered); regression PASS on single-payer parent. Helen Douglas (demo-parent-3) household with the £80 CC2-TEST invoice for Lily Douglas left in place as permanent mixed-payer test data — see POLISH_NOTES Batch 2E entry for asset note.

## In flight

- Batch 1Z corrected re-apply (Area 1 canary walk fix-pass corrective) — PR open on `claude/fix-transition-table-aCFuY`; awaiting merge + Lovable apply of `20260516110000_canary_walk_batch_1z_corrected.sql` + deploy of `create-billing-run` + queries A–H + Jamie's CW-F2 row resolution + VALIDATE CONSTRAINT.

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
