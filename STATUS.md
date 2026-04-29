# Project status

**Last updated:** 2026-04-29 (PR: claude/fix-makeup-flow-integrity-jshxb — Batch 2B make-up flow integrity)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** Batch 2B — make-up flow integrity (in flight)
- **Last merged PR / branch:** PR #373 / `claude/hardcoded-currency-sweep-aZQQj` (Batch 2A — confirmed complete by Lovable 2026-04-29 06:48 UTC; this PR for Batch 2B is open and awaiting merge)
- **What shipped:** Three Area 2 HIGH findings closed (J1-F1 audit lie on parent decline, J1-F4 silent data integrity on parent cancel-booked-makeup, J1-F29 audit gap on `respond_to_makeup_offer`) plus the make-up + term-continuation portion of CC-1 (audit triggers on `make_up_waitlist` and `term_continuation_responses`). New `cancel_booked_makeup` SECURITY DEFINER RPC routes the parent cancel through `lesson_participants` DELETE so the existing `trg_makeup_participant_removed` restores credit, resets waitlist, and writes audit. `respond_to_makeup_offer` now writes audit_log on both accept and decline. Dead client-side `audit_log` INSERT removed from `PortalHome.executeDecline` (was RLS-blocked).
- **Lovable after-merge actions:** Apply both migrations in filename order: `20260513100000_makeup_flow_integrity_j1_f4_f29.sql` then `20260513100100_audit_triggers_cc1_makeup_continuation.sql`. (none) for edge functions — no edge fn changes in this batch.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** Required — see PR body Lovable after-merge actions §3 for queries A–E (verify `cancel_booked_makeup` RPC exists with `prosecdef=true`; `respond_to_makeup_offer` source contains `'makeup_offer_accepted'` / `'makeup_offer_declined'`; `audit_make_up_waitlist` + `audit_term_continuation_responses` triggers registered; `trg_makeup_participant_removed` still present and unchanged; "Block authenticated insert on audit_log" RLS policy still active).
- **App behaviour checks:** UK org with a booked make-up: parent taps Cancel → lesson disappears from teacher's calendar, student's make-up credit count restored. Parent declines an offered make-up → `audit_log` row with `action='makeup_offer_declined'`. Parent accepts an offered make-up via email link OR inline → `audit_log` row with `action='makeup_offer_accepted'`. Any out-of-band UPDATE on `make_up_waitlist` from staff side → `audit_log` row with `entity_type='make_up_waitlist'`. Any INSERT on `term_continuation_responses` → `audit_log` row with `entity_type='term_continuation_response'`.
- **Next batch in active area:** Batch 2C — TBD by chat-Claude after this PR merges (next candidates from priority list: J2-F24 location reschedule policy override, CC-2 money-math mismatch, J3-F19 refund netting).
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at **7/14 HIGH** (was 4/14; +3 this batch — J1-F1 + J1-F4 + J1-F29); Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After this PR merges and Jamie confirms Lovable applied both migrations + ran SQL queries A–E, paste Batch 2C's prompt into a fresh Claude Code session.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 17 HIGH (across 14 fix briefs), 25 MED, ~110 LOW
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + docs PR #370). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency); CC-F8 closed by Batch 2A PR #373; broader CC-3 sweep — PR #373; J1-F1 + J1-F4 + J1-F29 + CC-1 partial — this PR.
- Status: 7 of 14 HIGH remaining. Next: Batch 2C — TBD after this PR merges.
- **Batch 2A (PR #373) — Lovable status:** confirmed complete 2026-04-29 06:48 UTC. Deployed 22 edge functions (20 named in PR body + 2 downstream importers of `_shared/auto-pay-reminder-core.ts` and `_shared/send-invoice-email-core.ts`).

## In flight

- Batch 2B — make-up flow integrity (this PR; awaiting merge + Lovable apply + SQL verification)

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
