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

_(All items below resolved in Commit 4b — see Fixed section.)_

#### Fixed (Commit 4b)
- **BR2** Edge function now calls `create_invoice_with_items`
  RPC per-payer instead of direct batch INSERTs. Consequences:
  - Each invoice atomic (items always land with their invoice)
  - `is_org_active` subscription gate now enforced (BR11
    self-resolved)
  - Per-payer error surfacing cleaner
  - Cost: slower (N RPC calls vs 2 batch inserts), acceptable
    tradeoff for correctness
  - Also added: post-RPC UPDATE to set billing_run_id + term_id
    (RPC doesn't accept these); if UPDATE fails, orphan invoice
    deleted
- **BR9** Xero sync attempts now tracked in `xero_entity_mappings`
  table. Pre-flight upsert seeds 'pending' rows for every invoice
  in the run; per-invoice sync function updates to 'synced' or
  'failed' with error_message. Network-level failures captured
  by orchestrator. Data trail exists for future UI surfacing
  of retry affordance.
- **BR10 partial** Per-invoice payment plan failures now logged
  (not just console.error). Count surfaced in logs; future
  commit can thread this into the summary for UI display.
- **BR11** Self-resolved via BR2 — `create_invoice_with_items`
  enforces `is_org_active`, so expired-trial orgs now fail
  cleanly at the first RPC call rather than succeeding via
  direct insert and failing later.

#### Fixed (Commit 5)
- **BR3** Concurrency-safe overlap prevention via exclusion
  constraint on billing_runs (`EXCLUDE USING gist`, keyed on
  org_id + daterange). Requires btree_gist extension. Pre-flight
  overlap SELECT kept for UX reasons (better error message than
  bare 23505) but the real safety is now at the DB layer.
- **BR5** `delete_billing_run` RPC now refuses ANY non-draft
  invoice in the run — not just paid. Teacher must void sent/
  overdue invoices individually first so each void has its own
  audit trail. UI dialog copy updated to match.
- **BR12** Edge function reads `organisations.default_payment_terms_days`
  (existing column, default 14) instead of hardcoded 14. Org
  can now configure the default due-date offset. Settings UI
  to surface this deferred — column + edge function wiring
  closed the gap for billing runs.

**Journey 2 closed** (21 April 2026).

10 real bugs fixed across 3 commits (4a / 4b / 5). Live state
verified. Filed for later: BR6 preview/edge re-query race
(accepted), BR10-full per-invoice plan failure summary surfacing,
BR13 shared payer-group helper, BR16 batch-insert numbering order
(accepted), BR17-BR20 polish/feature work.

#### Filed for later
- BR6 Preview/edge re-query difference (small race, accepted)
- BR13, BR16-BR20 Polish / future features

### Journey 3 — Sending an invoice

Walked 21 April 2026. 18 findings across client modal + edge
function. 5 bugs + 2 paste-artifact false alarms + 11 cohesion/
filed items.

#### Fixed (Commit 6)
- **J3-F1** `message_log.recipient_type` was hardcoded to
  'guardian' even when payer was a student. Now derived from
  actual payer. `recipient_id` also populated (was null before).
- **J3-F2** 5-minute idempotency debounce on send. Server checks
  message_log for any `status='sent'` row with same `related_id`
  + `message_type` within the last 5 minutes; rejects with 409
  `already_sent` if found. Prevents double-click and impatient-
  retry duplicate sends. Window short enough to still allow
  legitimate re-sends after bounce.
- **J3-F3** `send-invoice-reminder` rate-limit bucket split from
  `send-invoice-email`. Both at 50/hr. A teacher sending initial
  invoices no longer throttles their ability to chase overdue
  payments.
- **J3-F10** Client now handles server-returned error bodies
  (400/409/502). Previously `supabase.functions.invoke` only
  surfaced transport failures; server-returned errors came back
  with `data.error` populated but `sendError: null`, treated as
  success. Fixed by checking `data.error` inline.
- **J3-F18** No-email alert copy now respects `isReminder` prop
  (was hardcoded "send the invoice" regardless).

#### Not bugs (paste artifacts in inventory)
- **J3-F6** escapeHtml function fine in source — Lovable's paste
  stripped the regex escapes.
- **J3-F9** JSX structure fine in source — same paste artifact.

#### Fixed (Commit 7)
- **J3-F8** Preview parity via server-side render mode. Edge
  function now accepts `preview=true` flag — renders the full
  HTML (branding, bank details, installment schedule, portal
  links) and returns without sending, logging, or flipping
  status. Client replaces local `buildPreviewHtml` +
  `escapeHtml` with a fetch to the edge function. Source of
  truth for email HTML is now the edge function exclusively —
  no duplicate logic to maintain. Side wins: preview now shows
  recent-send warning banner if invoice was sent within the
  last 5 minutes (still allows closing the modal, disables the
  Send button); preview footer copy changed from "Bank details
  will also be included" to "This preview shows the exact
  email your recipient will receive" reflecting the parity.

#### Fixed (Commit 8 — bulk surface overhaul)
- **J3-F14a CRITICAL** Bulk send now actually sends emails.
  Previous implementation only flipped status to 'sent' via direct
  update — no email, no message_log, no retry, parents received
  nothing. Silent data lie. Now invokes send-invoice-email per
  invoice with full code path parity.
- **J3-F14b CRITICAL** Bulk void now uses void_invoice RPC.
  Previous direct status update bypassed billing_run_id clearing,
  partially_paid defensive handling, and audit logging — all of
  which the RPC handles atomically.
- **J3-F14d** Selection preserved on partial bulk failures. Failed
  invoices stay selected for retry; successful ones deselected.
  Toast surfaces a sample failure reason rather than just counts.
- **J3-F14g + J3-F14h + J3-F14i** Bulk void confirmation dialog
  hardened: shows status breakdown (draft / sent / overdue counts),
  amber warning when selection includes sent/overdue invoices
  ("parents have been emailed — voiding will not notify them"),
  and an inline list of the first 10 invoice numbers being
  voided. No more "Void 8" with zero context.
- **Dead code removed** processInChunks helper deleted now both
  bulk operations have their own per-invoice loops with result
  tracking.

#### Filed (won't fix this pass)
- **J3-F14c** Concurrency tuning. CHUNK_SIZE=5 is conservative;
  could be raised once Resend tier confirmed. Current setup safe
  under 50/hr per-user rate limit.
- **J3-F14e** Bulk-send mid-flight interruption — covered by
  J3-F2 5-min debounce (re-clicks on already-sent invoices return
  409, treated as "fail" in counts but harmless).
- **J3-F4, J3-F5, J3-F11, J3-F12, J3-F15-17** Unchanged from
  prior filed list.

**Journey 3 closed (21 April 2026).** 19 findings, 14 fixed across
4 commits (6, 7, 7-followup, 8). 5 filed. Bulk surface now sends
real emails, voids via proper RPC, preserves failed selections,
and warns on destructive actions affecting parent-facing invoices.

#### Filed for later
- **J3-F4** message_log insert failure is warn-only; consider
  surfacing to caller
- **J3-F5** No PDF attachment — emails ship portal link only.
  UK UX gap for tax-archive use case. Product decision.
- **J3-F11** `related_id` always points to invoice, never
  installment (even for payment-plan reminders). Cosmetic.
- **J3-F12** Status flip (draft→sent) happens AFTER email send.
  If email succeeds but status update fails, teacher sees
  "sent" toast, invoice stays draft, resends duplicate. Needs
  atomicity or reconciliation. Architectural, filed.
- **J3-F15** No unsubscribe link (legally fine for transactional)
- **J3-F16** Hardcoded `billing@lessonloop.net` sender
- **J3-F17** No email open/click tracking
- **J3-F19** Rate-limit config has three-o typos
  (`looopassist-chat`, `looopassist-execute`) — not our Journey
  3 concern but flagged

### Journey 4 — Managing existing invoice

Walked 21 April 2026. 29 findings across InvoiceDetail.tsx +
RefundDialog + useRefund + useInvoicePdf + stripe-process-refund +
stripe-webhook charge.refunded handler + InvoiceList. 12 fixed
across 7 commits. 17 filed.

#### Fixed (Commit 1 of 7 — RecordPaymentModal state)

- **J4-F5** Reset effect now keys on `invoice?.id` as well as
  `open`/`defaultAmount`/`defaultMethod` — stale amount survived
  invoice swaps while modal was mounted. Also resets `reference`
  on open (previously only cleared after successful submit).

#### Fixed (Commit 2 of 7 — shared paymentUtils)

- **J4-F8** Three sites in InvoiceDetail duck-typed
  `payment.provider === 'stripe' && payment.provider_reference`
  for Stripe vs manual classification. Extracted to
  `src/lib/paymentUtils.ts`: `isStripePayment`, `isManualPayment`,
  `refundedForPayment`, `getFirstRefundablePayment`,
  `hasRefundablePayment`. Fragile inline checks had a latent
  mis-classification for Stripe payments missing
  `provider_reference`.
- Also fixed a latent bug in the `?action=refund` auto-open flow:
  it checked only the FIRST payment for refundable balance, not
  the first REFUNDABLE payment. A fully-refunded first payment
  silently aborted the dialog open.

#### Fixed (Commit 3 of 7 — header + list Refund discoverability)

- **J4-F1 + J4-F2** Paid/partially-paid invoices had no Refund
  affordance in the InvoiceDetail header — Refund was reachable
  only by scrolling to Payment History. QA flagged this in April
  2026. Header Refund button now visible whenever a refundable
  payment exists (uses `getFirstRefundablePayment`), regardless
  of invoice status (paid, sent, overdue).
- **J4-F26** List dropdown Refund action was gated on
  `status === 'paid'`. Partially-paid sent/overdue invoices had
  no list-level refund path. Now gates on
  `paid_minor > 0 && status !== 'void'` (safe proxy — recalculate
  keeps `paid_minor` in sync with net payments).

#### Fixed (Commit 4 of 7 — intent chain copy + success nudge)

- **J4-F6** Void warning on partially-paid invoices now ends
  with "After refunding all payments, return here to void."
  Operator no longer has to guess at the return-path from
  RefundDialog.
- **J4-F28** RefundDialog success screen surfaces a nudge when
  post-refund `invoice.paid_minor === 0`: "This invoice's paid
  balance is now zero. You can void it from the header if the
  invoice itself should no longer stand." Threads `netPaidMinor`
  through `useRefund.processRefund` and `processManualRefund`
  via a post-success SELECT on `invoices.paid_minor`
  (best-effort — never blocks the success return).
- **J4-F4** `handleConfirm` useCallback missing `isManual`,
  `invoiceId`, `orgId`, `processManualRefund`, `currencyCode`,
  `onRefundSuccess` from deps. Stale-closure risk on dialog
  re-render with different payment type.

#### Fixed (Commit 5 of 7 — void-confirm error handling)

- **J4-F29** `handleVoidConfirm` caught no errors — dialog closed
  unconditionally on `await mutateAsync`. If `void_invoice`
  rejected (e.g. A5 guard fired because a payment landed between
  render and click), operator saw a toast but lost the in-dialog
  warning context. Now wrapped in try/catch: dialog stays open
  on rejection and refetches so the amount-paid copy reflects
  current state.

#### Fixed (Commit 6 of 7 — PDF Remaining)

- **J4-F23** `useInvoicePdf` "Remaining" in the Payment Schedule
  section computed Paid as sum of installments with
  `status='paid'`, ignoring `partially_paid`. A £200 installment
  that's 50% paid contributed £0 to Paid, overstating Remaining
  by £100. Now uses `invoice.paid_minor` (maintained net of
  refunds and inclusive of partial installment payments by
  `recalculate_invoice_paid`).

#### Not yet fixed — separate Lovable session

- **J4-F24** `recalculate_invoice_paid` errors are swallowed
  (console.error only) in both `stripe-process-refund` (line
  189-191 of current code) and `stripe-webhook`
  `handleChargeRefunded` (line 983-985). If recalc fails after
  Stripe has already moved money, `invoices.paid_minor` is
  stale, invoice shows wrong outstanding, ledger identity (I1)
  breaks. This is a variant of the J3-F14a silent-data-lie class
  of bug. Fix requires edge function changes + a new audit_log
  entry type + a UI banner when a recent `recalc_failed` entry
  exists for the invoice. Scheduled for a dedicated commit +
  Lovable deploy following this doc commit.

#### Filed (won't fix this pass)

- **J4-F3** Voided-invoice header has only Back + Download PDF —
  no "view payment history" jump. Cosmetic; the page body
  already shows history. Decision: file, not fix.
- **J4-F7** Client-side PDF generation (jsPDF). Extracted into
  new Journey 11.
- **J4-F12** `useInvoice` fetches payments + refunds as two
  separate queries. Could be a single `payments(*, refunds(*))`
  FK join.
- **J4-F13** `invoice.refunds` typed as `any[]` throughout
  InvoiceDetail.
- **J4-F14** `recalculate_invoice_paid` holds FOR UPDATE on
  invoice only, not on payments/refunds during SUM. Race window
  on simultaneous refunds. Low probability on current volume.
  Cross-reference: I1 ledger identity invariant track.
- **J4-F15** RefundDialog `isProcessing` is component-local.
  Dialog unmount mid-request completes the refund invisibly.
- **J4-F16** `stripe-process-refund` fires
  `send-refund-notification` via fetch with no failure tracking.
  Same class as J3-F4 filed item.
- **J4-F17** RefundDialog success auto-closes after 2500ms.
  Forced-close before user finishes reading.
- **J4-F18** `invoice.status === 'cancelled'` referenced in
  `stripe-process-refund` line 68, but enum has no 'cancelled'
  value. Dead branch. Enum cleanup pass.
- **J4-F19** `record_manual_refund` audit_log
  `entity_type='invoice'` — C50 case, already filed
  cross-cutting.
- **J4-F22** `useInvoicePdf` audit_log write uses `.then(...)`
  not await. If page unmounts mid-write, silent loss.
- **J4-F25** `stripe-process-refund` inserts pending refund row
  BEFORE calling Stripe. Crash between the two leaves an orphan.
  Webhook reconciles the post-succeeded case but not
  pending-forever. Needs a cleanup cron.
- **J4-F27** InvoiceList Void action on partially-paid invoices
  hits A5 guard instead of pre-filtering the option. Polish —
  the error message is clear, just asks the user to click twice.

#### Fixed (Commit 8 — J4-F24 recalc failure surfacing)

- **J4-F24** `recalculate_invoice_paid` errors were swallowed in
  both `stripe-process-refund` and `stripe-webhook`
  `charge.refunded` handler. When recalc failed after Stripe had
  moved money, `invoices.paid_minor` went stale and the I1 ledger
  identity broke silently. Variant of the J3-F14a silent-data-lie
  class.
  - **Sub-commit 8A** — new
    `supabase/functions/_shared/recalc-with-retry.ts` helper: 3×
    attempt with 500ms linear backoff, writes audit_log
    `action='invoice_recalc_failed'` on final failure with
    source/attempts/error/extra context. Both edge functions now
    use it. `stripe-process-refund` returns
    `warning: 'recalc_failed'` in the success JSON when recalc
    didn't land — refund itself never fails the user-visible
    outcome.
  - **Sub-commit 8B** — two SECURITY DEFINER RPCs:
    `admin_recalculate_invoice_paid` (finance-team-only manual
    retry, records `invoice_recalc_manual` audit entry) and
    `get_recent_recalc_failures_for_invoice` (7-day window,
    filtered to exclude failures superseded by successful manual
    retry). Deliberately narrow — avoids relaxing `audit_log`
    SELECT RLS which today only allows `is_org_admin` and would
    otherwise exclude the finance role + solo_teacher non-owners
    from seeing the banner.
  - **Sub-commit 8C** — `RecalcFailureBanner` component +
    `useInvoiceRecalcFailures` / `useAdminRecalculateInvoice`
    hooks. Amber card at top of InvoiceDetail when recent failure
    exists, shows source/timestamp/attempts/last error, single
    "Retry recalculation" button. Gated on
    `canManageBilling && !isParent`.
  - Lovable deploy required for both edge functions + the one
    migration. See Jamie's separate Lovable prompt.

**Journey 4 closed (22 April 2026).** 29 findings, 13 fixed across
11 commits (8 sub-commits spanning 4 logical fix batches + doc
commit), 16 filed. Recalc failures no longer silent; operator has
a visible, actionable recovery path when Stripe refund recalc
breaks down.

### Journey 5 — Refunds & disputes

Walked 22 April 2026. 27 findings across two tracks: Refund
hardening (J5-F1-F13) and Dispute infrastructure build from zero
(J5-F14-F27). 17 fixed across 10 commits. 10 filed.

#### Fixed — Track A (Refunds)

**Commit 1 (J5-F1, F3, F4) — DB-level SUM safety net:**
- `validate_refund_amount` trigger upgraded from single-row
  NEW.amount ≤ payment.amount to SUM(pending + succeeded) + NEW
  ≤ payment. Locks payment row FOR UPDATE to serialise concurrent
  INSERTs across RPC and edge-fn paths.
- Service-role direct inserts and any future RPC paths now
  safeguarded at DB layer — application-layer SUM checks remain
  but are no longer the only gate.
- `stripe-process-refund` application-layer check now sums
  pending+succeeded (not just succeeded) so in-flight refunds
  block new ones. Race winner path: first request inserts pending,
  Stripe call proceeds; second request's trigger rejection returns
  409 with clear retry copy.
- `record_manual_refund` RPC already locks payment row FOR UPDATE
  (20260331160000) — needed no change.

**Commit 2 (J5-F8, F9) — Notification idempotency + webhook wiring:**
- `send-refund-notification` 5-min debounce on
  `message_log.related_id = refund_id` (fallback
  `payment_id-amount`). Duplicate invocations skip cleanly.
- `message_log` row enriched with `related_id`,
  `related_type='refund'` for dedup read.
- `stripe-webhook` `handleChargeRefunded` now fires
  `send-refund-notification` for fresh Stripe-Dashboard-initiated
  refunds (previously silent). Orphan-reconcile branch skips —
  admin edge fn already notified when it inserted the pending row.

**Commit 3 (J5-F10) — Stripe reason passthrough:**
- `stripe-process-refund` maps LessonLoop reason labels to Stripe's
  3-value enum (duplicate, fraudulent, requested_by_customer) via
  `mapToStripeReason()`. "Duplicate payment" now correctly passes
  `reason=duplicate` — Stripe waives the refund fee for duplicates.
  All others → `requested_by_customer`.

**Commit 4 (J5-F6) — refund.updated / refund.failed webhook:**
- New event cases in `stripe-webhook`. `handleRefundUpdated` maps
  Stripe status to our three-state enum, writes audit_log
  before/after, and on succeeded→failed transition fires
  `recalcWithRetry` to re-sync `invoices.paid_minor` (failed
  refunds no longer reduce paid).
- Async refund reversals (ACH return, issuer block) now surface
  correctly instead of leaving ledger out of sync with Stripe.

#### Fixed — Track B (Disputes)

**Commit 5 (J5-F17, F24) — payment_disputes table:**
- Full dispute schema: `stripe_dispute_id` UNIQUE (webhook retry
  dedup), `stripe_charge_id`, `stripe_payment_intent_id`,
  `amount_minor`, `currency_code`, `reason`, `network_reason_code`,
  `status`, `evidence_due_by`, `stripe_dashboard_url`, `outcome`,
  `opened_at`, `closed_at`, `stripe_metadata` jsonb.
- Partial index `idx_payment_disputes_active` on active statuses
  for dashboard urgent-actions queries.
- RLS: finance-team SELECT, service-role INSERT/UPDATE.
- `refunds.refund_from_dispute_id` FK added for lost-dispute
  cascade traceability.
- Two SECURITY DEFINER RPCs: `get_disputes_for_invoice`,
  `get_active_disputes_for_org` (ordered by `evidence_due_by` ASC).

**Commit 6 (J5-F14, F15, F16, F19, F25) — Dispute webhook handlers:**
- `handleDisputeCreated`: resolves payment via `payment_intent`
  match on `payments.provider_reference`, inserts dispute row
  (UNIQUE dedups retries), writes `dispute_opened` audit, fires
  `send-dispute-notification` best-effort. Stores
  `stripe_dashboard_url` for operator one-click evidence submission
  (livemode detection via dispute ID prefix).
- `handleDisputeUpdated`: mutates existing row to match Stripe
  (status, `evidence_due_by`, `network_reason_code`). Out-of-order
  delivery falls back to created-handler. Audit entry only on
  actual status change.
- `handleDisputeClosed`: maps Stripe status to outcome
  (won/lost/warning_closed/charge_refunded), idempotent on outcome
  already set, fires close notification. Lost-cascade wired in
  Commit 7.

**Commit 7 (J5-F18) — Lost-dispute cascade:**
- `apply_lost_dispute_cascade(_dispute_id)` RPC (SECURITY DEFINER,
  service-role only — `auth.uid() IS NULL` guard blocks
  authenticated callers). Idempotent: returns existing cascade
  refund if already applied.
- Inserts `refunds` row with `status='succeeded'`,
  `stripe_refund_id=NULL` (not a Stripe Refund object),
  `reason='Chargeback lost: <stripe_reason>'`,
  `refund_from_dispute_id=<dispute>`. Calls
  `recalculate_invoice_paid` — A4 due-date-aware branch flips
  invoice paid→sent/overdue naturally. Writes
  `dispute_lost_cascade_applied` audit entry.
- `handleDisputeClosed` calls the RPC on outcome='lost'. Cascade
  failure writes `dispute_lost_cascade_failed` audit entry AND
  re-throws — forces Stripe webhook retry (ledger drift must not
  be silent).

**Commit 8 (J5-F20) — send-dispute-notification edge fn:**
- New edge function notifies all active org owners (resolved via
  `org_memberships` + `auth.admin.getUserById` + `profiles.full_name`).
  Four event shapes: opened (red-orange, evidence deadline +
  Stripe link CTA), won (green), lost (dark red, explains
  auto-compensating refund), closed (grey informational).
- 5-min idempotency via
  `message_log.related_id = dispute-<id>-<event>`.
- Wired from `handleDisputeCreated` (event=opened) and
  `handleDisputeClosed` (event=won/lost/closed).

**Commit 9 (J5-F21, F22, F27) — Frontend surfaces:**
- `DisputeBanner` on InvoiceDetail: renders all disputes per
  invoice, active ones first. Five visual tones (urgent, active,
  won, lost, closed), deadline countdown (hours remaining in red
  when <48h), direct Stripe dashboard link CTA on active disputes.
- "Disputed" amber pill on InvoiceList next to status badge.
  Desktop row + mobile card. Data via
  `useInvoiceIdsWithActiveDispute` — cheap `Set<invoice_id>`
  backed by partial index.
- `ActiveDisputesCard` on staff dashboard: up to 5 active disputes
  ordered by evidence deadline, click-through to InvoiceDetail.
  Rendered in SoloTeacher, Academy, and Finance dashboards.
- Three hooks: `useInvoiceDisputes`, `useActiveDisputesForOrg`,
  `useInvoiceIdsWithActiveDispute`.

#### Filed (won't fix this pass)

- **J5-F2** Orphaned pending refund cleanup (J4-F25 carried
  forward). Needs a cron edge fn — separate polish pass.
- **J5-F5** refund.updated succeeded→failed creates compensating
  payment row (architectural — current implementation recalculates
  but doesn't insert a payment; low probability path, deferred).
- **J5-F7** Refund reason enum vs freeform text. Needs product
  decision on taxonomy. Polish.
- **J5-F11** RefundDialog no minimum amount enforcement — Stripe
  rejects below its floor anyway. Polish.
- **J5-F12** /refunds org-wide report. Area 16 Reports scope.
- **J5-F13** Teacher payroll correction on refund (academies only).
  Cross-area — Area 8 Teachers & payroll.
- **J5-F23** Auto-email parent on lost-dispute cascade — product
  decision, deferred. Default: no email (parent already got money
  back via card issuer).
- **J5-F26** Connect dispute fee behaviour + platform fee reversal
  — reporting polish, not correctness.
- In-app dispute evidence submission UI — architectural; operator
  currently submits via Stripe dashboard. Scoped for a future
  journey.
- Cron-based evidence-deadline escalation (email at 48h remaining)
  — scoped but not built this pass. Filed for next polish pass.

**Journey 5 closed (22 April 2026).** 27 findings, 17 fixed across
10 commits, 10 filed. Stripe webhook dispute-handling production
blocker eliminated. Ledger identity (I1) reinforced: refund
over-refund protected at DB layer, chargeback lost state reflected
automatically via compensating-refund cascade.

### Journey 6 — Payment plans / installments

Walked 23 April 2026. Scope: `generate_installments`,
`cancel_payment_plan`, `record_installment_payment`,
`recalculate_installment_status`, `record_stripe_payment`,
`record_payment_and_update_status`, parent-portal installment pay,
installment cron functions, auto-pay, PaymentPlansDashboard.
12 fixed across 4 commits. 4 filed.

#### Fixed (Commit 1 — atomic plan removal)

- **J6-F1 / F2** `useRemovePaymentPlan` previously ran DELETE +
  UPDATE as two separate client-side calls. Non-atomic. Its
  DELETE filter (`status IN ('pending','overdue')`) silently
  skipped partially_paid installments, leaving them orphaned on
  invoices with `payment_plan_enabled=false`. Sanity check of
  the brief surfaced that `cancel_payment_plan` RPC
  (migration 20260418092500) already has the correct semantics —
  locks invoice FOR UPDATE, rejects on paid/partially_paid,
  atomic DELETE + UPDATE + audit. Hook rewired to call it;
  no new migration.

#### Fixed (Commit 2 — payment RPCs delegate to recalculate)

- **J6-F3 / F4** `record_stripe_payment` and
  `record_payment_and_update_status` both computed paid_minor +
  status + overpayment_minor + installment cascade inline.
  `recalculate_invoice_paid` already does exactly this (post-J4
  A4 due-date-aware branch + overpayment population + full
  cascade). Duplicated logic drifts.
- P1 additionally lacked A4 and never updated
  `overpayment_minor` — delegation fixes both as a side effect.
- Both RPCs now call `PERFORM recalculate_invoice_paid(...)`
  after payment INSERT and (where present) installment cascade.
  Running installment recalc twice is idempotent.
- Signatures, auth guards, audit_log `'payment_recorded'` entry,
  idempotency early-return on `provider_reference`,
  `_pay_remaining` logic, and P1's installment cascade all
  preserved. Return shape unchanged for callers.

#### Fixed (Commit 3 — edge function installment fixes)

- **J6-F6** `installment-overdue-check`: partially_paid
  installments past their due_date now count as affected
  invoices for the recalc pass, even though their installment
  status stays `partially_paid` (A3 design keeps it distinct
  from `overdue`).
- **J6-F10** Time-based `sent → overdue` flip stays in the
  cron — `recalculate_invoice_paid`'s A4 branch is refund-reopen
  only, not time-based. Direct UPDATE flips sent→overdue as
  today; cron then loops affected invoice IDs (flipped set ∪
  partial-past-due set) through recalc best-effort, which picks
  up refund drift (installment cascade) in the same pass.
  Failures logged, never abort the cron.
- **J6-F7** `installment-upcoming-reminder`: per-installment
  outstanding now computed (amount_minor minus non-refunded
  prior payments). Email shows real amount due for
  partially_paid installments, not the nominal amount. Skip if
  outstanding < £1.
- **J6-F8** Student-payer fallback: invoices with
  `payer_student_id` and no guardian previously received no
  reminder. Recipient now resolves to guardian OR student;
  `recipient_type` tagged accordingly (`message_log` CHECK
  constraint already allows 'student').
- **J6-F15** `stripe-auto-pay-installment`: audit_log
  `auto_pay_initiated` on successful PI create +
  `auto_pay_failed` in the catch branch. Best-effort. Webhook
  never fires on failed create, so this was previously invisible
  to operators.

#### Fixed (Commit 4 — dashboard partially_paid)

- **J6-F21** `getPlanHealth` now classifies partially_paid
  past-due as 'overdue' (money attributed but insufficient AND
  deadline passed), and partially_paid within 3 days of due as
  'attention'.
- **J6-F22** `getMaxOverdueDays` includes partially_paid-past-due
  in the filter.
- **J6-F23** "Next attention" installment picks: (1)
  partially_paid past due, (2) pending/overdue past due,
  (3) partially_paid not yet due, (4) next pending — stuck
  partials at the top of operator attention. `paidCount` keeps
  strictly-paid semantics; new `partialCount` surfaces as a
  "· N partial" warning-tone suffix on the progress cell.

#### Filed (won't fix this pass)

- **J6-F12** filed — carried forward to a later polish pass.
- **J6-F14** filed — carried forward to a later polish pass.
- **J6-F17** filed — carried forward to a later polish pass.
- **J6-F20** filed — carried forward to a later polish pass.

**Journey 6 closed (23 April 2026).** 12 fixed across 4 commits,
4 filed. Payment-plan atomicity restored, payment RPCs consolidated
on `recalculate_invoice_paid`, partially_paid awareness added
across cron functions, reminder emails, and PaymentPlansDashboard.

### Journey 7 — Reminders & overdue automation

Walked 23 April 2026. 24 findings across five cron functions
(`auto-pay-upcoming-reminder`, `overdue-reminders`,
`invoice-overdue-check`, `installment-overdue-check`,
`installment-upcoming-reminder`), cadence config, and cross-function
dedup / auth / timezone consistency. 3 High · 8 Medium · 8 Low ·
4 Filed (out-of-scope). 5 fixed across 6 commits (including 2
docs-only fixes in the close commit); 15 filed.

#### Fixed (Commit 1 — student-payer fallback)

- **J7-F1** `overdue-reminders` invoice and installment paths both
  hard-rejected when `guardian.email` was null. Student-payer
  invoices received zero overdue reminders. Direct port of J6-F8
  pattern: SELECT expansions (`payer_student email` on both paths,
  `payer_student` join newly added on installment path), new
  `resolveRecipient` helper, `logAndSend` generalised to take
  `recipient.type` and `recipient.id` rather than hardcoded
  `'guardian'`. `message_log.recipient_type='student'` already
  allowed by the existing CHECK constraint — no schema change.

#### Fixed (Commit 2 — invoice-overdue-check recalc drift)

- **J7-F2** `invoice-overdue-check` had no J6-F10-style loop-and-recalc
  drift cleanup. Direct time-based UPDATEs (sent→overdue, plan-parent
  flip) preserved as the canonical transition path — `recalculate_invoice_paid`
  A4 branch covers refund-reopen only, not time-based. After the
  UPDATEs, a Set of every touched invoice ID is iterated through
  `recalculate_invoice_paid` best-effort. Catches refund-driven
  installment-status drift (partially_paid ↔ pending flip-backs)
  and paid_minor staleness. Failures log and continue; single-invoice
  failure doesn't abort the cron pass.

#### Fixed (Commit 3 — cadence catch-up)

- **J7-F3** Exact-day-match gate (`reminderDays.includes(daysOverdue)`)
  replaced with a tier-aware "fire highest missing tier" gate. A
  missed day-7 cron run (outage, deploy, pg_cron pause) no longer
  permanently loses that reminder — next run fires tier-7 as catch-up.
- `message_type` taxonomy split from generic `'overdue_reminder'` /
  `'installment_reminder'` into dynamic tier-suffixed values
  `${baseType}_d${tier}`. Suffix is the firing tier (the entry
  from `overdue_reminder_days` that matched), so any per-org
  cadence works — not just the default `[7, 14, 30]`.
- New inline helpers: `checkRecipientNotifEnabled` (prefs check,
  extracted from removed `shouldSkipRecipient`),
  `hasTierReminderBeenSent` (lifetime tier lookup, excludes
  status='failed' so failed sends retry), `pickFiringTier` (gate
  logic). Iterates eligible tiers highest-first; fires the first
  that hasn't been sent. Returns null → skip.
- **Highest-missing-only semantics:** after a long outage where
  tier-7 AND tier-14 are both owed, only tier-14 fires. Trade-off:
  avoids back-to-back spam, but tier-7 is skipped forever for
  that entity. Rationale: escalated tone wins; don't send two
  reminders in one cron run.
- **Urgency keyed to tier, not daysOverdue.** `urgencyLevel =
  firingTier >= 30 ? 'urgent' : firingTier >= 14 ? 'important'
  : 'friendly'`. A tier-7 catch-up on day 9 stays 'friendly'; a
  tier-30 catch-up on day 35 stays 'urgent'. Copy still shows
  actual `daysOverdue` (truthful). Installment path stays
  tone-neutral — F12 filed.
- **Deploy-day impact accepted.** Existing rows under the generic
  type are invisible to the tier lookup. One-time spike of ≤1
  extra reminder per entity per deploy-hour expected. Trial users
  only. No data backfill migration.

#### Fixed (Commit 4 — auto-pay amount mismatch)

- **J7-F4** `auto-pay-upcoming-reminder` previously showed
  `inst.amount_minor` (nominal) in the heads-up email, but
  `stripe-auto-pay-installment` charges the outstanding
  (amount_minor − non-refunded prior payments). For a partially_paid
  installment, parent saw "£50 will be charged tomorrow" and Stripe
  actually took £30 (or vice versa). Outstanding now computed
  identically to the charging path — mirrors J6-F7 pattern. Skip
  if outstanding < £1 (status lag from just-landed payment).

#### Fixed (Commit 5 — failed-send retry unblocked)

- **J7-F5** Dedup queries in `auto-pay-upcoming-reminder` and
  `installment-upcoming-reminder` now filter on `.in('status',
  ['sent', 'pending', 'logged'])` — a previously-failed send no
  longer counts as "already sent today." `overdue-reminders` picked
  this up implicitly in Commit 3 via `hasTierReminderBeenSent`
  filtering `.in('status', ['sent', 'pending'])`.

#### Fixed (Commit 6 — docs)

- **J7-F10** `overdue-reminders` added to `docs/CRON_JOBS.md` as
  entry 9a (same 09:00 UTC slot as upcoming reminders). Fresh
  Supabase environments set up from the doc will now schedule it.
- **J7-F11** CRON_JOBS.md entry 9 corrected: `installment-upcoming-reminder`
  sends at **3 days** before due, not 7 days. Docs matched code.

#### Filed — carried forward

- **J7-F6 (Med)** Race window: cron snapshot vs parent payment.
  `overdue-reminders` queries overdue invoices at start-of-run;
  parent pays mid-iteration → email still goes out. Fix: refetch
  invoice status inside `processInvoiceReminder`/`processInstallmentReminder`
  just before send. Seconds-wide race, rare but real. Polish pass.
- **J7-F7 (Med)** Auth inconsistency: `auto-pay-upcoming-reminder`
  uses an ad-hoc `authHeader.includes(SERVICE_ROLE_KEY)` substring
  check; the other four use `validateCronAuth` (`x-cron-secret`).
  Unify on `validateCronAuth`. Polish pass.
- **J7-F8 (Med)** Timezone inconsistency: `invoice-overdue-check`
  uses org-local date (iterates orgs, `en-CA` locale + tz); the
  other four use UTC. Reminders fire at 09:00 UTC everywhere
  regardless of org timezone. Related to C11 (out-of-scope this
  journey).
- **J7-F9 (Med)** Duplicate `pending → overdue` installment
  transition across `invoice-overdue-check:55-70` and
  `installment-overdue-check:21-39`. Second run's UPDATE is a
  no-op; wasted query, not correctness. Consolidate home to
  `installment-overdue-check`. Pre-existing BILLING_FORENSICS B19.
- **J7-F12 (Med)** Plan-installment reminder copy has no urgency
  tier escalation — always neutral "Payment reminder" subject
  regardless of days overdue. Tier-keyed urgency applies to
  invoice path only post-J7. Future polish: add urgency tiers to
  installment path.
- **J7-F13 (Low)** `installment-upcoming-reminder` doesn't use
  `sanitiseFromName` (unlike `overdue-reminders`). Copy-injection
  surface on org names with `<`/`>`/`,`.
- **J7-F14 (Low)** No `reply-to` header on any of the three email
  crons. Parents replying get a bounce.
- **J7-F15 (Low)** `List-Unsubscribe` header points at a React
  settings route, not an RFC 8058 POST endpoint. One-click
  unsubscribe from Gmail/Outlook doesn't actually toggle the pref.
- **J7-F16 (Low)** No plain-text alternative body. Spam-filter
  penalty on HTML-only emails.
- **J7-F17 (Low)** No shared `send_reminder_email` helper. Each
  cron inlines Resend fetch + message_log insert + status update.
  Refactor opportunity.
- **J7-F18 (Low)** No per-invoice dunning pause. No `pause_invoice_reminders(_invoice_id)`
  RPC, no UI toggle. Teacher who agreed "wait until Friday"
  verbally can't tell the system. Product decision.
- **J7-F19 (Low)** No teacher escalation. Dashboard count is the
  only surface. Product decision.
- **J7-F20 (Low)** No multi-invoice digest — a guardian with 3
  overdue invoices on day 7 gets 3 separate emails same morning.
  Product decision.
- **J7-F21 (Filed)** Weekend / UK bank-holiday suppression — C11
  prerequisite. Out of scope per brief.
- **J7-F22 (Filed)** Guest-parent opt-out: guardians without a
  `user_id` have no notification_preferences row and no opt-out
  path. GDPR/PECR concern. Data-model decision.
- **J7-F23 (Filed)** BACS / bank-transfer details missing from
  reminder email bodies. UK music-school UX gap.
- **J7-F24 (Filed)** PDF attachment on reminder emails — blocked
  on J11 (server-side PDF generation).
- **J7-F25 (Filed — polish)** Tier-reminder retry logic has no
  circuit breaker on persistent send failure. `hasTierReminderBeenSent`
  filter excludes `status='failed'` so failed sends retry next
  cron tick. Acceptable at current cadence (daily cron, 3-day
  tier gaps, max 3 tiers then silent forever per entity). A
  broken send channel surfaces via failed `message_log` rows;
  operator intervention expected. Candidate for a `send_attempts`
  counter + max-attempts gate in a future polish pass.

**Journey 7 closed (23 April 2026).** 5 fixes landed (F1 student
fallback, F2 recalc drift, F3 cadence catch-up, F4 auto-pay
amount, F5 failed-retry) + 2 docs corrections (F10, F11) across
6 commits. 15 filed for later passes; 4 explicitly out-of-scope
per the brief (F21-F24). Exact-day-match cadence brittleness is
the most operationally meaningful fix — missed cron days no longer
silently lose reminders.

### Journey 8 — Credits × invoices

Walked 24 April 2026. Scope: `update_invoice_with_items` credit
path, `delete_billing_run` vs applied credits, `credit-expiry-warning`
recipient resolution, manual credit issuance atomicity,
`void_invoice` notes preservation, IssueCreditModal expiry
semantics. 5 code fixes across 4 commits. 11 filed.

#### Fixed (Commit 1 — update_invoice_with_items eligibility)

- **J8-F1 / F2** Edit-draft credit eligibility was missing two of
  the four checks that `create_invoice_with_items` (CRD-H3) and
  `redeem_make_up_credit` (CRD-C3) both have:
  - **F1 voided_at guard:** a manually-voided credit was eligible
    for reapply via the edit path, silently resurrecting a credit
    that should be dead.
  - **F2 expired_at guard:** explicit expiry-cron marker was
    bypassed (distinct from the `expires_at < CURRENT_DATE`
    comparison that WAS present).
- New migration `20260424120000_update_invoice_credit_eligibility_fix.sql`
  rewrites the function from the live Lovable-applied version
  (`20260421080040`), preserving all other behaviour verbatim.

#### Fixed (Commit 2 — delete_billing_run frees credits)

- **J8-F6** `delete_billing_run` DELETEd draft invoices + items
  but did NOT free credits that had been applied to those
  invoices. Result: orphan redeemed credits — `redeemed_at=NOW()`,
  `applied_to_invoice_id` pointing at a deleted invoice id.
  Unusable (can't re-apply because redeemed_at is set) but still
  blocking any new apply attempts.
- Added `UPDATE make_up_credits SET redeemed_at=NULL,
  applied_to_invoice_id=NULL, notes='Credit restored — billing
  run deleted'` step before the DELETE chain. Skips voided
  credits (don't resurrect a manually-voided credit).
  Freed-credit count surfaces in audit_log and RPC return value.

#### Fixed (Commit 3 — credit-expiry-warning hardening)

- **J8-F13** Student-payer fallback. Previous recipient resolution
  hard-rejected on either no primary-payer guardian link OR null
  guardian email. Student-payer credits received no warning.
  Now: try guardian first, fall back to `student.email` when no
  primary guardian is available. recipient_type tagged `'student'`
  in `message_log` (CHECK constraint at `20260223152118` already
  allows it). Mirrors J7-F1 pattern.
- **J8-F15** Retry-unblocked dedup. Previous dedup pulled ALL
  message_log rows for these credits regardless of status.
  A Resend outage silently consumed the warning forever — the
  credit never got another chance. Now `.eq('status', 'sent')`:
  failed sends retry next cron day. Mirrors J7-F5 pattern.
- SELECT expanded to include `students.email`. Downstream copy
  uses resolved `recipientName` (guardian.full_name or student's
  joined name).

#### Fixed (Commit 4 — atomic issue RPC + polish pass)

- **J8-F17** Atomic `issue_make_up_credit` RPC. Previous
  `useMakeUpCredits.createCredit` did INSERT + fire-and-forget
  audit_log INSERT — non-atomic; audit failures silent. New
  SECURITY DEFINER RPC gates on `is_org_staff` (owner / admin /
  teacher / finance), validates org active, validates student
  belongs to org, validates value>0, INSERT + audit_log in one
  transaction. Hook rewired; ~40 lines of client-side
  non-atomic logic removed.
- **J8-F4** `void_invoice` credit-restore now appends to the
  original `notes` field rather than overwriting. Preserves
  issuance context (reason, linked-lesson info) across apply →
  void → reapply cycles. Appended restore note includes the
  voided invoice's number and date for traceability.
  Implementation: `COALESCE(notes, '') || CASE WHEN notes IS NULL
  OR notes = '' THEN '' ELSE ' | ' END || 'Credit restored — ...'`.
- **J8-F8** `useParentCredits` drops `redeemed_at` and
  `applied_to_invoice_id` from SELECT and `ParentCredit`
  interface. The `available_credits` view +
  `credit_status='available'` filter guarantees both are NULL;
  they were always-null noise.
- **J8-F10** `IssueCreditModal` expiry now uses `endOfDay()`
  before `toISOString()`. Previously `addMonths(now, N).toISOString()`
  produced UTC-midnight-of-that-day, so a credit issued in UK
  summer "expires in 3 months" was cut off just before that
  calendar day ended in local time. `endOfDay` matches the
  server-side auto-issue pattern — credit-expiry cron + redeem
  RPC are timestamp-aware so no downstream drift.
- **J8-F11** `IssueCreditModal` adds `"In 90 days (org default)"`
  option between 1 month and 3 months. Exposes the cron's default
  for consistency. UI default selection stays at 3 months.

#### Filed — carried forward or verified clean

- **J8-F3 (verified clean)** `create_invoice_with_items` credit
  eligibility confirmed all four checks present (CRD-H3 fix).
  No action needed; walked only to rule out drift vs
  update_invoice_with_items.
- **J8-F5 (filed)** `credit-expiry` cron (the cascade that
  actually marks credits expired) is MISSING from Supabase
  schedule per Track 0.6. Structural gap — scheduled in Track 0.6
  reconciliation walk, not re-scoped here.
- **J8-F7 (filed)** No per-credit revocation audit trail. Void
  RPC writes to audit_log but doesn't snapshot the credit state
  at void time. Low priority.
- **J8-F9 (filed)** `ParentCredit.student` nullability: the join
  could theoretically return null on an orphaned credit. Defensive
  filter candidate; no production instance observed.
- **J8-F12 (filed)** Credit-issue from the absence-cancellation
  trigger doesn't honour org-level "issue credit on teacher
  cancel" toggle consistently across all cancellation surfaces.
  Cross-area with Area 5 (Lessons & attendance) — deferred to
  that journey.
- **J8-F14 (verified clean)** `available_credits` view excludes
  voided/expired/redeemed. Confirmed. No action.
- **J8-F16 (filed)** IssueCreditModal has no preview of the
  resulting expiry date when "Never expires" is NOT selected.
  Minor UX polish.
- **J8-F18 (filed)** Credit lifecycle surface (per-student
  credit history with status transitions) absent from the UI.
  Product decision. Cross-area with Area 9 (Make-up credits &
  waitlists).
- **J8-F19 (filed)** Redeemed credits aren't shown on the
  invoice PDF line items — only aggregated as
  `credit_applied_minor`. Parents can't see which credits were
  consumed. Tied to J11 server-side PDF; deferred.
- **J8-F20 (filed)** No concurrency lock on the credit-apply
  path in `update_invoice_with_items`. Two operators editing
  the same draft invoice could double-apply the same credit
  (FOR UPDATE locks the credit row inside the loop but not
  before the caller reads the list). Low probability; rare
  admin-only path.
- **J8-F21 (filed)** Credit refunds (redeem → refund → free
  credit) not covered. `record_manual_refund` doesn't restore
  consumed credits on the invoice. Architectural; data-model
  decision about whether credit consumption is reversible.

#### Additional filings from other journeys

- **J7-F26 (filed — polish):** "Last reminder sent" surface on
  InvoiceDetail. Small read-only card pulled from message_log
  with tier + timestamp (e.g. "Last reminder: tier-7 overdue,
  sent Apr 18"). Future dunning-visibility polish pass.
- **Area 0 polish — Track 0.7 filed in ROADMAP:** operator-facing
  manual cron trigger button. Listed under Cross-cutting
  invariants. Unblocks Track 0.6 reconciliation, cron debugging,
  and backfill operations without leaving the app.

**Journey 8 closed (24 April 2026).** 5 fixes landed across 4
commits, 11 filed (some verified clean, some cross-area deferred,
some product decisions). Credit eligibility checks now unified
across create / edit / redeem paths; orphan-credit hole in
billing-run deletion closed; credit-expiry warning reaches
student payers and retries on transient failure; client-side
credit-issue replaced by atomic RPC. Biggest structural gap
flagged but NOT fixed here: `credit-expiry` cron missing from
schedule (Track 0.6 territory).

### Journey 9 — Recurring invoice templates

Multi-phase project. Phase 0 walk (24 April 2026) surfaced that the
existing `recurring_invoice_templates` surface is architectural
vaporware — UI fully built but zero backend (no scheduler, no
generator, no child schema). Design doc committed at
`docs/RECURRING_BILLING_DESIGN.md` (v2 — decisions locked).

#### Phase 1 — Schema foundation (24 April 2026)

6 commits, all migrations, zero runtime behaviour. Builds the skeleton
that Phases 2-4 will plug the generator, scheduler, and UX into.

- **J9-P1-C1** `1a6b83f` — template schema extensions + policy reconciliation
- **J9-P1-C2** `adc2ab2` — `recurring_template_recipients` table + RLS
- **J9-P1-C3** `6b2bdce` — `recurring_template_items` table + RLS
- **J9-P1-C4** `61a9bd5` — `recurring_template_runs` + `run_errors` tables + `last_run_id` FK
- **J9-P1-C5** `9c55654` — `invoices.generated_from_*` + `invoice_items` duplicate-invoice defence
- **J9-P1-C6** — auto-pause existing template rows + Phase 1 docs close (this commit)

Shipped:
- `recurring_invoice_templates` extended with `delivered_statuses`,
  `upfront_source`, `due_date_offset_days`,
  `apply_credits_automatically`, `term_id`, `notes`, `last_run_id`.
  `billing_mode` CHECK now allows `'hybrid'`. Duplicate policy drift
  from J9-F2 (two overlapping RLS policies) reconciled to a single
  finance-team-only gate per Phase 0 decision 1.
- New tables: `recurring_template_recipients` (explicit per-template
  student list with pause flag), `recurring_template_items` (flat
  line items for hybrid/flat modes), `recurring_template_runs`
  (provenance anchor, one row per generator invocation),
  `recurring_template_run_errors` (per-recipient failure log).
  Finance-team SELECT + service-role FOR ALL on runs/errors
  (generator writes as service role); finance-team FOR ALL on
  recipients/items.
- `invoices.generated_from_template_id` + `generated_from_run_id`
  back-references + partial indexes (for the Phase 4 run detail
  "find invoices from this run" lookup).
- Partial unique index on `invoice_items.linked_lesson_id` WHERE
  NOT NULL — DB-level duplicate-invoice defence (§11 decision 8).
  `void_invoice` already nulls the link, so voided invoices free
  the lesson for re-invoicing and the unique constraint stays
  consistent across the void lifecycle.
- Migration C5 includes a DO-block pre-check that aborts loudly
  if existing data holds duplicate non-null `linked_lesson_id`
  values — safer than letting the unique-index creation fail with
  a cryptic constraint-violation.
- Existing inert template rows auto-paused (`active = false` +
  notes annotation) so the upcoming scheduler doesn't attempt to
  run templates that lack recipients/items. Idempotent on re-run
  via sentinel-string check in notes.

No findings filed — Phase 1 is mechanical schema. Next: Phase 2
generator RPC with savepoint-per-recipient isolation.

#### Phase 2 — Generator & Manual Run Path (24 April 2026)

6 commits. Schema-only prerequisites, send-pipeline refactor,
generator RPC, manual Run-now wiring.

- **J9-P2-C1** `359c958` — `message_log.source` column + CIWI
  service-role bypass
- **J9-P2-C2** `0740f60` — extract shared `_shared/send-invoice-email-core.ts`;
  `send-invoice-email` becomes a thin user-JWT wrapper. Behaviour-
  preserving for existing callers (manual send, parent portal).
- **J9-P2-C3** `5d66d6d` — `send-invoice-email-internal` edge fn
  (service-role auth, `generated_from_template_id` defence-in-depth
  guard) for the scheduler path. Shares logic with the user-JWT
  wrapper via the core module.
- **J9-P2-C4** `f5da294` — `generate_invoices_from_template` RPC +
  `cancel_template_run` RPC. Includes 3 Phase 1 schema fixes
  bundled (see below).
- **J9-P2-C5** `0bdf643` — Run-now button + `useRunRecurringTemplate`
  hook on the recurring billing settings tab. Sequential auto-send
  via user-JWT `send-invoice-email` for `auto_send=true` templates.
- **J9-P2-C6** — Phase 2 docs close (this commit).

Shipped:
- `message_log.source` column with CHECK (`user_manual`,
  `recurring_scheduler`, `recurring_manual_run`, `parent_portal`)
  for send-path attribution.
- CIWI auth guard amended with `auth.uid() IS NULL` carve-out for
  trusted in-DB SECURITY DEFINER callers (the generator). Service-
  role HTTP callers cannot reach CIWI directly because PostgREST
  doesn't route service-role to RPC endpoints — see design doc
  Appendix A.
- `_shared/send-invoice-email-core.ts` extracted from the existing
  `send-invoice-email` edge fn. The user-JWT wrapper and the new
  internal wrapper both delegate template rendering, Resend API
  call, message_log writes, and the draft → sent transition to
  the same core. Net-zero functional change for existing callers.
- `send-invoice-email-internal` edge fn: service-role only, skips
  per-user rate limit (system-triggered sends), writes
  `message_log.sender_user_id = NULL` and the caller-supplied
  `source` value. Defence-in-depth: rejects invoices that lack
  `generated_from_template_id` to prevent the internal path from
  being used to send manual invoices.
- `generate_invoices_from_template(template_id, triggered_by, source)`
  RPC: per-recipient savepoint isolation via BEGIN/EXCEPTION blocks;
  weekly/monthly/termly period computation with term_id one-shot
  vs rolling semantics; payer resolution chain (primary guardian
  → student email → no_payer_resolved skip); rate resolution chain
  (lp.rate_minor → student default → org default → no_rate_card
  per-lesson skip); attendance LEFT JOIN with text-array status
  match; pre-flight exclusion of already-billed lessons; post-CIWI
  provenance UPDATE; termly-rolling auto-pause when no next term;
  audit_log entry; returns `{ run_id, outcome, invoice_count,
  recipients_skipped, recipients_total, invoice_ids, period_start,
  period_end }`.
- `cancel_template_run(run_id)` RPC: finance-team-gated bulk void
  via `void_invoice(invoice_id, org_id)` per generated invoice.
  Sets `runs.outcome = 'cancelled'`, writes audit_log entry.
- Run-now UI on `RecurringBillingTab`. Sequential `send-invoice-email`
  per returned `invoice_id` for templates with `auto_send=true` —
  preserves operator identity on `message_log.sender_user_id` and
  applies their per-user rate limit. Per-card running state via
  `runningTemplateId` so only the targeted card shows the spinner.
- Phase 1 schema fixes bundled into J9-P2-C4 (caught during C4
  sanity check):
  1. `recurring_template_runs.outcome` CHECK extended to include
     `'cancelled'` (Phase 1 omitted this value, blocking
     `cancel_template_run`).
  2. `recurring_invoice_templates.delivered_statuses` DEFAULT
     corrected from `'{attended}'` (not a valid `attendance_status`
     enum value — would match zero rows) to `'{present}'`. Existing
     rows with the invalid default migrated in the same statement.
  3. `recurring_template_run_errors.student_id` NOT NULL dropped —
     template-scoped errors like `no_next_term` aren't per-student
     and the constraint blocked the legitimate insert.

##### Phase 2 deferrals (product decisions, not gaps)

- `apply_credits_automatically`: generator ships with empty
  `_credit_ids` array. Auto-selecting eligible credits per recipient
  is underspecified in the design doc and has its own audit surface.
  Operator applies credits manually post-generation. Queued as a
  follow-up journey.
- PDF attachment on invoice emails: J11 on the production roadmap
  is the planned retrofit for BOTH user-JWT and service-role send
  paths. Recurring invoices (Phase 2) ship with the same HTML-only
  send behaviour as manual invoices today; J11 upgrades both paths
  in lockstep so Phase 2 doesn't introduce PDF expectations that
  J11 has to reconcile separately.
- Operator template-detail page + run detail page: Phase 4 scope
  per design doc §10. Phase 2 wires Run-now into the existing
  inline-card surface; the dedicated detail pages with recipients
  / items management and per-run drill-down ship in Phase 4.

#### Phase 3 — Scheduler & Alerts (closed 24 April 2026)

4 commits.

- Added `recurring-billing-scheduler` edge fn (cron-auth-gated via
  `validateCronAuth` + `INTERNAL_CRON_SECRET`). Registered cron at
  `0 4 * * *` UTC.
- Added `send-recurring-billing-alert` edge fn. Mirrors
  `send-dispute-notification` structure; recipients broadened from
  owners-only to full finance team (owner + admin + finance,
  active). 5-min dedup on (template_id, run_id, outcome).
- Extended `message_log.source` CHECK to include
  `'recurring_scheduler_alert'`.
- Scheduler flow: find due templates, invoke generator RPC per
  template (continue-on-error), auto-send filtered to `status='draft'`
  (idempotency guard for day-N+1 retries of prior partial runs),
  alert on partial/failed outcomes with error samples.
- Phase 2 F1 cleanup: removed `as never` type assertions in
  `useRunRecurringTemplate.ts` (Lovable regenerated `types.ts`
  post-Phase-2 deploy).

##### Phase 3 observability

Intentional simplification: no `cron_run_log` table. Scheduler logs
via `console.log` + returns aggregate summary in HTTP response.
Partial/failed runs trigger alert emails. If observability becomes
a pain point (e.g. silent regressions in the cron path), a Phase 4+
journey can introduce a runs log table.

#### Phase 4A — UI operability gaps (closed)

Closes the four gaps that prevented templates created via the UI
from generating invoices, plus a role parity fix:

- Recipients management UI (multi-select picker; previously-paused
  students restorable with one click; 'Add all active' bulk action).
- Items management UI for upfront/hybrid templates (description +
  amount + quantity, currency-aware).
- Hybrid billing_mode option exposed in the Select (was missing
  despite Phase 1 adding it to the DB CHECK).
- term_id selector for termly templates (Rolling vs One-shot).
- canEdit broadened to include finance role (matches the
  is_org_finance_team backend gate).
- 'No recipients' destructive Badge on TemplateCard for any
  template with zero active recipients. Sourced from a single
  org-wide count query (no N+1).

##### Phase 4A architecture notes

- All UI uses direct `supabase.from(...)` operations against
  `recurring_template_recipients` and `recurring_template_items`.
  Both tables have RLS policies (`is_org_finance_team`) that gate
  writes correctly; no new backend RPCs needed.
- Recipient save uses upsert with ON CONFLICT (template_id,
  student_id) DO UPDATE SET is_active = true so re-adding a paused
  student flips them back active. Removed students are marked
  is_active = false (preserve history; never delete).
- Items save uses full-replace (delete all, insert all with
  order_index = array index). Acceptable for small per-template
  item counts.
- Edit flow uses `useEffect` watching `editingTemplate +
  existingRecipients + existingItems` to prepopulate form state.

##### Phase 4B scope (deferred polish)

- Dedicated template detail page (separate route)
- Run detail page with void/retry actions
- Recent runs dashboard card
- Failure banner aggregating recent partial/failed runs at the top
  of the Settings tab
- Optional: drag-and-drop reorder for items

Phase 4B is polish on top of a working system. Phase 4A unblocks
end-to-end usability; Phase 4B improves operator experience.

#### Phase 4B — Operator UX polish (closed)

Operator-grade surfaces on top of Phase 4A's working baseline:

- `retry_failed_recipients` RPC + `parent_run_id` schema: reattempts
  only failed students using the parent run's stored period.
  'I fixed the underlying issue, bill those students.'
- `useRecurringTemplateRuns` / `useRecurringTemplateRun` /
  `useRecentPartialOrFailedRuns` / `useCancelTemplateRun` /
  `useRetryFailedRecipients` hooks.
- `/settings/recurring-billing/:templateId` — canonical edit surface.
  Recipients, items, term mode, run history all in one page.
  Activate banner gates `active=true` behind validation.
- `/settings/recurring-billing/runs/:runId` — full run picture with
  void and retry actions, friendly `error_code` labels, generated
  invoices list, parent run linkage display.
- `RecurringRunsCard` on Dashboard + FinanceDashboard.
- `RecurringFailuresBanner` on Settings tab.
- `TemplateCard` click-through to detail page.
- Slim create dialog (basic fields only).
- `active=false` on creation; activate from detail page.
- UX refinements: email visibility in recipient picker, dedicated
  paused-chip restore icon, grid layout for items rows.

##### Phase 4B architecture notes

- Retry semantics: new run row with `parent_run_id` linkage,
  `triggered_by='retry'`. Reuses parent's period (NOT the template's
  `next_run_date` which has already advanced). New `error_code`
  `already_invoiced` for upfront/hybrid pre-check.
- `active=false` default replaces Phase 4A inline validation. Dialog
  no longer has recipients/items state; detail page validates on
  activate.
- Dashboard card + Settings banner share `useRecentPartialOrFailedRuns`
  hook (single query, 14-day window).
- `retry_failed_recipients` updates `template.last_run_id` ONLY when
  the retry produces invoices. A retry that fully fails preserves
  the parent run's `last_run_id` pointer on the template.

##### Phase 4B commit ledger

- **J9-P4B-C1** `ca37c9c` — `retry_failed_recipients` RPC +
  `parent_run_id` migration.
- **J9-P4B-C2** `21a8e15` — hooks for runs, run detail, cancel, retry.
- **J9-P4B-C3** `f15f528` — template detail page.
- **J9-P4B-C4** `a531af5` — run detail page with void + retry.
- **J9-P4B-C5** `235dd42` — dashboard card for recent partial/failed
  runs.
- **J9-P4B-C6** `081fdfa` — failure banner + template card
  click-through.
- **J9-P4B-C7** `2818097` — slim create dialog + UX refinements.
- **J9-P4B-C8** — docs close (this commit).

J9 fully closed. Recurring billing is operator-grade end-to-end:
schema, generator, scheduler, alerts, manual run, retry, void,
detail surfaces, failure visibility.

### Journey 10 — Stripe auto-pay

Multi-phase. Phase 1 (25 April 2026) closes the data-capture gap that
silently broke auto-pay for every guardian who'd opted in: the saved
default payment method was never written, so the `stripe-auto-pay-installment`
cron skipped the gate at index.ts:85 and parents never saw a charge
attempt. Also closes the symmetric scope bugs in saved-PM list/detach
and the missing 24-hour final reminder + expiry-warning copy.

#### Phase 1 — Auto-pay capture, scope fix, reminders polish (closed 25 April 2026)

5 commits + docs close. Findings addressed: J10-F1, J10-F3, J10-F5,
J10-F6.

- **J10-F1 webhook capture** — `stripe-webhook` handler for
  `payment_intent.succeeded` now persists `default_payment_method_id`
  to `guardian_payment_preferences` after the existing `record_stripe_payment`
  call. Reads `paymentIntent.payment_method` (populated because
  `setup_future_usage='off_session'` is set on the source PI in
  `stripe-create-payment-intent`), upserts only when the existing
  default is NULL (auto-promote first card). Best-effort — payment
  row already landed via `record_stripe_payment`, so PM upsert
  failures must never abort the webhook. This is the authoritative
  single-write point.
- **J10-F1 backfill** — service-role-only RPC
  `backfill_guardian_default_pm_set(_guardian_id, _org_id, _payment_method_id)`
  patches existing guardians (auto_pay_enabled=true, history pre-C1
  but `default_payment_method_id IS NULL`). Returns
  `{updated, previous, action}` so the driver can report inserted /
  updated / skipped tallies. Per-row no-op when default already set
  — safe to re-run without clobbering. Driver edge fn
  `admin-backfill-default-pm` lists PMs from Stripe (platform scope,
  no `stripeAccount`) for each candidate row's `stripe_customer_id`,
  takes the most-recently-created card, calls the RPC. Operator-
  triggered via `validateCronAuth` (x-cron-secret + INTERNAL_CRON_SECRET);
  not on a schedule. Per-guardian try/catch so one Stripe error
  doesn't abort the run.
- **J10-F3 PM list/detach scope** — `stripe-list-payment-methods` was
  passing `stripeAccount=org.stripe_connect_account_id` to
  `paymentMethods.list`, but PMs are platform-attached because the
  source PI runs on the platform with `transfer_data.destination`
  for Connect. Under any Connect-enabled org the call returned
  empty; parents saw "No saved payment methods yet" after successful
  payments. Removed the org lookup and the `stripeOpts.stripeAccount`
  set; SDK call now runs on the platform implicitly. Symmetric fix
  in `stripe-detach-payment-method` for the `paymentMethods.retrieve`
  + `paymentMethods.detach` pair.
- **J10-F5 24-hour final reminder** — extracted reminder body to
  `_shared/auto-pay-reminder-core.ts` parameterised on
  `(leadDays, messageType)`. Existing `auto-pay-upcoming-reminder`
  is now a thin wrapper around `{leadDays: 3, messageType: 'auto_pay_reminder'}`
  (behaviour-preserving for the 3-day cadence). New
  `auto-pay-final-reminder` calls `{leadDays: 1, messageType:
  'auto_pay_final_reminder'}`. Independent dedup keys mean the two
  cadences never conflate. Cron `auto-pay-final-reminder-daily` at
  `0 8 * * *` UTC, idempotent unschedule-then-schedule.
- **J10-F6 PM brand/last4/expiry** — helper retrieves the saved PM
  from Stripe and splices `${brand} ending ${last4} (expires
  MM/YYYY)` into the email subject and body. If `exp_year`/`exp_month`
  precedes the charge month, the helper prepends a red-bordered
  expiry-warning block ("Your card expires before this payment date")
  and prefixes the subject with "[Action needed]". Stripe retrieve
  failure (detached PM, transient network, missing key) falls
  through cleanly to the legacy "your saved card" wording —
  reminder still goes out.

##### Phase 1 architecture notes

- **PM scope** — `setup_future_usage='off_session'` runs unconditionally
  on the platform PI in `stripe-create-payment-intent` (line 312).
  Stripe attaches the PM to the platform customer, not the connected
  account. Every consumer (saved-PMs list, detach, off-session
  charge, reminder PM lookup, backfill driver) must list/retrieve
  on the platform. This was the underlying cause shared across
  J10-F1, J10-F3, and J10-F5/6.
- **Auth split** — `auto-pay-{upcoming,final}-reminder` keep the
  legacy `authHeader.includes(service_role_key)` Bearer pattern to
  match the existing cron migration. `admin-backfill-default-pm`
  uses `validateCronAuth` (`x-cron-secret`) because it's
  operator-triggered, not scheduled, and INTERNAL_CRON_SECRET is
  the closest fit for the gate pattern.
- **Brand dictionary duplication** — `BRAND_LABELS` in
  `_shared/auto-pay-reminder-core.ts` mirrors `brandIcons` in
  `src/components/portal/PaymentMethodsCard.tsx`. Edge fns can't
  import frontend code. Filed J10-F2 for a longer-term shared
  module if the duplication grows.

##### Phase 1 commit ledger

- **J10-P1-C1** `b3a16476` — webhook persists default_payment_method_id
  on PI success.
- **J10-P1-C2** `0f95fe09` — backfill_guardian_default_pm_set RPC.
- **J10-P1-C3** `88505399` — admin-backfill-default-pm driver.
- **J10-P1-C4** `93a43f17` — list/detach PMs on platform account.
- **J10-P1-C5** `34690289` — 1-day final reminder + PM brand/last4/
  expiry + warning.
- **J10-P1-C6** — docs close (this commit).

##### Phase 1 follow-ups (filed)

- **J10-F2** — saved-PMs list and reminder PM lookup duplicate the
  brand-label dictionary. Medium-term: shared TS module consumable
  from both Vite (frontend) and Deno (edge fns). Low priority while
  the dictionary stays this small.
- **J10-F4** — observability for the backfill driver. Right now the
  caller sees `{processed, updated, skipped, errors}`. Long-running
  org-level audit_log entry with the same shape would let operators
  diff before/after over time.
- **J10-F7** — `stripe-auto-pay-installment` failure-mode coverage
  (PM declined / requires_action / card expired at charge time).
  J10 Phase 1 closes the capture and reminder gaps; the actual
  charge-attempt failure paths are Phase 2 territory.

#### Phase 2 — Charge failure handling, pause + recovery (closed 25 April 2026)

5 commits + docs close. Findings addressed: J10-F8, J10-F9, J10-F11,
J10-F12, J10-F14. Closes the J10-F7 follow-up filed at end of Phase 1.

Before Phase 2: a stuck installment retried on the same idempotency
key every day, the catch block sent a single hard-coded "card declined"
email regardless of error code, parents got that email every day, and
operators got nothing. After Phase 2: every charge attempt is logged,
guardians pause after 3 consecutive failures, parents get error-code-
aware emails (deduped on same-error-within-20h), and operators get one
per-org summary alert per cron run with any failures.

- **J10-F8 attempt log** — new `auto_pay_attempts` table with one row
  per cron-attempted charge regardless of outcome (`succeeded`,
  `failed`, `requires_action`, `skipped_paused`). Captures Stripe PI
  id, status, error code/type/message, plus a `notification_sent` flag
  for dedup. RLS: org staff SELECT via `is_org_staff(auth.uid(), org_id)`;
  service role writes only.
- **J10-F12 pause state** — `guardian_payment_preferences` extended
  with `auto_pay_paused_at`, `auto_pay_paused_reason`,
  `consecutive_failure_count` (NOT NULL DEFAULT 0). Cron skips
  paused guardians, logging a `skipped_paused` attempt for visibility.
  Counter increments on every failure / requires_action; pauses at 3.
  Counter resets on success but pause flag is NOT cleared on success
  — pause survives a manual portal payment; parent must explicitly
  re-enable from the portal.
- **J10-F9 + F14 tailored notification** — new
  `send-auto-pay-failure-notification` edge fn (service-role auth,
  exact bearer match) with error-code-aware copy: `expired_card`,
  `insufficient_funds`, `requires_action` + `authentication_*`,
  `card_not_supported`, `card_declined`, fallback. Pause notice block
  appended when `is_pause_threshold=true`. Dedup uses
  `auto_pay_attempts` (the table is the source of truth) — same
  installment + same `stripe_error_code` within 20h is suppressed; a
  changed error code escapes dedup because the change is informative
  (yesterday `card_declined` → today `expired_card`).
- **J10-F12 operator alert** — new `send-auto-pay-alert` edge fn
  mirrors J9 P3's `send-recurring-billing-alert` recipient pattern
  (owner + admin + finance via `org_memberships`, auth admin API for
  emails, batched `recipient_type='finance_team'` message_log row).
  Cron tail-end loop groups results by org and fires one alert per
  org with any failure / requires_action / paused. 6h dedup keyed on
  `org_id` (related_id is uuid; can't pack run_date into it).
- **J10-F11 reminder coordination** — `overdue-reminders` now batches
  a single `guardian_payment_preferences` query and skips guardians
  with active auto-pay (enabled + has default PM + not paused).
  Layered on top of the existing `payment_plan_enabled` skip (the
  invoice loop already has). Paused guardians and guardians without a
  default PM are NOT skipped — they need the standard channel.

##### Phase 2 architecture notes

- **Pause scope is per-guardian-per-org.** A parent paused at one
  academy can still be active-auto-pay at another. `guardian_payment_preferences`
  has UNIQUE(guardian_id, org_id) so the pause flag lives on the
  per-org row; multi-org parents are independently paused.
- **Pause resume is explicit, not automatic.** A succeeded charge
  resets `consecutive_failure_count` but does not clear
  `auto_pay_paused_at`. Operator/parent intent: a parent who fixes
  the card once, re-enables once. A manual portal payment shouldn't
  silently re-arm auto-pay.
- **Notification dedup uses the attempt log, not message_log.**
  message_log has no metadata column to pack `error_code` into for
  comparison, and `related_id` is uuid. Using `auto_pay_attempts`
  (which has `stripe_error_code` and `notification_sent`) keeps the
  dedup logic simple and lets the table itself drive the comparison.
- **Cross-cron coordination is one-way.** Auto-pay doesn't gate on
  overdue-reminders (it's the primary channel); overdue-reminders
  defers to auto-pay only when active. Pausing flips the flag back —
  no signal needed between the two crons because both read the same
  `guardian_payment_preferences` row.
- **Race between two cron invocations of the same guardian is
  acceptable.** Within a single cron pass the loop is sequential.
  Cross-pass races (e.g. operator manual trigger overlapping the
  scheduled cron) could double-increment the counter or send one
  extra failure email. The 20h notification dedup catches over-sends;
  the worst-case "one extra failure email" is far better than the
  pre-Phase-2 "every day forever".
- **`source='auto_pay_cron'`** added to the `message_log.source`
  CHECK in the C1 migration. New value because none of the existing
  values (`recurring_scheduler`, `parent_portal`, etc.) describe a
  charge-cron-initiated send.

##### Phase 2 commit ledger

- **J10-P2-C1** `2807d00` — auto_pay_attempts table + pause columns
  on guardian_payment_preferences; message_log.source CHECK extended.
- **J10-P2-C2** `ad29309` — send-auto-pay-failure-notification fn
  with error-code copy + 20h same-code dedup via auto_pay_attempts.
- **J10-P2-C3** `4c911bb` — cron writes attempt log on every path,
  increments counter and pauses at 3, resets on success, invokes
  notification fn (replaces inline Resend email).
- **J10-P2-C4** `b0c9e6c` — send-auto-pay-alert fn + tail-end hook
  in the cron that fires one alert per affected org per run.
- **J10-P2-C5** `db87d6a` — overdue-reminders batch-skips guardians
  with active auto-pay.
- **J10-P2-C6** — docs close (this commit).

##### Phase 2 deviations from brief

- **`is_org_staff` argument order.** Brief documented
  `(org_id, user_id)` but the function signature in
  `20260120215727` is `(_user_id, _org_id)` and every existing call
  site uses `is_org_staff(auth.uid(), org_id)`. C1 migration uses
  the correct order.
- **`message_log.metadata` does not exist.** Brief specified inserting
  `metadata: { error_code, attempt_id, is_pause_threshold }` but
  the column is absent. C2 dedups via `auto_pay_attempts` (which
  has the same data on its own row) instead of mutating message_log
  schema for one consumer.
- **`source='cron'` is not in the CHECK constraint.** Added
  `'auto_pay_cron'` to `message_log_source_check` in C1 (additive,
  idempotent).
- **`from` address for parent-facing emails.** Brief said
  `noreply@mail.lessonloop.net` but every other parent-facing
  payment email in the repo (J5 send-refund-notification, J9
  send-recurring-billing-alert) uses `billing@lessonloop.net`.
  Matched repo convention.
- **`/settings/billing` route doesn't exist.** Brief's documented
  fallback was `/dashboard`; used that for the operator alert CTA.
- **`message_log.related_id` is uuid.** Brief's J9 P3 alert pattern
  used a string dedup key, which would silently fail INSERT. C4
  alert dedups on `(message_type, related_id=org_id)` over a 6h
  window — uuid-clean and the cron runs once daily.

##### Phase 2 follow-ups (filed earlier; not in this phase)

- **J10-F10** — `payment_intent.payment_failed` webhook is a no-op.
  Phase 2 closes the synchronous-failure path (off-session card
  declined at create time, the catch block); the async-failure path
  (3DS confirmation that fails after the cron has moved on) is
  filed separately.
- **J10-F13** — transient vs permanent retry classification.
  Currently every failure increments the counter equally; a Stripe
  500 / network timeout shouldn't count toward the pause threshold
  the same as a card_declined. Filed for a follow-up phase that
  splits Stripe error types into retryable and non-retryable buckets.

---

## Track 0.8 Phase 1 — Cron auth standardisation

Closed 25 April 2026. Three code commits + one docs commit.

### Why

Audit found 10 of 12 production crons silently 401-failing every
day. Four different auth patterns had drifted into the codebase:

- **A inline** — `authHeader.includes(supabaseServiceKey)`. Worked
  in three auto-pay fns; brittle substring match against a Bearer
  token.
- **C vault** — `x-cron-secret` from `vault.INTERNAL_CRON_SECRET`,
  validated server-side via `validateCronAuth`. Canonical but the
  vault entry was empty until 25 April.
- **D config** — `x-cron-secret` from
  `current_setting('app.settings.internal_cron_secret')`. The
  PostgreSQL config was never set in production.
- **E config** — `x-cron-secret` from
  `current_setting('app.settings.cron_secret')`. Same.

Two further crons (`overdue-reminders-daily`,
`recurring-billing-scheduler-daily`) were registered with Pattern A
headers but the edge fns used `validateCronAuth` — header-name
mismatch (`Authorization` vs `x-cron-secret`), 401 every call.

Net effect: only the three Pattern A inline fns
(`auto-pay-upcoming-reminder`, `stripe-auto-pay-installment`,
`auto-pay-final-reminder`) were actually working. Auto-pay charges,
overdue reminders, credit expiry, recurring billing,
calendar-busy refresh and orphan cleanup were all dead.

### Code commits (3)

#### C1 — fix(cron): standardise all cron auth on vault INTERNAL_CRON_SECRET (T08-P1-C1)

Single migration `supabase/migrations/20260501100000_cron_auth_standardisation.sql`.
Re-registers all 12 crons with the canonical Pattern C template:
`x-cron-secret` populated from `vault.decrypted_secrets` at call
time. The 12 DO blocks are intentionally repeated rather than
refactored into a loop so each cron is readable in isolation.
Existing schedules and job names preserved. Body is `'{}'::jsonb`
across all 12 — verified every receiving fn ignores the request
body.

`cleanup-orphaned-resources` schedule (`0 3 * * *`) was sourced
from the fn header doc-comment as no committed migration existed
for it. Operator should reconcile post-deploy if production was
running on a different cadence.

#### C2 — fix(cron): three Pattern A edge fns now use validateCronAuth (T08-P1-C2)

`auto-pay-upcoming-reminder`, `auto-pay-final-reminder`,
`stripe-auto-pay-installment`. Each fn now imports
`validateCronAuth` and calls it before any other work. The unused
`authHeader` local and inline 401 block removed.
`supabaseServiceKey` is still read for Supabase client construction
— that concern unchanged.

After C1's migration, these three fns receive `x-cron-secret`
headers instead of `Authorization: Bearer`, so without C2 they
would 401 on every cron call. C1 + C2 must ship together.

#### C3 — fix(cron): cleanup-orphaned-resources uses validateCronAuth (T08-P1-C3)

The fn carried its own inline `cronSecret !== Deno.env.get(
"INTERNAL_CRON_SECRET")` check that was functionally equivalent to
`validateCronAuth` but inconsistent. Replaced for consistency.

C1 already drops the legacy hardcoded anon JWT from the cron
registration; C3 closes the loop on the fn side.

### Docs commit (1)

`docs/CRON_AUTH.md` (new, ~70 lines) documents the canonical
Pattern C template, why-this-pattern, the four-pattern history,
and the "add a new cron" recipe.

`docs/CRON_JOBS.md` rewritten to list all 12 crons with the
schedules registered in the standardisation migration; auth column
removed in favour of the global "all use Pattern C" header.

`LESSONLOOP_PRODUCTION_ROADMAP.md` Track 0.8 entry added with
Phase 1 status and Phase 2 (T08-F5 watchdog) outline.

### Findings addressed

- **T08-F1** — vault.INTERNAL_CRON_SECRET empty in production.
  Operator populated 25 April; C1 standardises every cron to
  consume it.
- **T08-F2** — four auth patterns layered into the codebase. C1
  standardises every registration on Pattern C; D and E config
  keys are no longer referenced anywhere.
- **T08-F3** — `cleanup-orphaned-resources` carried a hardcoded
  anon JWT (legacy artefact) plus inline auth. Both removed.
- **T08-F4** — three auto-pay fns used inline `authHeader.includes`
  instead of `validateCronAuth`. C2 closes this.

### Findings filed for Phase 2

- **T08-F5** — cron-health watchdog. Today there is no in-app
  signal when a cron silently 401-fails for days. Phase 2 adds a
  poller against `cron.job_run_details` + `net._http_response` that
  surfaces failures on the admin dashboard within one cycle, plus
  an org-level alert when a cron is in a sustained-failure state.

### Deviations from brief

- Brief asked to query production `cron.job` to confirm the
  `cleanup-orphaned-resources` schedule. No DB access is available
  to this session. Used the fn header doc-comment ("Runs daily at
  3 AM via pg_cron") and called this out explicitly in both the
  migration body and the commit message. Operator must verify
  post-deploy.

### Patch (C5) — fold 2 missed HTTP crons + drop calendar duplicate

Operator ran `SELECT jobname FROM cron.job` against production
during deploy verification and found the C1 migration's 12-cron
table was incomplete. Production actually had 16 crons:

- **12 covered by C1.**
- **2 SQL-only** (no HTTP, no auth concern, deliberately untouched):
  `complete-expired-assignments`, `reset-stale-practice-streaks`.
- **2 HTTP, silently dead with Pattern A header mismatch**:
  `send-lesson-reminders` (hourly, fn uses `validateCronAuth`),
  `calendar-refresh-busy` (every 15 min, fn uses
  `validateCronAuth`).
- **1 HTTP duplicate of calendar-refresh-busy at half cadence**:
  `refresh-calendar-busy-blocks` (Pattern E, `app.settings.cron_secret`
  NULL — dead from day one). The 15-minute one is canonical;
  operator chose to drop the 30-min duplicate.

Note: this `refresh-calendar-busy-blocks` registration was the same
one C1 attempted to standardise (sourced from migration
`20260223100000_calsync_cron_guardian_health.sql`). The C5 patch
unschedules it again rather than re-registering — operator
preference for the 15-min cadence supersedes the original 30-min
schedule.

Single migration `20260501100100_cron_auth_standardisation_patch.sql`:
unschedules `refresh-calendar-busy-blocks`, then re-registers
`calendar-refresh-busy` (`*/15 * * * *`) and `send-lesson-reminders`
(`0 * * * *`) with the canonical Pattern C template.

Coverage: 14 of 14 HTTP crons now on Pattern C; 2 SQL-only crons
correctly untouched.

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

## Track 0.5 Phase 1 — Stripe webhook dedup correctness

Closed (pending deploy + smoke). Five commits.

### Why

The previous webhook dedup pattern inserted a row into
`stripe_webhook_events` at handler entry, before dispatching the
handler. If anything in the handler then threw — transient DB
blip during `record_stripe_payment`, network glitch on a refund
INSERT, anything — the row remained, and Stripe's automatic retry
hit the 23505 short-circuit and ack'd `duplicate=true` without
re-running the handler. Real-money risk: a transient error during
`payment_intent.succeeded` could leave the customer charged with
no `payments` row.

`send-payment-receipt` had zero internal idempotency, so the
moment handlers actually re-ran on retry under any new dedup
scheme, the receipt would be double-sent.

### Code commits (4) + docs (1)

#### C1 — feat(webhook): two-phase dedup schema for stripe_webhook_events (T05-P1-C1) — `6c09148`

`supabase/migrations/20260502100000_webhook_dedup_two_phase.sql`.
Drops `NOT NULL` and `DEFAULT now()` from
`stripe_webhook_events.processed_at` so the column can carry
`NULL` to mean "in flight, handler not complete". Adds a
`created_at` column for stale-row scans (the original schema
overloaded `processed_at` for both received and completed
times). Adds a partial index `(event_id, created_at) WHERE
processed_at IS NULL` so the stale-row check is O(log n) rather
than a sequential scan on every webhook arrival. All operations
use `IF NOT EXISTS` / `DROP IF EXISTS` for Lovable's UUID-mirrored
re-run.

#### C2 — feat(webhook): two-phase dedup with stale-row recovery (T05-P1-C2) — `22edf5d`

`supabase/functions/stripe-webhook/index.ts`. Replaces the
insert-first dedup block with a claim-then-dispatch flow:

- **Claim:** INSERT with `processed_at = NULL` and `.select()`.
  If 23505, re-read the row to inspect state.
- **Already-processed (`processed_at` non-NULL):** return
  `200 duplicate=true`.
- **In-flight (`processed_at` NULL, age < 90s):** return
  `409 in_flight=true` so Stripe retries later.
- **Stale (`processed_at` NULL, age ≥ 90s):** the previous
  attempt crashed before its catch could DELETE. Log a
  structured `webhook_stale_recovery` line, DELETE the orphan,
  re-claim, fall through.
- **Dispatch:** existing `switch` wrapped in a try/catch.
- **Success:** UPDATE `processed_at = now()` predicated on
  `is null` so a racing release cannot turn a completed row
  into the wrong state.
- **Failure:** DELETE the in-flight row predicated on `is null`
  so Stripe's retry can re-INSERT and re-run the handler.

90s stale threshold leaves 60s headroom over the 150s edge fn
timeout. No handler bodies modified.

#### C3 — fix(webhook): preserve past_due_since across retries (T05-P1-C3) — `7d73101`

`handleSubscriptionPaymentFailed`. Previously wrote
`past_due_since = now()` unconditionally; under the new dedup
pattern a Stripe retry of `invoice.payment_failed` actually
re-runs the handler and would overwrite the original past-due
timestamp with the retry time, silently shortening the 7-day
grace window in feature gating. Read `past_due_since` on lookup
and only set it when currently NULL. Status flag still flips to
`past_due` every time so a manual clearance gets corrected on
the next event.

#### C4 — fix(receipt): idempotency via message_log.payment_id (T05-P1-C4) — `fe20535`

`supabase/migrations/20260502110000_message_log_payment_id.sql`
adds a `payment_id uuid REFERENCES payments(id) ON DELETE SET
NULL` column to `message_log`, plus a partial UNIQUE on
`(payment_id) WHERE message_type='payment_receipt' AND
payment_id IS NOT NULL`. Other message_types unaffected.

`supabase/functions/send-payment-receipt/index.ts`: pre-checks
for an existing receipt row by `(message_type, payment_id)` and
short-circuits with `duplicate=true` if found; the insert path
catches 23505 to handle the concurrent-invocation race; the
post-Resend status update keys on `payment_id` (now uniquely
addressable) instead of the prior order-by-created_at-limit-1
hack on `related_id`.

#### C5 — docs (T05-P1-C5)

New `docs/WEBHOOK_DEDUP.md`. Updates `LESSONLOOP_PRODUCTION_ROADMAP.md`
Track 0.5 entry to closed (Phase 1). Appends this section to
POLISH_NOTES.

#### C6 — feat(audit): platform_audit_log + wire stale recovery (T05-P1-C6)

`supabase/migrations/20260502120000_platform_audit_log.sql` adds the
new platform-scoped audit table (action / source / severity / details
/ created_at). Service-role only, no RLS policies for users. Indexed
on `(action, created_at DESC)`, `(created_at DESC)`, and a partial
`(severity, created_at DESC) WHERE severity IN ('warning','error',
'critical')` for fast operator scans.

`stripe-webhook` stale-recovery emit site rewritten: now inserts a
`platform_audit_log` row with `action=webhook_stale_recovery`,
`severity=warning`. The previous `console.error` line is preserved as
a fallback only if the insert itself fails — the signal is never
lost.

`docs/PLATFORM_AUDIT_LOG.md` (new) documents the table contract,
severity ladder, current and planned emitters, RLS posture, append-only
convention, and the operator queries by action/severity/recency.

`docs/WEBHOOK_DEDUP.md` updated: stale-recovery operator query now
reads `platform_audit_log` instead of grepping function logs; the
narrative section points at the new table and the `console.error`
fallback is documented as such.

Closes T05-F9.

### Findings addressed

- **T05-F1** — insert-first dedup loses retries on transient handler
  failure. Closed by C1 + C2.
- **T05-F2** — `past_due_since` overwritten on retry. Closed by C3.
- **T05-F4** — `send-payment-receipt` not idempotent. Closed by C4.
- **T05-F7** — schema overloads `processed_at`; need separate
  received vs completed timestamps. Closed by C1 (`created_at`).
- **T05-F8** — no recovery path for crashed in-flight rows. Closed
  by C2 (90s stale threshold + delete + re-claim).

### Findings closed in C6

- **T05-F9** — `audit_log.org_id` is NOT NULL, so platform-level
  events (such as the webhook stale-recovery audit row C2 was
  asked to write) cannot be persisted to `audit_log`. **Resolved**
  by adding a separate `platform_audit_log` table
  (`supabase/migrations/20260502120000_platform_audit_log.sql`)
  with `action / source / severity / details / created_at` columns,
  service-role-only, indexed for action+recency and severity+recency
  lookups. Stale recoveries now write
  `(action=webhook_stale_recovery, severity=warning, details=…)`
  rows; the `console.error` fallback fires only if the insert
  itself fails. Reference: `docs/PLATFORM_AUDIT_LOG.md`.

### Deviations from brief

- Brief asked C2 to insert `audit_log` rows with `org_id: null` for
  webhook stale recovery. Walk on the actual schema confirmed
  `audit_log.org_id` is `NOT NULL` — that insert would have failed
  silently and the recovery path would still execute, but the
  observability trail would be missing. Substituted a structured
  `console.error("[stripe-webhook] webhook_stale_recovery", ...)`
  emission. Logged as T05-F9 above.
- Brief said the original webhook events table column was
  `processed_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Confirmed
  exactly that on read (`20260222220737_*.sql:8`).

### Deploy + smoke

- Deploy date: 2026-04-25 (22:50 UTC)
- Smoke test result: Schema verification passed (4-row check via
  Lovable). End-to-end Stripe webhook smoke deferred until first live
  event arrives — two-phase dedup is observable via the
  `stripe_webhook_events.processed_at` column on first real webhook
  arrival. Operator follow-ups (run when live traffic provides the
  signal):
  - Manually re-deliver a `payment_intent.succeeded` event from
    Stripe Dashboard. Confirm first delivery 200, second 200
    `duplicate=true`.
  - Manually trigger a payment with a forced DB error in
    `record_stripe_payment` (e.g. revoke perms briefly): confirm
    500, in-flight row DELETEd, then restore perms and replay:
    confirm 200 with the payment row landing.
  - Force a stale row by inserting `(event_id, event_type,
    processed_at=NULL, created_at=now() - interval '120 seconds')`
    then sending an event with the same id; confirm
    `webhook_stale_recovery` row in `platform_audit_log` and
    successful processing.
  - Re-deliver a `payment_intent.succeeded` and confirm the
    parent receives exactly one receipt email (UNIQUE on
    `message_log.payment_id`).

## Track 0.5 Phase 2 — Webhook surface retention + migration conventions

### Why

Phase 1 closed the dedup-correctness gap on `stripe_webhook_events`
and added `platform_audit_log` for org-less events. Phase 2 closes the
three operational follow-ups filed during the Phase 1 walk:

- **T05-F10** — both surfaces grow unbounded with no retention.
- **T05-F11** — `NOTIFY pgrst, 'reload schema'` usage was inconsistent
  across recent migrations; reviewers had to guess when it was needed.
- **T05-F12** — `ENABLE ROW LEVEL SECURITY` with no `CREATE POLICY` is
  intentional for service-role-only tables, but the convention was
  undocumented and indistinguishable from a bug to a future security
  audit.

### Code commits (2) + docs (2)

#### C1 — feat(retention): cleanup_webhook_retention SQL function (T05-P2-C1) — `b5f7146`

`supabase/migrations/20260503100000_webhook_event_ttl.sql` adds
`public.cleanup_webhook_retention()`. SECURITY DEFINER with
`SET search_path TO 'public'`, `REVOKE ALL ... FROM PUBLIC` then
`GRANT EXECUTE ... TO service_role`. Body deletes completed
`stripe_webhook_events` (`processed_at IS NOT NULL`) older than 90d,
then deletes `platform_audit_log` rows older than 90d
(severity info/warning) or 365d (severity error/critical). Returns a
jsonb summary `{ webhook_events_deleted, platform_audit_log_deleted,
ran_at }` and writes the same payload as a `webhook_retention_sweep`
row into `platform_audit_log` so each run is itself observable.

#### C2 — feat(retention): cleanup-webhook-retention edge fn + daily cron (T05-P2-C2) — `7fd2a52`

`supabase/functions/cleanup-webhook-retention/index.ts` follows the
`cleanup-orphaned-resources` template: `validateCronAuth`, service-role
client, RPC `cleanup_webhook_retention()`, fallback insert of an
`error`-severity `webhook_retention_sweep_failed` row if the RPC
itself fails so the operator signal is preserved.

`supabase/migrations/20260503100100_webhook_retention_cron.sql`
registers `webhook-retention-daily` at `30 3 * * *` (03:30 UTC) using
the canonical Pattern C `DO $$ ... unschedule ... END $$;` then
`SELECT cron.schedule(...)` template from
`docs/CRON_AUTH.md`. 03:30 sits between `cleanup-orphaned-resources`
(03:00) and `recurring-billing-scheduler` (04:00), avoiding the
busier 06:00–09:00 window.

#### C3 — chore(docs): migration conventions reference (T05-P2-C3) — `1dfaaf0`

New `docs/MIGRATION_CONVENTIONS.md`. Captures the conventions
reviewers were previously inferring from recent migrations:

- Idempotency wrappers per object type (table, column, index,
  function, policy, cron, constraint).
- `NOTIFY pgrst, 'reload schema'` rule (when needed for PostgREST
  visibility, when not).
- Two coexisting RLS postures (user-readable vs service-role-only)
  with the required `COMMENT ON TABLE` for the latter so the intent
  is discoverable from `psql`.
- Function security: `SECURITY DEFINER` + pinned `search_path` +
  `REVOKE ALL FROM PUBLIC` then explicit `GRANT EXECUTE`.
- Cron auth pointer to `docs/CRON_AUTH.md` (Pattern C only).
- Commit subject format conventions used by journeys (J{N}) and
  tracks (T{NN}).

Closes T05-F11 + T05-F12.

#### C4 — chore(docs): Track 0.5 Phase 2 docs close (T05-P2-C4)

- `docs/WEBHOOK_DEDUP.md`: replace the manual-only "TTL cleanup"
  section with a "Retention" section pointing at the new daily cron;
  manual `DELETE` example kept as an operator escape hatch.
- `docs/PLATFORM_AUDIT_LOG.md`: replace "TTL guidance" stub with a
  full "Retention" section documenting the two-tier policy (90d
  info/warning, 365d error/critical) and the self-audit row each
  sweep writes.
- `docs/CRON_JOBS.md`: add `webhook-retention-daily` as entry #3
  (03:30 UTC slot); renumber remaining entries 4-14.
- `LESSONLOOP_PRODUCTION_ROADMAP.md`: Track 0.5 entry now reads
  "CLOSED (Phases 1 + 2)" with a Phase 2 paragraph closing F10/F11/F12.
- `POLISH_NOTES.md`: this section.

### Findings closed

- **T05-F10** — TTL retention undefined for both
  `stripe_webhook_events` and `platform_audit_log`. **Resolved** by
  C1 + C2 (daily sweep at 03:30 UTC; 90d for webhook events, 90/365d
  by severity for audit log).
- **T05-F11** — `NOTIFY pgrst` usage inconsistent across migrations.
  **Resolved** by C3 (rule documented:
  required for PostgREST-exposed schema changes, not for
  internal-only objects).
- **T05-F12** — RLS-enabled-no-policies convention undocumented.
  **Resolved** by C3 (convention documented; future
  service-role-only tables must carry an explanatory
  `COMMENT ON TABLE`).

### Deviations from brief

- Brief assumed `validateCronAuth(req)` returns `{ ok: boolean,
  reason?: string }`. Walk on `supabase/functions/_shared/cron-auth.ts`
  showed the actual signature is `(req: Request) => Response | null`
  (returns a 401 Response on failure, null on success). Adapted the
  C2 edge fn to match the actual signature and the
  `cleanup-orphaned-resources` canonical pattern. The brief's
  explicit "match cleanup-orphaned-resources exactly" instruction
  takes precedence over the template; behaviour is unchanged.
- Brief instructed `deno check` on the new edge fn before commit;
  Deno is not available in the local environment. Lovable's deploy
  pipeline will exercise the type-check on apply.

### Walk observations not in brief (filed for triage)

- **T05-F13** — `docs/CRON_JOBS.md` opening line still claimed "All
  12 crons" before this phase. Already 13 by the time of the Phase 1
  walk (`send-lesson-reminders` was added later). Updated in C4 to
  drop the literal count. Low priority; flag for any future doc
  hygiene sweep.

### Deploy + smoke

- Deploy date: <pending>
- Smoke test result: <pending>
  - Verify `webhook-retention-daily` appears in `cron.job` with
    schedule `30 3 * * *` after Lovable apply.
  - Manually invoke `SELECT public.cleanup_webhook_retention();` as
    service-role; confirm a `webhook_retention_sweep` row appears in
    `platform_audit_log` with the deleted-counts payload.
  - On the first cron tick (03:30 UTC), confirm a second
    `webhook_retention_sweep` row appears with the cron's invocation
    timestamp.
  - Force the failure path (e.g. `REVOKE EXECUTE ON FUNCTION
    public.cleanup_webhook_retention() FROM service_role` briefly)
    and confirm a `webhook_retention_sweep_failed` row lands with
    severity `error`.

## Journey 11 Phase 1 — Server-side invoice PDF foundation

### Why

Before J11, jsPDF rendered invoices in the browser only. Email
functions (`send-invoice-email`, `send-payment-receipt`) shipped HTML
with no PDF attachment because there was no path to a PDF outside an
authenticated browser tab. The parent portal had no shareable
download URL. Any background flow that needed an invoice PDF was
blocked.

J11 P1 ships the foundation: a shared renderer (Deno + browser
mirrors), a service-role edge fn that produces and caches the PDF in
storage, and the audit + cache-invalidation plumbing. **No consumer
wiring lands in P1.** P2 wires the invoice email attachment and
refactors `useInvoicePdf` to consume the shared renderer; P3 wires
the receipt attachment.

### Code commits (4) + docs (1)

#### C1 — feat(pdf): invoice-pdfs storage bucket + pdf_rev cache invalidation (J11-P1-C1) — `4a7d881`

`supabase/migrations/20260504100000_invoice_pdfs_storage.sql`:

- New `invoice-pdfs` storage bucket: private, 10MB cap (real invoices
  are <500KB; cap is defensive), `application/pdf` only,
  service-role-only RLS. Idempotent insert (`ON CONFLICT (id) DO
  NOTHING`) and drop-then-create policy following the existing
  `teaching-resources` and `org-logos` patterns.
- New `invoices.pdf_rev` integer column (NOT NULL DEFAULT 0) with a
  `COMMENT ON COLUMN` documenting its purpose.
- Four sister triggers keep `pdf_rev` in sync with anything that
  affects rendered PDF output:
  1. `invoices` BEFORE UPDATE — bumps when `status`, `total_minor`,
     `subtotal_minor`, `tax_minor`, `vat_rate`, `paid_minor`,
     `credit_applied_minor`, `due_date`, `issue_date`,
     `invoice_number`, `notes`, `payment_plan_enabled`,
     `installment_count`, or payer FKs change. Excludes `updated_at`
     and other columns the PDF doesn't render.
  2. `invoice_items` AFTER INSERT/UPDATE/DELETE — line items table.
  3. `invoice_installments` AFTER INSERT/UPDATE/DELETE — payment
     schedule block.
  4. `payments` AFTER INSERT/UPDATE/DELETE — Paid / Amount Due
     summary block (`useInvoicePdf.ts:471-488` sums the payments
     table). The brief asked to verify whether this fourth trigger
     was needed; the walk confirmed yes.

  All four trigger functions are SECURITY DEFINER + pinned
  search_path + REVOKE ALL FROM PUBLIC.

#### C2 — feat(pdf): lift renderInvoicePdf to shared modules (deno + browser) (J11-P1-C2) — `0eea199`

Two new mirror files containing a single shared `renderInvoicePdf`
function:

- `supabase/functions/_shared/invoice-pdf.ts` (Deno; jsPDF via
  `https://esm.sh/jspdf@4`).
- `src/lib/invoice-pdf-renderer.ts` (browser; jsPDF from the
  `jspdf` npm package).

Bodies are byte-identical except for the import line. Header
comments document the sync-by-hand discipline. The contract type
`InvoicePdfInput` is duplicated, not shared, because Deno cannot
import from `src/`.

The body is the lifted `generatePdf` function from
`useInvoicePdf.ts:222-665` with three changes:

- `logoImg: HTMLImageElement | null` → `logoDataUrl: string | null`.
  The renderer now calls `doc.addImage(dataUrl, ...)`. Image
  fetching is the caller's responsibility.
- Every `parseISO(x)` replaced with `new Date(x)` (4 sites).
- `formatDateUK` reimplemented inline using UTC components, replacing
  the date-fns + `@/lib/utils` import. Guarantees byte-equivalent
  output between server and browser regardless of system timezone.

Returns `Uint8Array` via `doc.output('arraybuffer')` instead of
`doc.save(filename)` (which was browser-only).

#### C3 — feat(pdf): generate-invoice-pdf edge function with caching (J11-P1-C3) — `1d465e6`

`supabase/functions/generate-invoice-pdf/index.ts`. Service-role
only (the same `Authorization: Bearer ${service_key}` gate used by
`send-invoice-email-internal`). End-user flows route through email
functions which already gate on the user JWT.

Request: `{ invoice_id, force_regenerate?, return_bytes? }`.
Response: `{ success, cached, filename, signed_url? | pdf_base64? }`.

Flow:

1. Fetch invoice + payer joins, compute cache path
   `{org_id}/{invoice_id}_{pdf_rev}.pdf`.
2. Cache hit (unless `force_regenerate`): return signed URL or base64.
3. Cache miss: parallel fetch `invoice_items`, `payments`,
   `invoice_installments` (only when `payment_plan_enabled`),
   `organisations`. Pre-load `org.logo_url` via native `fetch` →
   `arrayBuffer` → base64 → `data:` URL (renderer never touches
   `Image`). Render via shared module. Upload to bucket
   (`upsert: true`). Audit. Return signed URL or base64.

Implementation notes:

- Cache upload failure is non-fatal: the PDF is still returned to the
  caller, just not cached.
- Logo fetch failure is non-fatal: the renderer simply skips the
  logo block.
- Base64 encoding uses 32KB chunks via
  `String.fromCharCode.apply(null, subarray)` — naive
  `String.fromCharCode(...bytes)` stack-overflows on PDFs over ~100KB
  due to argument-list limits. Used in both the cache-hit and
  cache-miss base64 paths.
- Audit row: `action='pdf_generated_server'` (vs `pdf_generated`
  used by client `useInvoicePdf` — chose distinct so operators can
  tell teacher downloads apart from email-driven renders).
  `actor_user_id` is `NULL` (no user JWT in this fn).
- Signed URL TTL: 7 days.

#### C4 — fix(branding): rename brand_primary_color → brand_color in edge fns (J11-F1 | J11-P1-C4) — `a3ed0e6`

The `organisations` column was renamed `brand_primary_color` →
`brand_color` in the database (the client side already uses
`brand_color` everywhere), but three edge functions still selected
and read the old name. Postgres returned `null` for that field on
every read, so the branded headers in invoice / overdue / lesson-
reminder emails silently fell back to `#2563eb` (the LessonLoop
default) regardless of the org's configured brand.

Renamed in:

- `supabase/functions/_shared/send-invoice-email-core.ts` (3 sites)
- `supabase/functions/overdue-reminders/index.ts` (6 sites — 2
  selects, 2 type annotations, 2 reads)
- `supabase/functions/send-lesson-reminders/index.ts` (3 sites)

`grep -rn "brand_primary_color" .` is now empty across the repo.

Closes J11-F1.

#### C5 — chore(docs): J11 P1 architecture + INVOICE_PDF.md (J11-P1-C5)

- New `docs/INVOICE_PDF.md`: architecture (mirror-by-hand
  discipline), cache + invalidation (bucket layout, four triggers),
  edge fn contract (request / response / TTL), caller patterns
  (email attachment, parent portal download), audit shape
  (`pdf_generated_server` vs `pdf_generated`), operator queries
  (cache size, recent renders, force-clear).
- `LESSONLOOP_PRODUCTION_ROADMAP.md`: Journey 11 entry now reads
  "🟡 P1 closed (foundation); P2 + P3 pending (consumer wiring)"
  with the 5-commit summary, the planned P2/P3 scope, and J11-F2
  filed (bucket retention sweep).
- `POLISH_NOTES.md`: this section.

### Findings closed

- **J11-F1** — `brand_primary_color` references in 3 edge functions
  silently nulled out branded email headers, falling back to default
  blue. **Resolved** in C4 (rename to `brand_color`; zero references
  remain).

### Findings filed

- **J11-F2** — superseded cache objects accumulate in `invoice-pdfs`.
  Today, when `invoices.pdf_rev` increments, the prior
  `{org_id}/{invoice_id}_<old_rev>.pdf` object is left behind. A
  cron sweep mirrored on `cleanup-webhook-retention` would purge
  every object whose embedded `<rev>` is below the current invoice
  rev. Low priority — bucket size will grow slowly relative to the
  10MB-per-PDF cap.

### Deviations from brief

- Brief instructed `deno check` on each new edge fn / shared module
  before commit. Deno is not available in this environment.
  Hand-validated against `_shared/send-invoice-email-core.ts` and
  `cleanup-webhook-retention/index.ts` for shape (imports, CORS,
  service-role auth, error handling, response JSON). The browser
  mirror typechecks cleanly via `npx tsc --noEmit` against the
  project's `tsconfig.json`. Lovable's deploy pipeline will exercise
  the Deno type-check and the `https://esm.sh/jspdf@4` import on
  apply — flagged in the verification block below.
- Brief asked whether the renderer body had hidden browser
  dependencies beyond `loadImage`. Walk on
  `useInvoicePdf.ts:222-665` confirmed the only browser-specific
  signature was `logoImg: HTMLImageElement | null` (the `loadImage`
  helper itself stays browser-side outside the lifted body).
  `document` and `window` are not touched. `doc.save(filename)` at
  the end (browser-only) is replaced by
  `return new Uint8Array(doc.output('arraybuffer'))`.
- `useInvoicePdf.ts` is intentionally **not** modified in P1 (per
  brief). The browser mirror is created but not yet consumed; P2
  refactors `useInvoicePdf` to import from
  `src/lib/invoice-pdf-renderer.ts`.

### Verification

- **(a) `https://esm.sh/jspdf@4` import**. Deno is not installed in
  the local environment, so the import was not exercised end-to-end.
  Hand-validated by inspecting the existing `esm.sh` imports under
  `supabase/functions/` (e.g. `@supabase/supabase-js@2`) and
  confirming `jspdf` `^4.1.0` is the production version in
  `package.json`. **Lovable apply must verify** that
  `import { jsPDF } from "https://esm.sh/jspdf@4";` resolves and
  that the construction `new jsPDF({ unit: 'mm', format: 'a4' })`
  works under Deno. If it fails, fall back to an alternative jsPDF
  CDN mirror (e.g. `https://cdn.skypack.dev/jspdf@4`) before
  considering a different PDF library.
- **(b) Payments mutations and `pdf_rev`.** Yes — the rendered PDF
  includes a Paid / Amount Due block (`useInvoicePdf.ts:471-488`)
  that sums `inv.payments`. C1 includes the fourth sister trigger
  on `payments` (AFTER INSERT/UPDATE/DELETE → `UPDATE invoices SET
  pdf_rev = pdf_rev + 1 WHERE id = invoice_id`). Without it, the
  cache would persist a stale "Amount Due" until some other column
  on `invoices` mutated — which is not guaranteed for a manual
  payment recorded against a draft / sent invoice.

### Walk observations not in brief (filed for triage)

- **J11-F1** (closed in C4 — see above). Filed because the brief
  named it but tied it to C4; documenting here so it appears in the
  ledger.
- **J11-F2** (filed — see above).

### Deploy + smoke

- Deploy date: <pending>
- Smoke test result: <pending>
  - After Lovable apply, confirm `pdf_rev` column is present on
    `public.invoices` with default 0, and that `\d+ invoices` shows
    `trg_bump_invoice_pdf_rev` on the table.
  - Confirm bucket `invoice-pdfs` exists in
    `storage.buckets` with `public=false`, 10MB cap, and the
    service-role policy.
  - Service-role-invoke `generate-invoice-pdf` against a real
    invoice (cache miss), then call again with the same payload
    (cache hit). Verify both succeed and `cached` flips false → true.
  - Verify `audit_log` shows two rows with
    `action='pdf_generated_server'` (or one with cached=true having
    no audit if the cache hit path is intentionally silent — current
    impl writes audit only on cache miss).
  - Mutate the invoice (e.g. add a payment), call
    `generate-invoice-pdf` again, verify the response shows
    `cached: false` (because `pdf_rev` incremented and the new path
    misses).
  - Sanity-check the rendered PDF visually against the existing
    teacher-side download for the same invoice — they must look
    byte-equivalent (UTC date format, identical layout, same
    branding).

### Pre-merge patch — C6 + C7 (revised total: 7 commits, not 5)

The original P1 review surfaced two issues that needed to land before
merge: a CDN failure (esm.sh 503) blocking the Deno-side renderer
build, and the J11-F2 orphan-accumulation finding that was filed but
left for "later". Both are addressed below; P1 closes at 7 commits.

#### C6 — fix(pdf): switch jsPDF import to npm: specifier (J11-P1-C6) — `3b43246`

`supabase/functions/_shared/invoice-pdf.ts`. Single-line import
change plus preamble update:

- Old: `import { jsPDF } from "https://esm.sh/jspdf@4";`
- New: `import { jsPDF } from "npm:jspdf@4.1.0";`

esm.sh started returning 503 for the jspdf URL. Deno 2 has native
npm: specifier support that pulls directly from the npm registry —
no CDN fragility, no node_modules required. Pinned to `4.1.0` to
match `package.json`'s `^4.1.0`. chat-Claude verified end-to-end in
Deno 2.7.13 before the switch: the import resolves cleanly, a
trivial `new jsPDF().output('arraybuffer')` produces ~4KB output
with valid `%PDF` magic bytes, and branded shapes (`roundedRect`,
`setFillColor`, `addImage`) render correctly.

The browser mirror (`src/lib/invoice-pdf-renderer.ts`) is unchanged
and continues to import from the `jspdf` npm package via Vite. The
preamble in the Deno file now makes the one allowed difference
explicit: `Deno: npm:jspdf@4.1.0; Browser: jspdf`.

#### C7 — feat(retention): cleanup-invoice-pdf-orphans daily cron (J11-F2 | J11-P1-C7)

Closes the J11-F2 finding filed in C5 ("superseded cache objects
accumulate forever"). Two files:

- `supabase/functions/cleanup-invoice-pdf-orphans/index.ts` — Pattern
  C cron edge fn. Lists every object in the `invoice-pdfs` bucket,
  parses the `{org_id}/{invoice_id}_{rev}.pdf` path scheme, batches
  a lookup of `invoices.pdf_rev` for the union of invoice ids, and
  deletes any cached object whose embedded rev is below the current
  `pdf_rev` (or every cached object for an invoice whose row no
  longer exists). Deletes are chunked at 100 per Storage `remove()`
  call. Self-audits each sweep into `platform_audit_log` with
  `action='invoice_pdf_orphan_sweep'` (severity `info` — counts in
  `details` for ops visibility) or
  `'invoice_pdf_orphan_sweep_failed'` (severity `error`) on the
  failure path. Mirrors the `cleanup-webhook-retention` shape from
  T05-P2-C2.
- `supabase/migrations/20260504100100_invoice_pdf_orphan_cron.sql` —
  defines the `public.list_invoice_pdf_objects()` RPC (SECURITY
  DEFINER, search_path pinned to `public, storage`, REVOKE ALL +
  GRANT EXECUTE TO service_role) and registers
  `invoice-pdf-orphan-sweep-daily` at `45 3 * * *` UTC via the
  canonical Pattern C `DO $$ unschedule ... END $$;` then
  `cron.schedule(...)` template.

Storage enumeration strategy: PostgREST does not expose the
`storage` schema by default, so a direct
`supabase.from('storage.objects').select(...)` call fails fast.
The edge fn tries it anyway as the primary path and falls through
to the RPC on the expected error. Both paths converge into the
same in-memory list. The 20000-object cap on the RPC matches the
edge fn's batch ceiling.

Slot reasoning: 03:45 UTC sits between the existing 03:30
`webhook-retention-daily` and 04:00 `recurring-billing-scheduler-
daily`, sharing no minute slot with another cron. Verified in
`docs/CRON_JOBS.md` before registration.

Doc updates included in the same commit:

- `docs/CRON_JOBS.md` — new entry #4 for `invoice-pdf-orphan-sweep-
  daily`; entries 5-15 renumbered. Preamble now references the new
  migration alongside the standardisation + webhook-retention
  registrations.
- `docs/INVOICE_PDF.md` — new "Cache hygiene" section describing
  the sweep (what it deletes, what it always preserves, the
  self-audit shape, the operator query, and the RPC strategy). The
  former "Future" follow-up bullet pointing at this work is
  removed since the work is now done.
- `LESSONLOOP_PRODUCTION_ROADMAP.md` — Journey 11 entry updated to
  "Seven commits" with C6 + C7 summaries appended; `Findings closed
  in P1` line replaces the old `Filed for later` line.
- `POLISH_NOTES.md` — this section.

### Findings closed (patch)

- **J11-F2** — superseded objects in the `invoice-pdfs` bucket
  accumulate when `pdf_rev` increments. **Resolved** by C7 (daily
  03:45 UTC sweep; the live current-rev object for every invoice is
  always preserved).

### Findings filed (patch)

None.

### Deviations from brief (patch)

- Brief showed `await validateCronAuth(req)` in the edge fn skeleton.
  Walk on `_shared/cron-auth.ts` confirmed the actual signature is
  synchronous: `(req: Request) => Response | null`. Used the
  canonical sync usage from `cleanup-webhook-retention/index.ts`
  (`const cronAuthError = validateCronAuth(req); if (cronAuthError)
  return cronAuthError;`). Behaviour is unchanged.
- Brief's edge fn skeleton included a leading `for` loop that called
  the storage `list("")` API and then `break`-ed unconditionally,
  with a comment explaining the per-folder list strategy was
  inefficient. That loop was effectively dead code (never reaches
  the second iteration; the result is discarded). Removed the loop;
  the direct `from('storage.objects')` query + RPC fallback are
  the only two paths, which is what the brief actually intended.
  The two-path safety net (direct query → RPC) is preserved.
- Brief had `severity: deleted > 0 ? "info" : "info"` (both branches
  yield "info" — appears to be a placeholder for future tuning).
  Simplified to `severity: "info"` with no ternary.
- Deno still not installed in this environment, so neither C6's
  import switch nor C7's edge fn was exercised end-to-end.
  Hand-validated structure against `cleanup-webhook-retention/
  index.ts`. The Lovable apply pipeline + the smoke test in the
  deploy block below will catch any runtime issues.

### Walk observations not in brief (patch)

None.

### Deploy + smoke (patch — superseding the C5 placeholders)

- Deploy date: <pending>
- Smoke test result: <pending>
  - **C6 / C3 verification:** after Lovable apply, service-role-
    invoke `generate-invoice-pdf` against any non-void invoice and
    confirm a 200 with `cached: false` (cache miss path), a row in
    `audit_log` with `action='pdf_generated_server'`, and a fresh
    object in `storage.objects` with `bucket_id='invoice-pdfs'` and
    a non-zero size. The successful render proves the
    `npm:jspdf@4.1.0` import resolved.
  - **C7 cron registration:** `SELECT jobname, schedule FROM
    cron.job WHERE jobname = 'invoice-pdf-orphan-sweep-daily';` —
    expect one row with schedule `45 3 * * *`.
  - **C7 RPC + sweep:** manually `SELECT * FROM public.list_invoice_
    pdf_objects() LIMIT 5;` as service-role to confirm the RPC
    works and returns rows. Then manually invoke the edge fn (with
    `x-cron-secret` header populated from
    `vault.decrypted_secrets`) and confirm a 200 plus a row in
    `platform_audit_log` with `action='invoice_pdf_orphan_sweep'`,
    `severity='info'`, and counts in `details`. On a fresh
    deployment with no orphans yet, expect
    `orphans_identified: 0`.
  - **C7 orphan delete (after at least one invoice mutation):**
    bump `pdf_rev` on a real invoice (e.g. add a line item),
    re-render via `generate-invoice-pdf` to write the new-rev
    object, then manually invoke the orphan sweep and confirm
    `orphans_deleted >= 1`. The `_<old_rev>.pdf` object should be
    gone from storage; the `_<new_rev>.pdf` object should remain.

## Journey 11 Phase 2 — Consumer wiring (invoice email PDF + renderer consolidation)

### Why

P1 shipped the foundation (shared renderer mirrored across Deno +
browser, `generate-invoice-pdf` edge fn with caching, daily orphan
sweep) but deliberately wired no consumers. P2 closes that gap on the
invoice-email path:

- Eliminate the third copy of the renderer that was still living
  inside `src/hooks/useInvoicePdf.ts:222-665` after P1 lifted the
  shared modules.
- Attach the rendered PDF to invoice + reminder emails so recipients
  no longer have to log in to the portal to download a copy.
- Pre-warm the cache from the recurring scheduler so newly-generated
  invoices send with a warm cache (and so PDF generation errors
  surface in scheduler logs, not as silent HTML-only fallback rows).

P3 (receipt attachment in `send-payment-receipt`) is **out of scope
for this patch** and remains the only remaining consumer wiring.

### Code commits (3) + docs (1)

#### C1 — refactor(pdf): useInvoicePdf consumes shared renderer (J11-P2-C1)

`src/hooks/useInvoicePdf.ts` shrinks from 666 lines to 170. The hook
now does only:

1. Fetch the invoice + relations (parallelised with
   `Promise.all` for items / payments / org).
2. Conditionally fetch installments (only when
   `payment_plan_enabled`).
3. Pre-load the org logo as a `data:` URL via `fetch` +
   `FileReader.readAsDataURL` (replaces the legacy `new Image()` +
   `crossOrigin` path — required because the shared renderer's
   contract takes a string, not an `HTMLImageElement`, since Deno
   has no `Image`).
4. Build the `InvoicePdfInput` contract.
5. Call `renderInvoicePdf` from `src/lib/invoice-pdf-renderer.ts`.
6. Wrap the `Uint8Array` in a `Blob`, download via the existing
   `<a download>` pattern.
7. Fire-and-forget audit insert.

Behaviour-preserving notes:

- Download filename remains `${invoiceNumber}.pdf` (unchanged from
  the legacy `doc.save(filename)` call). Real users have downloaded
  files matching this convention since J3.
- Audit action remains `'pdf_generated'` (the server-side path uses
  `'pdf_generated_server'` — both rows distinguishable in
  `audit_log`).
- Logo CORS fallback: legacy code silently swallowed image-load
  failure and rendered without logo; new code does the same in the
  `try/catch` around `fetchLogoAsDataUrl` plus the renderer's
  internal `if (logoDataUrl)` branch.
- All three call sites (`InvoiceDetail.tsx`, `PortalInvoices.tsx`,
  `PaymentPlanInvoiceCard.tsx`) destructure `{ downloadPdf,
  isLoading }`; this shape is unchanged so no call-site edits.
- `flat<T>()` generic with `as unknown` cast handles the
  guardian/student select shape, which Supabase returns as either
  a single object or a single-element array depending on the
  relation's cardinality. Matches the legacy `firstOrSingle`.

#### C2 — feat(email): attach PDF to invoice + reminder emails (J11-P2-C2)

`supabase/functions/_shared/send-invoice-email-core.ts`:

- `sendWithRetry`'s payload type widened to accept an optional
  `attachments?: Array<{ filename: string; content: string }>` field.
  Body is unchanged — `JSON.stringify(payload)` already serialises
  the new field, and Resend natively supports it (auto-detects the
  content-type from the `.pdf` filename extension).
- New non-exported `fetchInvoicePdfAttachment` helper invokes
  `${SUPABASE_URL}/functions/v1/generate-invoice-pdf` with
  `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` and
  `{ invoice_id, return_bytes: true }`. Returns
  `{ filename: 'Invoice-{number}.pdf', content: pdf_base64 }` on
  success or `null` on any error (HTTP non-2xx, missing
  `pdf_base64`, network throw).
- Wired between the existing `RESEND_API_KEY` guard (line ~538) and
  the `sendWithRetry` call (line ~542). On `null` return: write a
  `'invoice_email_pdf_fallback'` row to `platform_audit_log`
  (severity `warning`, with `invoice_id`, `invoice_number`,
  `org_id`, and `is_reminder` in `details`) and pass
  `attachments: undefined` (not `[]` — Resend treats those
  differently) to `sendWithRetry`.

The 5-minute idempotency debounce earlier in `sendInvoiceEmailCore`
short-circuits with 409 **before** we reach the PDF-fetch step, so
re-sends inside the debounce window don't waste cache writes.

Cache behaviour: first call for a given `(invoice_id, pdf_rev)` pair
populates `invoice-pdfs` storage; subsequent calls (manual resend,
reminder, scheduler send) hit the cache and are sub-100ms.

Verified env var names against existing edge-fn usage
(`generate-invoice-pdf/index.ts:67-68`,
`recurring-billing-scheduler/index.ts:45-46`,
`_shared/rate-limit.ts:96-97`): `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are canonical.

Verified `platform_audit_log` schema (`action`, `source`, `severity`,
`details`) against the row written by `cleanup-invoice-pdf-orphans`
(C7 of P1) — unchanged.

#### C3 — feat(scheduler): pre-warm PDF cache before recurring email send (J11-P2-C3)

`supabase/functions/recurring-billing-scheduler/index.ts` adds a
best-effort `generate-invoice-pdf` invocation immediately before each
`send-invoice-email-internal` call inside the per-draft `for` loop
(around line 115). Failure logs `console.warn` and proceeds — the
email-side fallback in C2 will still emit a `platform_audit_log`
row if the PDF gen later fails (which it shouldn't, because the warm
step would have caught it first).

Net latency analysis: the cold render still happens once per invoice
either way. Without C3, it happens inside the email-attach step (and
falls back to HTML on failure). With C3, it happens in a dedicated
step (and is logged to scheduler logs on failure). The subsequent
`send-invoice-email-internal` then hits a warm cache and the
attach step is sub-100ms. Total time-per-invoice unchanged.

Scheduler shape verified safe for serial cache-warm: the loop
iterates serially per template and per draft invoice; existing
processing already calls service-role HTTP fetches per invoice, so
adding one more (≤500ms cold per invoice) does not change the
scheduler's order-of-magnitude runtime. Edge function timeout is
150s; even at 100 invoices in one run, total added budget is
≤50s and (because the warm step replaces the cold path inside the
email send) is mostly absorbed.

`supabaseUrl` and `supabaseServiceKey` already in scope at the
insertion point (declared at lines 45-46).

#### C4 — chore(docs): J11 P2 docs close (J11-P2-C4)

- `docs/INVOICE_PDF.md` — new "Email attachment flow" section
  documents the order of operations
  (auth → status guard → debounce → render → message_log →
  Resend-key guard → PDF fetch → fallback audit → Resend send →
  log update → status transition), the fallback behaviour, the
  cache-warming strategy, and operator queries for monitoring
  fallback rates. "Caller patterns" updated: invoice + reminder
  marked wired (P2), receipt still pending (P3), parent portal
  download deferred. "Known follow-ups" trimmed.
- `LESSONLOOP_PRODUCTION_ROADMAP.md` — Journey 11 status flipped
  from "🟡 P1 closed" to "🟡 P1 + P2 closed; P3 pending". Phase 2
  expanded from one-line "(planned)" stub to a four-bullet
  closure summary.
- `POLISH_NOTES.md` — this section.

### Findings closed (patch)

None. P2 is pure consumer wiring of P1 foundations.

### Findings filed (patch)

None.

### Deviations from brief (patch)

None.

### Verification (post-deploy)

- **C1 client render:** open an invoice in the staff app, click
  Download PDF. Confirm:
  - Filename is `{invoice_number}.pdf` (unchanged from before).
  - PDF byte-content matches a P1 server-rendered PDF for the
    same invoice (open both side-by-side; the renderer is shared
    so they should be visually identical modulo the audit string
    in the row written).
  - `audit_log` row written with `action='pdf_generated'` (NOT
    `'_server'`), `actor_user_id` populated.
- **C2 cache hit on resend:** send an invoice email
  (manually-triggered via the staff Send action). Wait 6 minutes
  (past the debounce). Re-send. Confirm:
  - Email arrives with `Invoice-{number}.pdf` attached.
  - Second send is sub-second and the
    `generate-invoice-pdf` log shows `cached: true` for the
    second call.
- **C2 fallback path:** temporarily break PDF generation (e.g.
  rename `_shared/invoice-pdf.ts` then redeploy
  `generate-invoice-pdf`). Send an invoice email. Confirm:
  - Email arrives HTML-only (no attachment).
  - `platform_audit_log` has a row with
    `action='invoice_email_pdf_fallback'`, `severity='warning'`,
    and `details->>'invoice_id'` matching.
  - Restore the file.
- **C3 scheduler warm:** trigger the recurring scheduler
  manually with at least one due template that auto-sends.
  Confirm:
  - Scheduler logs show the warm fetch happening before the
    send-invoice-email-internal fetch for each draft.
  - No `'invoice_email_pdf_fallback'` rows written for that
    run (warm should have populated the cache).
  - The cached object exists at
    `{org_id}/{invoice_id}_{pdf_rev}.pdf` in the
    `invoice-pdfs` bucket.

---

## Journey 11 Phase 3 — Receipt PDF attachment

**Status:** Closed `<backfill-on-deploy>`.
**Branch:** `claude/verify-main-typecheck-QoT06`.
**Commits:** 3 (J11-P3-C1, J11-P3-C2, J11-P3-C3).
**Hashes:** see `git log --oneline` post-merge.

### Brief

P2 closed the invoice-email and reminder PDF-attachment paths but
left `send-payment-receipt` shipping HTML-only. P3 wires the same
PDF attachment into the receipt path, sharing the helper code with
P2 so there's a single canonical caller of `generate-invoice-pdf`.

Design decisions baked in from the brief:

- **Receipt = invoice PDF stamped paid**, not a separate "payment
  received" 1-pager. The renderer already paints the PAID watermark
  when `invoice.status === 'paid'`. World-class billing means one
  canonical document evolving through its lifecycle, not parallel
  artifacts.
- **One receipt PDF per payment.** Each Stripe payment fires
  `send-payment-receipt` with that payment's `paymentId`; each
  invocation attaches the **current** canonical invoice PDF (latest
  `pdf_rev`). For partial payments the PDF shows running totals; for
  the payment that cleared the balance it shows the PAID watermark.
- **Same filename as the invoice email** (`Invoice-{number}.pdf`).
  Parents file by invoice number; multiple PDFs with the same name
  is fine (their email client keeps the most recent or both).

### Commits

#### C1 — refactor(pdf): lift fetchInvoicePdfAttachment to shared module (J11-P3-C1)

- New: `supabase/functions/_shared/invoice-pdf-attachment.ts`
  exports `fetchInvoicePdfAttachment` with the same signature
  `(supabaseUrl, serviceKey, invoiceId, invoiceNumber) =>
  Promise<{ filename, content } | null>` that P2-C2 used inline.
- Modified: `supabase/functions/_shared/send-invoice-email-core.ts`
  imports the helper from the new module; the inline function body
  is gone. Call site at the (existing) `await
  fetchInvoicePdfAttachment(...)` is unchanged.
- Behaviour-preserving. Same cache semantics, same fallback logging,
  same return shape.

#### C2 — feat(receipt): attach PDF to payment receipt emails (J11-P3-C2)

- Modified: `supabase/functions/send-payment-receipt/index.ts`.
- New import: `fetchInvoicePdfAttachment` from
  `_shared/invoice-pdf-attachment.ts`.
- Insertion point: after the T05-F4 idempotency pre-check, after
  the `message_log` INSERT (and its 23505 race-loser early-return),
  after the no-`RESEND_API_KEY` early-return, and before the Resend
  POST. This means duplicate-detection paths and the dev-mode
  no-Resend path **never** trigger PDF generation, so Stripe webhook
  retry storms don't create a cache-miss thundering herd.
- Best-effort: if `generate-invoice-pdf` returns no bytes, the
  receipt email goes out HTML-only and a row is inserted into
  `platform_audit_log` with `action='payment_receipt_pdf_fallback'`,
  `severity='warning'`, `source='send-payment-receipt'`, and
  `details` containing `payment_id`, `invoice_id`, `invoice_number`,
  `org_id`. Same shape as P2's `invoice_email_pdf_fallback`; only
  the action string differs.
- Resend payload built as `Record<string, unknown>` so `attachments`
  is conditionally added (omitted on fallback) — Resend treats
  omitted-vs-`[]` differently, so this matches the P2 pattern
  exactly.

#### C3 — chore(docs): J11 P3 + Area 1 Billing closure (J11-P3-C3)

- `docs/INVOICE_PDF.md`:
  - "Caller patterns" updated: receipt path marked wired; helper
    location updated to `_shared/invoice-pdf-attachment.ts`.
  - New "Receipt attachment flow" section documents the trigger,
    receipt content (one canonical PDF stamped paid), watermark
    behaviour for full-pay vs partial-pay, cache invalidation via
    `pdf_rev` triggers on the `payments` table, T05-F4 idempotency
    semantics, best-effort fallback shape, and operator queries.
  - "Known follow-ups" trimmed: P3 entry removed; only the parent
    portal download deferred follow-up remains.
- `LESSONLOOP_PRODUCTION_ROADMAP.md`:
  - Area 1 Billing flipped from 🟡 to 🟢 CLOSED with closure block
    at top of section listing J1–J10 + Track 0.5 P1+P2 + J11
    P1+P2+P3, plus a note that T08-P1 verification and T08-P2
    watchdog do not gate Area 1 closure.
  - Overall progress table row updated: `8 of 11 → 11 of 11`,
    `51 commits → 54`, status ⚪→🟢.
  - Journey 11 status flipped from "🟡 P1 + P2 closed; P3 pending"
    to "🟢 CLOSED — P1 + P2 + P3 complete". Phase 3 expanded from
    one-line "(planned)" stub into a three-bullet closure summary.
- `POLISH_NOTES.md` — this section.

### Findings closed (patch)

None. P3 is pure consumer wiring of P1 foundations + a behaviour-
preserving refactor.

### Findings filed (patch)

None.

### Deviations from brief (patch)

- **Insertion point placement.** The brief specified "AFTER the
  message_log INSERT" and "BEFORE the Resend call" with the
  reasoning "we want the message_log row to exist regardless of
  attachment outcome". Both constraints satisfied. The fetch is
  also placed AFTER the no-`RESEND_API_KEY` early-return so dev
  invocations without Resend configured don't waste a PDF-gen
  cycle. The brief did not explicitly call this out, but it's
  consistent with the brief's general "save wasted PDF generation
  on early-exit paths" rationale.
- **Deno typecheck.** `deno` is not available in this environment.
  Per the brief's contract block ("If Deno unavailable in your
  env, hand-validate against P2-C2 patterns and note in report"),
  changes were hand-validated:
  - `invoice-pdf-attachment.ts` is a verbatim lift of the P2-C2
    body (only the log-prefix string changed
    from `[send-invoice-email-core]` to `[invoice-pdf-attachment]`).
  - `send-payment-receipt/index.ts` mirrors the P2-C2 attach +
    fallback + Resend payload shape.

### Verification (post-deploy)

- **C2 happy path:** trigger a real Stripe test payment that
  pays an invoice in full. Confirm:
  - The receipt email arrives with `Invoice-{number}.pdf`
    attached.
  - Opening the PDF shows the **PAID** watermark (renderer
    paints when `invoice.status === 'paid'`).
  - `message_log` has one `payment_receipt` row for that
    `payment_id` with `status='sent'`.
  - `platform_audit_log` has **no** `payment_receipt_pdf_fallback`
    row for the receipt.
- **C2 partial payment:** pay an installment that does not
  clear the invoice balance. Confirm:
  - Receipt arrives with PDF attached.
  - PDF shows `Paid: £X / Remaining: £Y` in the totals block,
    and **no** PAID watermark (`invoice.status` is still
    `'sent'`).
- **C2 idempotency:** replay the same Stripe webhook event
  (Stripe CLI: `stripe events resend evt_...`). Confirm:
  - No second receipt email arrives.
  - `send-payment-receipt` logs the duplicate-receipt early
    return.
  - **No** second call to `generate-invoice-pdf` is logged
    (the attachment fetch sits after the dedup pre-check).
- **C2 fallback path:** temporarily break `generate-invoice-pdf`
  (rename `_shared/invoice-pdf.ts` then redeploy
  `generate-invoice-pdf`). Trigger a Stripe payment. Confirm:
  - Receipt arrives HTML-only (no attachment).
  - `platform_audit_log` has a row with
    `action='payment_receipt_pdf_fallback'`,
    `severity='warning'`, `source='send-payment-receipt'`,
    and `details->>'payment_id'` matching.
  - Restore the file.

## Track 0.6 — Cron schedule reconciliation — 🟢 CLOSED 2026-04-26

Single-phase closure on doc-hygiene grounds. T08-P1 already fixed every
deviation Track 0.6 flagged on 24 April; T06-P0 walk verified, T06-P1
closes the roadmap.

### T06-P0 — Audit walk (2026-04-26)

- `664f28e3` chore(forensics): Track 0.6 cron audit walk (T06-P0)
- Walk doc: `docs/CRON_AUDIT_2026-04-26.md` (498 lines)
- Findings filed: T06-F1, T06-F2, T06-F3, T06-F4

### T06-P1 — Roadmap closure (2026-04-26)

- `<self>` chore(docs): Track 0.6 closure (T06-P1)
- Backfill data captured:
  - Q1 auto-pay arrears: 0 missed_charges
  - Q2 spendable-but-expired credits: 0
  - Q2b redeemed-after-expiry: 0
- Production cron state verified: 17 crons (15 documented HTTP +
  2 SQL-only), all schedules match `docs/CRON_JOBS.md`.

### Findings ledger

- T06-F1 closed (T06-P1).
- T06-F2 closed by data — no work required.
- T06-F3 no-op — T08-P1 schedules ratified; no follow-up.
- T06-F4 = T08-F5; tracked under Track 0.8 Phase 2.
