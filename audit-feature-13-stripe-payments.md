# Audit — Feature 13: Stripe Checkout & Payments

**Date:** 2026-03-16
**Auditor:** Claude Code (Opus 4.6)
**Scope:** Every file, function, RLS policy, edge function, and database object involved in Stripe checkout, webhook processing, payment recording, Connect, refunds, and idempotency.

---

## 1. Files Audited (Full List)

### Edge Functions (14 files)
| File | Purpose |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Webhook handler — 13 event types |
| `supabase/functions/stripe-create-checkout/index.ts` | Stripe Checkout Session creation (redirect flow) |
| `supabase/functions/stripe-create-payment-intent/index.ts` | Embedded Payment Element (PaymentIntent flow) |
| `supabase/functions/stripe-verify-session/index.ts` | Post-redirect session verification |
| `supabase/functions/stripe-subscription-checkout/index.ts` | Subscription plan checkout |
| `supabase/functions/stripe-customer-portal/index.ts` | Stripe Billing Portal session |
| `supabase/functions/stripe-connect-onboard/index.ts` | Stripe Connect onboarding |
| `supabase/functions/stripe-connect-status/index.ts` | Connect account status check |
| `supabase/functions/stripe-auto-pay-installment/index.ts` | Cron: off-session auto-pay for installments |
| `supabase/functions/stripe-process-refund/index.ts` | Process full/partial refund |
| `supabase/functions/stripe-list-payment-methods/index.ts` | List saved payment methods |
| `supabase/functions/stripe-update-payment-preferences/index.ts` | Update auto-pay / default card |
| `supabase/functions/stripe-detach-payment-method/index.ts` | Remove saved payment method |
| `supabase/functions/stripe-billing-history/index.ts` | Fetch subscription billing history |
| `supabase/functions/send-payment-receipt/index.ts` | Email payment receipt via Resend |
| `supabase/functions/_shared/plan-config.ts` | Shared plan limits config |

### Database Migrations (key files)
| File | Purpose |
|------|---------|
| `20260119234233_*.sql` | Core invoices, payments, invoice_items tables |
| `20260121120401_*.sql` | `stripe_checkout_sessions` table |
| `20260222211530_*.sql` | Unique index on `payments.provider_reference` |
| `20260222220737_*.sql` | `stripe_webhook_events` deduplication table |
| `20260224110000_*.sql` | `guardian_payment_preferences`, `payment_notifications` |
| `20260224120000_*.sql` | `refunds` table, org visibility settings |
| `20260303100000_*.sql` | `payments.installment_id` column |
| `20260315200500_*.sql` | `recalculate_invoice_paid` RPC (atomic, FOR UPDATE) |
| `20260316220000_*.sql` | Auth check on `recalculate_invoice_paid`, overpayment tolerance fix |

---

## 2. Checkout Flow Diagram (Step by Step)

### Flow A: Redirect Checkout (stripe-create-checkout)
```
Parent clicks "Pay" in portal
  → Frontend calls stripe-create-checkout (authenticated)
    → Auth check (JWT via Authorization header)
    → Rate limit check
    → Fetch invoice from DB (server-side — amount from DB, NOT client)
    → Validate invoice status is "sent" or "overdue"
    → Calculate amount due = total_minor - SUM(payments.amount_minor)
    → Determine payment: full / installment / remaining balance
    → Cap payment at amount due (overpayment prevention)
    → Expire any pending checkout sessions for this invoice
    → Find/create Stripe Customer (by email via stripe.customers.list)
    → Create Stripe Checkout Session with:
      - amount from DB (not client)
      - currency from DB
      - metadata: invoice_id, org_id, installment_id, pay_remaining
      - Stripe Connect transfer_data if connected account active
      - Idempotency key: checkout_{invoiceId}_{installmentId}_{amount}
      - 30-minute expiry
    → Record session in stripe_checkout_sessions table
    → Return { sessionId, url } to frontend
  → Frontend redirects to Stripe Checkout
  → User completes payment on Stripe
  → Stripe redirects to success_url (with session_id)
  → Frontend calls stripe-verify-session to confirm
  → Stripe sends checkout.session.completed webhook
    → Webhook handler records payment, recalculates paid_minor
```

