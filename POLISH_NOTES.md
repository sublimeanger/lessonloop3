# LessonLoop production-polish notes

Systematic walk of every feature and function toward QA-ready state. 
Running log. Each entry: what we looked at, what we found, what we 
did, and cross-references to commits / migrations / docs.

Started: 19 April 2026.

---

## Area 1 — Billing

Walked and largely fixed during the 18-19 April 2026 billing coherence 
session. See git tag `billing-v1.0` for the milestone commit.

### What was looked at

Full invariant walk of the billing system:

- Ledger identity (payments − refunds = paid_minor)
- Overpayment behaviour (manual vs Stripe paths)
- Invoice state machine (draft / sent / overdue / paid / void transitions)
- Installment state machine including A3 partially_paid
- Refund behaviour (A4 paid→sent on refund, void composability)
- Void guard (A5 blocks void on partially-paid)
- Parent dashboard outstanding math (A6 invoice-level)
- Closure date exclusion in billing runs
- Rate snapshot immutability at booking time
- Single source of truth for outstanding across 4 parent-facing surfaces
- Idempotency across 4 reminder/auto-pay edge functions

### What was found and fixed

- **Fix 1+4** — new `record_manual_payment` RPC with overpayment hard-reject. 
  Replaces client-side direct INSERTs. New `invoices.overpayment_minor` 
  column captures Stripe overpayment race cases (Stripe charge completes 
  before any guard could fire — ledger must match reality, so accept and 
  flag rather than reject). `recalculate_invoice_paid` now populates 
  `overpayment_minor` on every recalc.
- **Due-date-aware refund reopen** — when a refund reopens a paid invoice 
  whose due date is past, status goes direct to `overdue` rather than 
  `sent`. Applied at all three paid→sent transition sites 
  (`record_stripe_payment` idempotent and main paths + `recalculate_invoice_paid`).
- **Fix 2 (B28)** — `void_invoice` clears `billing_run_id` and defensively 
  voids `partially_paid` installments.
- **Cluster B+ cleanup** — 25 test invoices wiped (15 phantom `paid_minor`, 
  4 voided-with-unrefunded-payments, 6 ledger-stale paid invoices). Zero 
  real customers at time of wipe. Ledger identity confirmed holds across 
  all 345 remaining invoices.
- **Frontend swap** — `RecordPaymentModal` / `useRecordPayment` now calls 
  `record_manual_payment` RPC. Client-side overpayment-confirm UX removed 
  as dead code. Server-side error refocuses amount input for in-place 
  correction.
- **Fix 5a** — `auto-pay-upcoming-reminder` edge function gained 
  same-day dedup via `message_log` + `related_id` grain corrected from 
  `invoice_id` to `installment_id`. Protects against cron re-fire 
  duplicate sends.

### What was found but not fixed yet

- **Tracked — triple reimplementation of per-installment outstanding** 
  (`useInstallmentOutstanding`, `useParentInstallments`, 
  `overdue-reminders`). Currently agree; could drift. Consolidate 
  with a `get_installment_outstanding` RPC. Low priority.
- **Deferred — 27 Bucket B items** from the 17 April audit queue 
  (`BILLING_FIXES_QUEUE.md`). Some wait for C32 family accounts, 
  most are small and should land during the systematic polish pass.
- **Deferred — C50 entity_type plural/singular inconsistency** in 
  audit_log across RPCs and triggers. One consolidation migration.
- **Deferred — C51 audit trigger gap** — 10 billing-adjacent tables 
  (refunds, installments, closures, guardians, etc.) without audit 
  triggers. One consolidation migration.
- **Deferred — Xero fire-and-forget reliability** (original Section 
  3d A3). `accounting.payments` scope live since 17 April but the 
  `xero-sync-payment` edge function is still a no-op. Session 2 
  deliverable or sooner.
- **Pre-existing — `'cancelled'` status references in RPC bodies**. 
  Enum has no `cancelled` value but RPCs defensively reference it. 
  Dead branches. Either add the value or remove the references. 
  Not urgent.

### Invariants verified

See `BILLING_PRODUCTION_READY.md` (to be written) for the full 
invariant register. Summary:

