# Project status

**Last updated:** 2026-04-29 (PR: claude/hardcoded-currency-sweep-aZQQj — Batch 2A CC-3 broader sweep)

## Next session handoff

- **Active area:** Area 2 — Parent Portal
- **Current batch:** (none in flight)
- **Last merged PR / branch:** PR #TBD / `claude/hardcoded-currency-sweep-aZQQj`
- **What shipped:** Broader CC-3 hardcoded-currency sweep across 59 files (39 B-1 React/hooks/pages with `?? ''` pattern; 20 B-2 edge functions with validate-and-fail-loudly). Closes CC-F8 mechanically. Pre-flight 123 occurrences across 75 files → post-sweep 45 across 17 files (all Bucket A keeps + 3 inline-justified Keeps in OrganisationTab picker).
- **Lovable after-merge actions:** Deploy 20 edge functions (`auto-pay-reminder-core` shared module via `auto-pay-reminder-3day`/`auto-pay-reminder-1day`; `send-invoice-email-core` shared via `send-invoice-email`/`send-invoice-email-internal`; `create-continuation-run`; `credit-expiry-warning`; `csv-import-execute`; `generate-invoice-pdf`; `installment-upcoming-reminder`; `looopassist-chat`; `looopassist-execute`; `overdue-reminders`; `parent-loopassist-chat`; `process-term-adjustment`; `send-auto-pay-failure-notification`; `send-dispute-notification`; `send-enrolment-offer`; `send-payment-receipt`; `stripe-create-checkout`; `stripe-create-payment-intent`; `stripe-process-refund`; `stripe-webhook`). No migrations to apply.
- **Lovable status:** pending until Jamie confirms
- **Production SQL verification:** (none) — no migrations.
- **App behaviour checks:** After Lovable deploys edge fns, parent-side payment flows still render correct currency on UK org; trigger Stripe payment intent creation → server logs show no "missing currency" 500. If a non-GBP test org is available (EUR/USD), spot-check PortalInvoices renders that org's symbol not £.
- **Next batch in active area:** Batch 2B — make-up flow integrity (J1-F4 cancel-booked-makeup RPC; J1-F1 + J1-F29 audit gap; CC-1 audit gap closure for make-up paths)
- **Next area after this one closes:** Area 3 — Students & guardians (per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Roadmap progress:** Area 1 closed; Area 2 in progress at 4/14 HIGH (broader sweep does not advance HIGH — J1-F15 was already counted in PR #370); Areas 0, 3-16 pending (17 areas total per `LESSONLOOP_PRODUCTION_ROADMAP.md` status table)
- **Next session first instruction:** After PR #TBD merges and Jamie confirms Lovable deployed the 20 listed edge functions, paste Batch 2B's prompt into a fresh Claude Code session.

---

## Active area

**Area 2 — Parent Portal**

- Walk: complete (`docs/audits/2026-04-area-2-parent-portal.md`)
- Findings: 17 HIGH (across 14 fix briefs), 25 MED, ~110 LOW
- Fixes shipped: 4 of 14 HIGH (J5-F11 already-closed; J6-F4 + J6-F5 RLS lockdown — PR #367; J8-F9 + J8-F8 RLS lockdown + edge fn validation — PR #367 + follow-up PR #368; J1-F15 portal currency — Lovable 37163c52 + docs PR #370). Plus 3 LOW closed alongside (J3-F2, J3-F10, J3-F15-currency); CC-F8 closed by Batch 2A this PR; broader CC-3 sweep — this PR.
- Status: 10 of 14 HIGH remaining. Next: Batch 2B — make-up flow integrity (J1-F4 + J1-F1 + J1-F29 + CC-1 make-up audit).

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