### Flow B: Embedded Payment Element (stripe-create-payment-intent)
```
Parent clicks "Pay" in portal (embedded mode)
  → Frontend calls stripe-create-payment-intent (authenticated)
    → Same validation as Flow A
    → Look up guardian_payment_preferences for saved Stripe customer
    → Create PaymentIntent (not Checkout Session)
    → Save tracking record in stripe_checkout_sessions (pi_ prefix)
    → Return { clientSecret, paymentIntentId } to frontend
  → Frontend renders Stripe Payment Element
  → User completes payment in-page
  → Stripe sends payment_intent.succeeded webhook
    → Webhook handler records payment, recalculates paid_minor
```

### Flow C: Auto-Pay (stripe-auto-pay-installment)
```
Daily cron trigger (service role auth)
  → Query due/overdue installments
  → For each: check guardian has auto_pay_enabled + saved card
  → Create off-session confirmed PaymentIntent
  → Stripe sends payment_intent.succeeded webhook
    → Webhook handler records payment, recalculates paid_minor
```

### Flow D: Subscription Checkout (stripe-subscription-checkout)
```
Owner/Admin clicks upgrade in Settings → Billing
  → Frontend calls stripe-subscription-checkout (authenticated)
    → Verify owner/admin role
    → Get/create Stripe Customer for org
    → If active subscription exists → redirect to Billing Portal
    → Create Checkout Session mode=subscription with price ID
    → Return { sessionId, url }
  → Stripe sends checkout.session.completed (mode=subscription)
    → Webhook updates org: subscription_plan, status, limits
```

---

## 3. Webhook Event Handler Matrix

| Event | Action | DB Changes |
|-------|--------|------------|
| `checkout.session.completed` (mode=subscription) | Update org subscription | `organisations.subscription_plan`, `subscription_status`, `stripe_subscription_id`, `max_students`, `max_teachers`, `trial_ends_at=null` |
| `checkout.session.completed` (mode=payment) | Record invoice payment | Guard void/cancelled, double payment guard, insert `payments`, update `stripe_checkout_sessions`, update installments, call `recalculate_invoice_paid` RPC, insert `payment_notifications`, trigger receipt email |
| `checkout.session.expired` | Mark session expired | `stripe_checkout_sessions.status = 'expired'` |
| `customer.subscription.created` | Sync org plan | `organisations.subscription_plan`, `subscription_status`, `stripe_subscription_id`, `max_students`, `max_teachers` |
| `customer.subscription.updated` | Sync org plan/status | `organisations.subscription_plan`, `subscription_status`, `past_due_since`, `cancels_at`, `max_students`, `max_teachers`. Checks teacher limit exceeded. |
| `customer.subscription.deleted` | Cancel subscription | `organisations.subscription_status = 'cancelled'`, `stripe_subscription_id = null`, apply `CANCELLED_LIMITS` |
| `invoice.payment_succeeded` | Log only | None (subscription invoice) |
| `invoice.payment_failed` | Mark past_due | `organisations.subscription_status = 'past_due'`, `past_due_since` |
| `payment_intent.succeeded` | Record invoice payment | Same as checkout.session.completed (payment mode) — full parallel handler |
| `payment_intent.payment_failed` | Log error | None (logged to console) |
| `account.updated` | Sync Connect status | `organisations.stripe_connect_status`, `stripe_connect_onboarded_at` |
| `account.application.deauthorized` | Disconnect account | `organisations.stripe_connect_status = 'disconnected'`, `stripe_connect_account_id = null` |
| `charge.refunded` | Record refund | Insert `refunds` (idempotent by `stripe_refund_id`), call `recalculate_invoice_paid` RPC. Special handling for voided invoices. |

---

## 4. Findings Table