- I1 Ledger identity: holds across all 345 invoices (post Cluster B+ wipe).
- I2 Overpayment bounds: manual path hard-rejects; Stripe path accepts 
  and flags via `overpayment_minor`. Both behaviours intentional and 
  documented.
- I3 Installment sum identity: holds.
- I4 No stranded money: A5 guard prevents creation of new cases; 
  pre-A5 cases cleaned up in Cluster B+ wipe.
- I5 Refund bound: `record_manual_refund` caps at per-payment refundable.
- I6 Invoice status reflects state: holds with new due-date-aware branch.
- I7 Installment status reflects state: A3 three-band logic holds.
- I8 Billing run integrity: B28 fix clears `billing_run_id` on void. 
  Holds.
- I10 Rate snapshot immutability: holds (confirm_makeup_booking 4-level 
  priority chain).
- I11 Closure exclusion: `create-billing-run` consults `closure_dates`.
- I13 Idempotency keys: Stripe path idempotent on provider_reference. 
  All 4 reminder/auto-pay edge functions verified (5a fix closed last gap).
- I16 Single source of truth for outstanding: 4 parent-facing surfaces 
  consume same corrected state.
- I17 Transaction atomicity: `record_manual_payment`, `record_manual_refund`, 
  `record_stripe_payment` all atomic-single-txn.
- I19 Void/refund/cancel composability: `record_manual_refund` rejects 
  void; A5 blocks partial-paid void; `record_stripe_payment` skips void.

### Invariants still to be verified

- I9 Xero sync state — deferred with Xero reliability work
- I12 Audit trail completeness — deferred with C51
- I14/I15 RLS scoping (parent / teacher) — to be walked in Area 9
- I18 Notification consistency — partial, finish in Area 10
- I20 Timezone consistency — separate pass

### Cross-references

- `BILLING_FIXES_QUEUE.md` — full A/B/C/Tracked queue from 17 April audit
- `BILLING_FORENSICS.md` — 17 April audit Sections 1-9 + wrap
- `LESSONLOOP_AUDIT_HANDOVER.md` — 17 April audit handover
- `LOVABLE_CLAUDE_DIVISION.md` — environment/deploy reference
- git tag `billing-v1.0` — billing coherence milestone

---

## Area 2 — Invoicing UX

### Journey 1: Creating a single invoice manually

Walked 19 April 2026. Five real bugs + one legacy naming issue fixed.

#### Fixed
- **F4** Lesson duration guard — From Lessons branch now blocks
  zero/negative duration lessons before submit.
- **F11** Duplicate error toast removed — useCreateInvoice hook's
  onError is the single source of error messaging for invoice
  creation failures.
- **F12** Invoice number in success toast — useCreateInvoice
  onSuccess now surfaces the generated invoice number.
- **F13** Modal close decoupled from payment plan generation —
  invoice create success closes the modal immediately; plan
  generation fires in background with its own error reporting.
- **F18a** onMarkPaid → onRecordPayment rename — stale prop name
  from pre-pivot. No user-facing change; the menu label was
  already "Record Payment".
- **F18b** RecordPaymentModal extended with defaultAmount,
  defaultMethod, installmentId, title, submitLabel, onSuccess
  props. Enables "record full outstanding in one click" pre-fill
  from any caller.
- **F2** Quantity integer-only — line item quantity input now
  enforces whole numbers via HTML step + RHF validate + submit
  guard. Prevents "1.5 hours at £30/hr" antipattern.
- **F6** Past due date warning — dueDate picker shows amber
  inline warning when set to a past date. Creation still allowed
  for legitimate back-dating.
- **Default payment method** — RecordPaymentModal default method
  changed from 'card' to 'bank_transfer' (UK solo-teacher norm).
  Applies only when `defaultMethod` prop is not passed by caller.
