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