| ID | Severity | Description | File(s) | Recommended Fix |
|----|----------|-------------|---------|-----------------|
| PAY-H1 | HIGH | **Webhook payment recording is NOT atomic with payment insert.** In `handleInvoiceCheckoutCompleted` and `handlePaymentIntentSucceeded`, the payment insert, installment updates, and `recalculate_invoice_paid` RPC are three separate operations. If the function crashes between insert and recalculate, `paid_minor` won't reflect the payment. The `recalculate_invoice_paid` RPC will fix it on retry (Stripe retries send 500), but there's a window where DB state is inconsistent. | `stripe-webhook/index.ts:284-348`, `stripe-webhook/index.ts:722-775` | Wrap payment insert + installment updates + recalc in a single DB transaction using `supabase.rpc()` that does all three atomically. Alternatively, since Stripe retries on 500 and the recalc RPC is idempotent, this is mitigated but not ideal. |
| PAY-H2 | HIGH | **Payment recording silently returns on insert failure.** In `handleInvoiceCheckoutCompleted:299-306`, if payment insert fails with a non-23505 error, the function `return`s without throwing. This means Stripe receives 200 (success), the webhook is marked as processed (dedup), and the payment is never recorded. The event won't be retried. | `stripe-webhook/index.ts:299-306` | Change `return` to `throw new Error(...)` so Stripe receives 500 and retries. Same issue at line 737-744 in `handlePaymentIntentSucceeded`. |
| PAY-H3 | HIGH | **Stripe Connect refund uses `stripeAccount` but payment was created on platform.** In `stripe-process-refund/index.ts:143-148`, refunds for Connect payments use `stripeAccount` option. However, if the original payment was created with `transfer_data.destination` (destination charge), the refund should be issued on the platform account, not the connected account. Using `stripeAccount` would create an account-level refund on the connected account which may fail or refund the wrong charge. | `stripe-process-refund/index.ts:143-148` | For destination charges (which this codebase uses), refund via the platform account (no `stripeAccount` option). Only use `stripeAccount` for direct charges. Remove the `stripeAccount` branch entirely. |
| PAY-M1 | MEDIUM | **`handlePaymentIntentSucceeded` uses `paymentIntent.amount` directly.** This is the Stripe-side amount, not verified against the invoice's expected amount. While the payment was created server-side with the correct amount, if Stripe ever has a discrepancy (e.g., currency conversion), the recorded `amount_minor` in the `payments` table would differ from what was intended. | `stripe-webhook/index.ts:727` | This is acceptable since the server created the PaymentIntent with the correct amount. The `recalculate_invoice_paid` RPC derives `paid_minor` from the `payments` table anyway, so it's self-consistent. No action required. |
| PAY-M2 | MEDIUM | **Idempotency key in checkout creation is amount-dependent.** The key is `checkout_{invoiceId}_{installmentId}_{amount}`. If between creating one session and it expiring, the invoice amount changes (e.g., item edited), a new session can be created. This is by design but worth noting. Stripe idempotency keys expire after 24h anyway. | `stripe-create-checkout/index.ts:278` | Acceptable — expired sessions are cleaned up, and amount-specific keys prevent stale-amount sessions from being reused. |
| PAY-M3 | MEDIUM | **`stripe-create-checkout` doesn't check refunds when calculating amount due.** At line 86-92, `amountDue = total_minor - SUM(payments)` but doesn't subtract refunds. If an invoice was partially paid, then refunded, the checkout would calculate a lower `amountDue` than actual. However, `recalculate_invoice_paid` RPC does account for refunds when updating `paid_minor`, so after the next recalc the invoice would be correct. The checkout amount could still be wrong. | `stripe-create-checkout/index.ts:86-92`, `stripe-create-payment-intent/index.ts:76-82` | Calculate `amountDue = total_minor - SUM(payments) + SUM(refunds WHERE status='succeeded')`. Or use the already-computed `paid_minor` from the invoice (which the recalc RPC keeps in sync). |
| PAY-M4 | MEDIUM | **`stripe_checkout_sessions` table has no INSERT policy for service role.** The table has RLS enabled, SELECT policies for finance team and payers, but no INSERT/UPDATE policy. Edge functions use service role key which bypasses RLS, so this works. But if any edge function accidentally used the anon key, inserts would fail silently. | `20260121120401_*.sql` | Add explicit comment or a service-role INSERT policy for clarity. Current behavior is correct since edge functions use `SUPABASE_SERVICE_ROLE_KEY`. |
| PAY-M5 | MEDIUM | **Auto-pay cron doesn't account for refunds in "already paid" check.** In `stripe-auto-pay-installment/index.ts:88-94`, it checks if a payment exists for the installment by `installment_id`. If the installment was paid, refunded, and re-marked as pending, it would skip it because the old payment record still exists. | `stripe-auto-pay-installment/index.ts:88-94` | Check for `installment_id` and also verify the installment status is still pending/overdue (which it already does in the outer query), but also check that no *successful unreversed* payment exists. |
| PAY-L1 | LOW | **`handlePaymentIntentSucceeded` tries to update `stripe_checkout_sessions` by payment intent ID in two different ways** (lines 693-709). The second update uses `pi_${paymentIntent.id}` which is the synthetic session ID used by the embedded payment flow. This is clever but fragile — if the PI prefix format ever changes, it breaks. | `stripe-webhook/index.ts:693-709` | Document this coupling clearly. Consider adding a comment linking to `stripe-create-payment-intent/index.ts:262` where the `pi_` prefix is set. |
| PAY-L2 | LOW | **`send-payment-receipt` message_log update uses `.order().limit(1)` instead of a specific ID.** If multiple receipt records exist for the same invoice, the wrong one could be updated. | `send-payment-receipt/index.ts:269-278` | Update by the specific `message_log.id` from the insert result instead of querying by `related_id` + `message_type`. |
| PAY-L3 | LOW | **`stripe-connect-onboard` hardcodes a fallback origin.** Line 80: `const origin = req.headers.get("origin") \|\| "https://lessonloop3.lovable.app"`. The fallback URL is a Lovable preview domain, not production. | `stripe-connect-onboard/index.ts:80` | Change fallback to `"https://app.lessonloop.net"`. |
| PAY-L4 | LOW | **No cleanup of expired `stripe_checkout_sessions` rows.** Pending sessions that expire (30 min) are marked expired by the webhook (`checkout.session.expired`) but if Stripe never sends this event (rare), stale rows accumulate. The `stripe-create-checkout` function does expire pending sessions before creating new ones, which partially mitigates. | `stripe-create-checkout/index.ts:162-174` | Add a periodic cleanup (e.g., cron) to expire sessions where `expires_at < now()` and `status = 'pending'`. Low priority — no functional impact. |
| PAY-L5 | LOW | **`stripe_webhook_events` table has RLS enabled but no policies.** This means even service role queries bypass RLS (correct behavior), but there's no explicit policy documentation. | `20260222220737_*.sql` | Add a comment: `-- No RLS policies needed: only accessed via service_role key`. Already has this comment — verified. |

