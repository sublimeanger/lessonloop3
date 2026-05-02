# Project status

**Last updated:** 2026-05-02 (Batch 2F — J3-F19 + CC-8 refund-netting sweep + stripe-create-checkout parity; folds CW-F2 closure → Area 1 fully closed)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight). Ready to start Batch 2G.
- **Last merged PR / branch:** PR #<filled at merge time> / `claude/refund-netting-checkout-parity-Huy2V` (Batch 2F).
- **What shipped:** Batch 2F closed CC-8 refund-netting sweep across four sites — J3-F19 (`stripe-create-payment-intent`), J3-F19b (both invoice PDF renderers), J3-F19c (`stripe-create-checkout` brought to full parity with sibling). New shared module `_shared/invoice-amount-due.ts` consolidates `invoiceAmountDue()`, `installmentOutstanding()`, `PENDING_INSTALLMENT_STATUSES`. Two new HIGH findings filed (J3-F19b, J3-F19c) and closed in same PR. Also folds the CW-F2 closure confirmation (constraint validated 2026-05-02 by Jamie via direct Lovable migration `20260502071153_cw_f2_payer_xor_cleanup_and_validate.sql` — Area 1 Batch 1Z fully closed).
- **Filed for Area 1 follow-up (not closed in this PR):** grep-D verification surfaced two same-bug-class staff-side refund-blind sites that the consolidation didn't cover: `src/components/invoices/RecordPaymentModal.tsx:75-76` (staff manual-payment modal prefill under-states outstanding by refund amount) and `src/pages/InvoiceDetail.tsx:188-189` (staff invoice detail page header same shape). Both are pure browser React, staff-facing, Area 1 territory; out-of-scope for Area 2 Batch 2F. Filed for chat-Claude to formalize as Area 1 follow-up findings (one-line fix per site: `totalPaid = invoice?.paid_minor ?? 0`).
- **Lovable after-merge actions:** Apply (none — no migrations); deploy `stripe-create-payment-intent`, `stripe-create-checkout` (both directly changed), plus downstream importers of `_shared/invoice-pdf.ts` (`generate-invoice-pdf`, `send-payment-receipt`). Run production SQL verification queries A–C in PR body. App behaviour spot-checks: see PR body §3.4.
- **Lovable status:** pending until Jamie confirms.
- **Production SQL verification:** required (queries A–C in PR body §3.3).
- **App behaviour checks:** required (3 spot-checks: simple invoice with refund history; payment-plan invoice on partially-paid installment; PDF rendering of partially-refunded invoice).
- **Next batch in active area:** Batch 2G — pick from remaining HIGHs. Recommendation: J4-F13 (parent's own messages invisible) — discrete RLS migration + hook rewrite, named in audit priority list as "high-confidence one-shot." Or a tiny Area 1 follow-up batch closing the two staff-side refund-blind sites (one-liner per file).
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table).
- **Roadmap progress:** Area 1 closed (canary-walk verified, fix-pass shipped, CW-F2 fully validated 2026-05-02); Area 2 in progress at **14/17 HIGH** (was 11/15; +1 J3-F19, +2 J3-F19b/c, denominator increased to 17 by the two new HIGH findings); Areas 0, 3–16 pending.
- **Next session first instruction:** Read `docs/HANDOVER_2026-05-02.md` for full project context if this is a fresh session. Otherwise, proceed to Batch 2G — chat-Claude will write the prompt when Jamie says go. The two staff-side refund-blind sites (`RecordPaymentModal.tsx`, `InvoiceDetail.tsx`) are documented in this PR's POLISH_NOTES and PR body for chat-Claude to slot.

---

## Active area

**Area 2 — Parent Portal (resumed; Area 1 fully closed)**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 20 HIGH raw (across 17 fix briefs — J1-F31 added in earlier batches; J3-F19b + J3-F19c added in Batch 2F), 25 MED, ~110 LOW + portal-defense-1 (MED).
- Fixes shipped: 14 of 17 HIGH (Batches 2A–2F). Net: 14/17 HIGH closed. Next: Batch 2G (TBD; recommendation J4-F13).
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass.
- **Batch 2D (PR #376) — Lovable status:** confirmed complete 2026-04-29 UTC. All 5 tests PASS against Crescendo Music Agency demo org. DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity.
- **Batch 2E (PR #377) — Lovable status:** confirmed complete 2026-04-29 23:42 UTC. Mixed-payer parent verification PASS (Helen Douglas, +£80 recovered); regression PASS on single-payer parent. Helen Douglas (demo-parent-3) household with the £80 CC2-TEST invoice for Lily Douglas left in place as permanent mixed-payer test data.
- **Batch 2F (this PR) — Lovable status:** pending until Jamie confirms. CC-8 refund-netting four-site sweep via consolidation into `_shared/invoice-amount-due.ts`. J3-F19 + new HIGH J3-F19b + new HIGH J3-F19c.

**Area 1 — Billing & invoicing (fully closed; canary-walk verified)**

- Walk: complete (`docs/audits/2026-04-area-1-canary-walk.md`)
- Findings: 13 total (3 original HIGH + 2 MED + 5 LOW from Sessions 1–4; CW-F11 re-characterised + CW-F12 NEW HIGH + CW-F13 NEW LOW from Session 6).
- Fixes shipped via Batch 1Z (PR #378 → PR #379 corrected re-apply → Session 6 follow-on): CW-F1 (MED), CW-F2 (HIGH), CW-F3 (HIGH), CW-F4 (MED — STATEMENT-level via split triggers), CW-F6 (LOW), CW-F9 (HIGH — auto-allocate + drift backfill + one-row remediation). 6 of 6 in-scope findings closed.
- Filed for Track 0.X: CW-F5, CW-F7, CW-F10, CW-F12 (HIGH-NEW). CW-F11 → NO-OP (defensive branch handles a real status). CW-F13 → already remediated, no code fix needed (`record_manual_payment` going forward doesn't produce the legacy shape).
- **Batch 1Z status:** Closed 2026-05-02. PR #378 → original migration rolled back twice with PostgreSQL 0A000 → PR #379 corrected re-apply with split triggers (verified end-to-end against PostgreSQL 16.13 in chat-Claude's sandbox before authoring) → Session 6 follow-on with CW-F9 LL-2026-00008 remediation + Step 4 trigger sanity test. Audit doc updated through Session 6.
- ~~**Pending:** 7 CW-F2 row resolutions + `VALIDATE CONSTRAINT`.~~ **CW-F2 fully closed 2026-05-02:** all 7 violating rows resolved via Lovable-applied migration `20260502071153_cw_f2_payer_xor_cleanup_and_validate.sql` (5 BOTH_SET cleared payer_student_id, 2 NEITHER_SET deleted); constraint convalidated = true; **Area 1 fully closed.**

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
