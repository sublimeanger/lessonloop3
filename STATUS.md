# Project status

**Last updated:** 2026-05-02 (Batch 2F-followup — J3-F19d staff-side refund netting; CC-8 cluster fully closed across all five surfaces)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight). Ready to start Batch 2G.
- **Last merged PR / branch:** PR #<filled at merge time> / `claude/refund-netting-staff-DUswW` (Batch 2F-followup).
- **What shipped:** Batch 2F-followup closed J3-F19d — two staff-side React surfaces (`RecordPaymentModal`, `InvoiceDetail`) brought into refund-netting consistency with Batch 2F's edge-fn and PDF fixes. Closes the CC-8 cluster fully across all surfaces (edge fns, PDF mirrors, staff React). Two-line diff total.
- **Lovable after-merge actions:** No edge function deploys (frontend-only). No migrations. Production SQL verification not required (no schema or RPC change). App behaviour spot-check required (1 check — see PR body §3.4).
- **Lovable status:** pending until Jamie confirms.
- **Production SQL verification:** not required.
- **App behaviour checks:** required (1 spot-check on `RecordPaymentModal` against a partially-refunded invoice).
- **Next batch in active area:** Batch 2G — recommend J4-F13 (parent's own messages invisible) or J5-F3 (milestones server-side compute), chat-Claude to write prompt.
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table).
- **Roadmap progress:** Area 2 at **15/18 HIGH** (J3-F19d closed, denominator increased to 18). Area 1 closed. Areas 0, 3–16 pending.
- **Next session first instruction:** Read `docs/HANDOVER_2026-05-02.md` if fresh session. Otherwise: chat-Claude writes Batch 2G prompt when Jamie says go.

---

## Active area

**Area 2 — Parent Portal (resumed; Area 1 fully closed)**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 20 HIGH raw (across 17 fix briefs — J1-F31 added in earlier batches; J3-F19b + J3-F19c added in Batch 2F; J3-F19d added in Batch 2F-followup), 25 MED, ~110 LOW + portal-defense-1 (MED).
- Fixes shipped: 15 of 18 HIGH (Batches 2A–2F + 2F-followup). Net: 15/18 HIGH closed. Next: Batch 2G (TBD; recommendation J4-F13).
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).
- **Batch 2B (PR #374) — Lovable status:** confirmed complete 2026-04-29 07:35 UTC. All three behaviour spot-checks (cancel booked make-up; decline offered make-up; accept offered make-up) passed end-to-end via impersonated parent JWT.
- **Batch 2C (PR #375) — Lovable status:** confirmed complete 2026-04-29 12:05 UTC. Migration applied; queries A–E pass; recursion-proof SQL pass.
- **Batch 2D (PR #376) — Lovable status:** confirmed complete 2026-04-29 UTC. All 5 tests PASS against Crescendo Music Agency demo org. DOM extraction across 32 lesson cards confirmed per-row resolver correctness; live override flip in Test 5 confirmed reactivity.
- **Batch 2E (PR #377) — Lovable status:** confirmed complete 2026-04-29 23:42 UTC. Mixed-payer parent verification PASS (Helen Douglas, +£80 recovered); regression PASS on single-payer parent. Helen Douglas (demo-parent-3) household with the £80 CC2-TEST invoice for Lily Douglas left in place as permanent mixed-payer test data.
- **Batch 2F — Lovable status:** pending until Jamie confirms. CC-8 refund-netting four-site sweep via consolidation into `_shared/invoice-amount-due.ts`. J3-F19 + new HIGH J3-F19b + new HIGH J3-F19c.
- **Batch 2F-followup (this PR) — Lovable status:** pending until Jamie confirms. Frontend-only two-line diff closing J3-F19d (staff-side React mirror). No migrations, no edge fn deploys.

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