---

## 5. Financial Accuracy Assessment

### Amount Integrity: STRONG

| Check | Status | Details |
|-------|--------|---------|
| Amount from DB, not client | PASS | Both `stripe-create-checkout` and `stripe-create-payment-intent` fetch `total_minor` from DB |
| Payment capped at amount due | PASS | `if (paymentAmount > amountDue) { paymentAmount = amountDue; }` |
| Currency from DB | PASS | `currencyCode` derived from `invoice.currency_code` or `org.currency_code`, never from client |
| `paid_minor` via atomic RPC | PASS | `recalculate_invoice_paid` uses `FOR UPDATE` lock, sums payments, subtracts refunds |
| Overpayment prevention | PASS | Checkout creation validates `amountDue > 0` and caps payment. `record_payment_and_update_status` RPC also prevents overpayment. |
| Partial payment tracking | PASS | Multiple payments per invoice supported. Installment-level tracking via `invoice_installments`. |
| Void/cancelled invoice guard | PASS | Both webhook handlers check invoice status before recording payment |
| Refund subtraction | PASS | `recalculate_invoice_paid` computes `net_paid = total_paid - total_refunded` |

### Minor Issue
- `stripe-create-checkout` and `stripe-create-payment-intent` calculate `amountDue` without subtracting refunds (PAY-M3). The `paid_minor` column (updated by the recalc RPC) does account for refunds, so using `invoice.total_minor - invoice.paid_minor` would be more accurate than re-summing payments.

