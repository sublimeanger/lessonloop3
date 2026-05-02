# Project status

**Last updated:** 2026-05-02 (Batch 1Z close-out doc sync + project handover — docs-only PR; Batch 1Z fully closed)

## Next session handoff

- **Active area:** Area 2 — Parent Portal (resumes — Batch 1Z fully closed)
- **Current batch:** (none in flight). Ready to start Batch 2F.
- **Last merged PR / branch:** PR #379 / `claude/fix-transition-table-aCFuY` (Batch 1Z corrective re-apply). Followed by two one-shot migrations applied directly to production: `20260502060707_…_cw_f9_ll_2026_00008_remediation.sql` (one-row data fix for residual CW-F9 drift) and `20260502060816_…_cw_f4_trigger_sanity_test.sql` (self-cleaning Step 4 verification).
- **What shipped:** Batch 1Z corrective re-apply closed CW-F1, CW-F2 (NOT VALID), CW-F3, CW-F4 (statement-level via split triggers), CW-F6, CW-F9. Follow-on migrations resolved residual CW-F9 drift on LL-2026-00008 and verified the CW-F4 trigger refactor empirically (pdf_rev bumps by exactly 1 on each of items / installments / payments). Three new findings filed in the audit doc: CW-F11 revised (LOW → NO-OP, defensive branch is correct), CW-F12 (NEW HIGH — `invoice_installments.status` is unconstrained text, deferred to Track 0.X), CW-F13 (NEW LOW — CW-F9 backfill skipped legacy `status='paid'`-without-payment installments, one-row remediation already shipped).
- **Lovable after-merge actions:** None for this docs-only PR. **For Batch 1Z full closure:** Jamie inspects 7 CW-F2 violating rows (5 in Jamie's own org with both payer columns set; 2 in E2E Test Academy with neither), decides each row's disposition (UPDATE to set the correct payer column, OR DELETE if orphaned), then runs `ALTER TABLE invoices VALIDATE CONSTRAINT invoices_payer_xor;`. This is independent of any future batch — can happen any time.
- **Lovable status:** N/A (docs-only PR; nothing for Lovable to apply or deploy).
- **Production SQL verification:** N/A.
- **App behaviour checks:** N/A.
- **Next batch in active area:** Batch 2F — J3-F19 refund netting in `stripe-create-payment-intent`. Single edge-fn-only fix; closes the J3 cluster; advances Area 2 from 11/15 to 12/15 HIGH closed.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table).
- **Roadmap progress:** Area 1 closed (canary-walk verified, fix-pass shipped via PR #378 + corrected re-apply via PR #379 + Session 6 follow-on); Area 2 in progress at **11/15 HIGH**; Areas 0, 3–16 pending.
- **Next session first instruction:** Read `docs/HANDOVER_2026-05-02.md` for full project context if this is a fresh session. Otherwise, proceed to Batch 2F: J3-F19 refund netting in `stripe-create-payment-intent`. The Batch 2F prompt has not yet been authored — chat-Claude will write it when Jamie says go.

---

## Active area

**Area 2 — Parent Portal (resumed; Area 1 fully closed)**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 18 HIGH (across 15 fix briefs — J1-F31 added in earlier batches), 25 MED, ~110 LOW + portal-defense-1 (MED).
- Fixes shipped: 11 of 15 HIGH (Batches 2A–2E). Net: 11/15 HIGH closed. Next: Batch 2F — J3-F19 refund netting in `stripe-create-payment-intent`.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass.
- **Batch 2D (PR #376) — Lovable status:** confirmed complete 2026-04-29 UTC. All 5 tests PASS against Crescendo Music Agency demo org. DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity.
- **Batch 2E (PR #377) — Lovable status:** confirmed complete 2026-04-29 23:42 UTC. Mixed-payer parent verification PASS (Helen Douglas, +£80 recovered); regression PASS on single-payer parent. Helen Douglas (demo-parent-3) household with the £80 CC2-TEST invoice for Lily Douglas left in place as permanent mixed-payer test data.

**Area 1 — Billing & invoicing (closed; canary-walk verified)**

- Walk: complete (`docs/audits/2026-04-area-1-canary-walk.md`)
- Findings: 13 total (3 original HIGH + 2 MED + 5 LOW from Sessions 1–4; CW-F11 re-characterised + CW-F12 NEW HIGH + CW-F13 NEW LOW from Session 6).
- Fixes shipped via Batch 1Z (PR #378 → PR #379 corrected re-apply → Session 6 follow-on): CW-F1 (MED), CW-F2 (HIGH — CHECK NOT VALID; awaits Jamie's row resolution + VALIDATE), CW-F3 (HIGH), CW-F4 (MED — STATEMENT-level via split triggers), CW-F6 (LOW), CW-F9 (HIGH — auto-allocate + drift backfill + one-row remediation). 6 of 6 in-scope findings closed.
- Filed for Track 0.X: CW-F5, CW-F7, CW-F10, CW-F12 (HIGH-NEW). CW-F11 → NO-OP (defensive branch handles a real status). CW-F13 → already remediated, no code fix needed (`record_manual_payment` going forward doesn't produce the legacy shape).
- **Batch 1Z status:** Closed 2026-05-02. PR #378 → original migration rolled back twice with PostgreSQL 0A000 → PR #379 corrected re-apply with split triggers (verified end-to-end against PostgreSQL 16.13 in chat-Claude's sandbox before authoring) → Session 6 follow-on with CW-F9 LL-2026-00008 remediation + Step 4 trigger sanity test. Audit doc updated through Session 6.
- **Pending:** 7 CW-F2 row resolutions + `VALIDATE CONSTRAINT`. Decoupled from any future batch; can happen any time. 5 in Jamie's own org with both payer columns set; 2 in E2E Test Academy with neither.

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