- **Allow editing of draft invoices (Q1 answer B)** —
  Commit 3a: `update_invoice_with_items` server RPC with status
  gate, payment-plan-total guard, UPSERT items + credits, audit
  log. Commit 3b: `useUpdateInvoice` hook, `EditInvoiceModal`
  component (forked from CreateInvoiceModal), Edit dropdown item
  in InvoiceList for draft, Edit header button in InvoiceDetail
  for draft. Items section disabled with inline note when
  payment plan attached (UX option A). Issue date now editable
  on edit (not on create). All other fields prefilled from
  existing invoice.
  - **Post-deploy fix (Lovable autonomous)**: our 3a migration
    `20260419005000` had two bugs that Lovable caught and fixed
    via a follow-up migration `20260421080040`:
    1. `invoice_items` INSERT omitted `org_id` (NOT NULL column) —
       function would have errored on first invocation. Fixed by
       adding `_invoice.org_id` to the INSERT.
    2. Audit log `item_count` in the `before` jsonb was queried
       AFTER the DELETE+INSERT had already mutated the table, so
       it reported the new count, not the old. Fixed by removing
       the field.
    Live DB now runs Lovable's corrected version. Our migration
    file remains in-tree as design-rationale documentation.
    Process improvements logged for the polish pass.

#### Filed for later
- F1-F3, F5-F10, F14-F17, F19-F21 — see git log for discussion.
  Ranges from small polish to cross-Journey coherence work.
  Bigger ones (F2 quantity integer, F6 past-due warning,
  client-side invoice number preview) scheduled for Commit 2.
- **Allow edit of draft invoices** — scheduled for Commit 3.
  Requires new edit modal, diff-aware mutation, and likely a
  server RPC for atomic line-item replacement.

### Journey 2 — Billing Run Wizard

Walked 21 April 2026. 6 real bugs + 4 cohesion issues found
across the wizard, hook, and edge function.

#### Fixed (Commit 4a)
- **BR1+BR15** Plan options never reached the edge function —
  the mutation type missing the fields, wizard cast `as any`
  dropping them silently. Plans were never being generated by
  the billing run despite the wizard UI suggesting they would.
  Fixed end-to-end: typed mutation params, removed cast, added
  `plan_enabled` flag.
- **BR7** Preview rate computation didn't read snapshot rate
  from `lesson_participants.rate_minor`, so preview totals
  could disagree with actual invoice totals when rate cards
  changed mid-term. Fixed: `getParticipantRate` now prefers
  snapshot, mirroring the edge function logic. `useUnbilledLessons`
  now selects `rate_minor` from participants.
- **BR14** `skippedForClosure` was computed and stored but
  never surfaced in the UI. Teacher saw "billing complete"
  with no acknowledgement that closure-date lessons were
  excluded. Fixed: dedicated toast + properly typed in
  BillingRunSummary interface.
- **BR8** Preview lesson count is upper-bound only (closure
  exclusion happens server-side). Added inline hint in preview
  card to set expectation. Full client-side closure preview
  deferred to a future polish pass — would duplicate edge
  function logic.

#### To fix (Commit 4b)
- **BR2** Edge function bypasses `create_invoice_with_items` RPC
  with direct table inserts. Risks: orphan invoices on items
  failure, no `is_org_active` subscription gate, no atomic
  per-invoice scope.
- **BR9** Xero sync errors silently swallowed. Failed invoice
  syncs invisible to user. Need per-invoice sync attempt tracking
  via existing `xero_entity_mappings` table.

#### Filed for later
- BR3 Concurrency-safe overlap check (edge function pre-check
  races with insert)
- BR5 Verify `delete_billing_run` RPC matches UI gating
- BR6 Preview/edge re-query difference (small race, accepted)
- BR10 Per-invoice plan failure surfacing in summary
- BR11 Subscription trigger error handling for batch insert
  (resolves itself once Commit 4b lands — RPC enforces `is_org_active`)
- BR12 Configurable due-date default (currently hardcoded 14 days)
- BR13, BR16-BR20 Polish / future features

---

## Process improvements

Discovered during the polish pass — applied to all subsequent
RPC and migration work:

1. **Read the analogous existing RPC end-to-end before writing
   a new one.** Don't assume parity; verify column lists, INSERT
   shapes, RLS patterns. The `update_invoice_with_items` org_id
   bug would have been caught by reading `create_invoice_with_items`
   in full.

2. **Audit log "before" snapshots: capture to local variables at
   the TOP of the function.** Never SELECT inline as part of the
   audit_log INSERT — the function's own writes will have
   invalidated the result. Use a `_pre_X` local variable assigned
   before any DELETE / UPDATE / INSERT.