---

## 6. Security Assessment

### Key Management: PASS
| Check | Status |
|-------|--------|
| `STRIPE_SECRET_KEY` in env vars (not hardcoded) | PASS |
| Publishable key not exposed server-side | PASS — not present in edge functions |
| `STRIPE_WEBHOOK_SECRET` in env vars | PASS |
| Service role key not exposed to client | PASS |

### Signature Verification: PASS
- Webhook uses `stripe.webhooks.constructEvent(body, signature, webhookSecret)` — official Stripe SDK verification
- Returns 400 on signature failure (before any DB operations)
- Raw body (`req.text()`) used correctly (not parsed JSON)

### Amount Integrity: PASS
- Checkout session amount comes from DB `total_minor`, not from client request
- PaymentIntent amount comes from DB, not from client request
- Client cannot tamper with amount between creation and payment
- Post-payment verification via `stripe-verify-session` prevents URL spoofing

### Authentication: PASS
| Endpoint | Auth | Role Check |
|----------|------|------------|
| `stripe-create-checkout` | JWT via `getUser()` | Any authenticated user (parent pays their own invoice) |
| `stripe-create-payment-intent` | JWT via `getUser()` | Any authenticated user |
| `stripe-verify-session` | JWT via `getUser()` | Verifies org membership or guardian relationship |
| `stripe-subscription-checkout` | JWT via `getUser()` | Owner/admin only |
| `stripe-customer-portal` | JWT via `getUser()` | Owner/admin only |
| `stripe-connect-onboard` | JWT via `getUser()` | Owner/admin only |
| `stripe-connect-status` | JWT via `getUser()` | Any org member |
| `stripe-process-refund` | JWT via `getUser()` | Owner/admin (or any role for solo_teacher) |
| `stripe-auto-pay-installment` | Service role key | Service role only |
| `stripe-webhook` | Stripe signature | No user auth (correct — Stripe calls this) |
| `send-payment-receipt` | Service role key | Service role only |

### Rate Limiting: PASS
- `stripe-create-checkout`: Rate limited via `checkRateLimit(user.id, "stripe-create-checkout")`
- `stripe-create-payment-intent`: Rate limited via same
- `stripe-webhook`: No rate limit (correct — Stripe must be able to call freely)

### Stripe Customer Search Interpolation Fix: VERIFIED
- Both `stripe-create-checkout` and `stripe-create-payment-intent` use `stripe.customers.list({ email: payerEmail })` — parameterized, not string interpolation
- No use of `stripe.customers.search()` with query string interpolation anywhere in the codebase
- Bug CAT-11 from the audit is confirmed fixed

---

## 7. Idempotency Assessment

### Webhook Deduplication: STRONG

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Event-level dedup | `stripe_webhook_events` table with `event_id` PRIMARY KEY. Insert before processing — 23505 (unique violation) = skip. | PASS |
| Payment-level dedup | Application-level check: `payments.provider_reference = paymentIntentId` before insert | PASS |
| DB-level dedup | `idx_payments_provider_reference_unique` — unique index on `provider_reference WHERE NOT NULL` | PASS |
| Refund-level dedup | Check `refunds.stripe_refund_id` before insert + unique index `idx_refunds_stripe_refund_id` | PASS |
| Checkout session dedup | Idempotency key on `stripe.checkout.sessions.create()` | PASS |

### Edge Cases

| Scenario | Handling | Status |
|----------|----------|--------|
| Same webhook delivered twice | `stripe_webhook_events` dedup catches it, returns 200 | PASS |
| Payment for already-paid invoice | `amountDue <= 0` check in checkout creation prevents new session | PASS |
| Payment for voided invoice | Webhook checks `invoice.status === 'void'` and skips | PASS |
| Payment for cancelled invoice | Webhook checks `invoice.status === 'cancelled'` and skips | PASS |
| Partial payment | Supported — multiple payments per invoice, `recalculate_invoice_paid` sums all | PASS |
| DB insert succeeds but recalc fails | `recalculate_invoice_paid` is called after insert. If it fails, Stripe has already received 200 (due to dedup passing). However, any subsequent payment or manual recalc will fix the state. | ACCEPTABLE |

---

## 8. Stripe Connect Assessment

### Architecture
- **Type:** Standard accounts (not Express or Custom)
- **Purpose:** Route invoice payment funds to the teacher/academy's own Stripe account
- **Payment flow:** Destination charges via `transfer_data.destination`
- **Platform fee:** Configurable per-org via `platform_fee_percent` column

### Connect Lifecycle
1. Owner/admin calls `stripe-connect-onboard` → creates Standard account → generates AccountLink for onboarding
2. `account.updated` webhook syncs status (pending → restricted → active)
3. Payments use `transfer_data.destination` to route funds
4. `account.application.deauthorized` handles disconnect

### Connect Issue: PAY-H3
The refund flow incorrectly passes `stripeAccount` for Connect payments. For destination charges, refunds should be issued on the platform account (the default). This is a HIGH severity issue as it could cause refund failures.

---

## 9. Error Recovery Assessment

| Scenario | Recovery Mechanism | Status |
|----------|-------------------|--------|
| Webhook fails (500) | Stripe retries up to 16 times over 3 days. Dedup prevents duplicate processing on retry. | PASS |
| DB update fails after payment | Critical handlers re-throw errors → 500 → Stripe retries | PASS (for subscription handlers). FAIL for invoice payment handlers (PAY-H2) |
| Checkout session created but never completed | 30-minute expiry. `checkout.session.expired` webhook marks as expired. Old pending sessions cleaned up on next checkout attempt. | PASS |
| Stripe API down | Checkout creation returns 400 error to frontend | PASS |
| Payment succeeds but receipt email fails | Receipt is best-effort, non-blocking (`try/catch` around the fetch) | PASS |

---

## 10. Summary Verdict

### Strengths
1. **Dual payment flow** (Checkout redirect + embedded Payment Element) with consistent validation
2. **Three-layer idempotency** (event dedup → app-level check → DB unique constraint)
3. **Atomic paid_minor recalculation** with `FOR UPDATE` row locking
4. **Void/cancelled invoice guards** in both webhook handlers
5. **Comprehensive webhook coverage** — 13 event types handled
6. **Rate limiting** on payment creation endpoints
7. **Auth checks** on all user-facing endpoints
8. **Stripe signature verification** using official SDK method
9. **Amount sourced from DB**, not client — prevents tampering
10. **Auto-pay** with off-session PaymentIntents for installments
11. **Refund flow** with idempotent recording and atomic recalculation
12. **Payment notifications** with realtime for teacher alerts
13. **Receipt emails** with opt-out support

### Issues by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 3 | PAY-H1, PAY-H2, PAY-H3 |
| MEDIUM | 5 | PAY-M1, PAY-M2, PAY-M3, PAY-M4, PAY-M5 |
| LOW | 5 | PAY-L1, PAY-L2, PAY-L3, PAY-L4, PAY-L5 |

### Critical Path Assessment
- **PAY-H2** is the most important fix: if payment insert fails (non-duplicate), the webhook returns success (200 via dedup), meaning Stripe won't retry, and the payment is lost. This is a **data loss risk**.
- **PAY-H3** could cause refund failures for Connect payments. Must be validated against actual Stripe account type.
- **PAY-H1** is mitigated by Stripe's retry mechanism but represents a consistency window.

---

## VERDICT: PRODUCTION READY WITH CAVEATS

The Stripe payments system is well-architected with strong idempotency, security, and financial accuracy. The three HIGH findings should be addressed:

1. **PAY-H2 (MUST FIX):** Change `return` to `throw` on payment insert failure so Stripe retries
2. **PAY-H3 (MUST FIX):** Remove `stripeAccount` from refund call for destination charges
3. **PAY-H1 (SHOULD FIX):** Acceptable for now due to Stripe retry mechanism, but wrap in transaction long-term

All other findings are MEDIUM/LOW and do not block production launch.
