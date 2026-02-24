# Stripe Connect Integration Plan — LessonLoop

## Current State Assessment

After a thorough audit of the codebase, LessonLoop already has a **substantial Stripe Connect integration** in place. Here's what exists:

### Already Built

**Backend (Supabase Edge Functions):**
- `stripe-connect-onboard` — Creates Stripe Standard accounts, generates account links
- `stripe-connect-status` — Retrieves Connect account status (active/pending/restricted)
- `stripe-create-checkout` — Creates Stripe Checkout Sessions with full/partial/installment payment support, Connect transfer routing, platform fees, customer management, session dedup
- `stripe-webhook` — Handles `checkout.session.completed`, `checkout.session.expired`, subscription lifecycle, `account.updated`, with dedup via `stripe_webhook_events`

**Frontend (React + Vite + Supabase):**
- `useStripeConnect` hook — Connect status, onboarding initiation
- `useStripePayment` hook — Payment initiation via Checkout redirect
- `useOrgPaymentPreferences` hook — Payment preferences query
- `BillingTab` — Full Stripe Connect setup UI (connected/pending/new states), payment preferences, bank details
- `PortalInvoices` — Parent portal with Pay Now, outstanding balance, bank transfer fallback, payment success/cancel URL handling
- `InvoiceDetail` — Full detail view with payment history, Pay Now for parents

**Database:**
- `invoices` table (status enum: draft/sent/paid/overdue/void, paid_minor tracking, payment plans)
- `payments` table (method enum: card/bank_transfer/cash/other, provider: stripe/manual)
- `stripe_checkout_sessions` table (full session tracking with dedup)
- `stripe_webhook_events` table (event dedup)
- `invoice_installments` table (payment plan support)
- `organisations` table with Stripe fields (connect_account_id, connect_status, platform_fee_percent, payment_methods_enabled, online_payments_enabled, bank details)

---

## Gaps Identified — What Makes It "World Class"

### 1. Idempotency Key Bug (Critical)
**File:** `supabase/functions/stripe-create-checkout/index.ts:270`
The idempotency key includes `Date.now()`, defeating its purpose entirely. Every request generates a unique key, providing zero protection against double-charges from network retries or rapid clicks.

### 2. No Payment Receipt/Confirmation Emails (High)
When a parent pays via Stripe, the webhook records the payment but never sends a confirmation email. Parents see a toast on redirect, but no persistent email receipt.

### 3. No Refund Flow (High)
No mechanism for teachers to issue refunds — neither full nor partial. No `charge.refunded` webhook handler. Teachers would need to log into Stripe Dashboard directly.

### 4. Missing Real-time Payment Updates (Medium)
After a parent pays, the PortalInvoices page refetches on redirect via query param. But if the webhook hasn't processed yet (race condition), the parent may see a stale "Awaiting Payment" status. No Supabase Realtime subscription on the payments/invoices table for the parent portal.

### 5. No Stripe Connect Disconnect/Deauthorize Handling (Medium)
If a teacher disconnects their Stripe account via Stripe Dashboard, there's no `account.application.deauthorized` webhook handler. The org would still show `stripe_connect_status: active` with a broken account.

### 6. No "Payment Received" In-App Notification for Teachers (Medium)
When a parent pays online, the teacher has no notification. They'd have to check Stripe Dashboard or manually browse the invoice.

### 7. Checkout Success URL Missing Session Verification (Medium)
The success redirect uses `?payment=success` but doesn't include `{CHECKOUT_SESSION_ID}` for server-side verification. Best practice per Stripe docs is to verify the session server-side on the success page to prevent URL spoofing.

### 8. Customer Lookup Fragility (Low)
`stripe-create-checkout` looks up customers on the **platform** account by email, not on the connected account. With Standard Connect accounts, the customer object doesn't transfer automatically. This could lead to orphaned customers or duplicates.

### 9. No Payment Analytics for Teachers (Low)
No teacher-facing view of: total collected this month, payment success rates, outstanding amounts trend, or payment method breakdown.

### 10. Stripe Connect Onboarding Resilience (Low)
If the teacher closes the Stripe onboarding tab mid-way, the "Setup Incomplete" state appears but there's no email reminder to complete it. The `stripe_connect_status: pending` state could persist indefinitely.

---

## Implementation Plan

### Phase 1: Critical Fixes (Safety & Correctness)

#### 1.1 Fix Idempotency Key
- **File:** `supabase/functions/stripe-create-checkout/index.ts`
- Change idempotency key from `checkout_${invoiceId}_${installmentId}_${paymentAmount}_${Date.now()}` to `checkout_${invoiceId}_${installmentId || "full"}_${paymentAmount}` (remove Date.now())
- This ensures duplicate requests for the same invoice/installment/amount get deduplicated by Stripe

#### 1.2 Add Checkout Session Verification on Success
- **File:** `supabase/functions/stripe-create-checkout/index.ts`
- Include `{CHECKOUT_SESSION_ID}` in the success URL template
- **New Edge Function:** `stripe-verify-session` — Takes a session_id, verifies payment_status === 'paid' server-side
- **File:** `src/hooks/useStripePayment.ts` — After redirect, call verify endpoint before showing success toast
- Prevents URL spoofing (user manually navigating to `?payment=success`)

#### 1.3 Handle Double-Payment Race Condition
- The webhook's double-payment guard using `provider_reference` unique constraint is good
- Add optimistic polling in the parent portal: after successful redirect, poll invoice status for up to 15 seconds until status changes or timeout
- **File:** `src/pages/portal/PortalInvoices.tsx` — Add polling logic in the payment success handler

### Phase 2: Payment Confirmation & Communication

#### 2.1 Payment Receipt Email
- **New Edge Function:** `send-payment-receipt`
- Triggered from the `handleInvoiceCheckoutCompleted` function in `stripe-webhook`
- Sends a branded email to the paying parent with: amount paid, invoice number, remaining balance (if installment), payment method, date
- Uses the existing email infrastructure (check `send-invoice-email` for patterns)

#### 2.2 Teacher Payment Notification
- **New Edge Function:** `notify-payment-received` (or extend existing notification system)
- Triggered from `handleInvoiceCheckoutCompleted` in `stripe-webhook`
- Sends in-app notification + optional email to the org owner/admin: "Payment of £X received for Invoice #INV-2025-00001 from [Parent Name]"
- Uses existing notification infrastructure

#### 2.3 Real-time Payment Status for Parents
- **File:** `src/pages/portal/PortalInvoices.tsx`
- Add Supabase Realtime subscription on `invoices` table (filtered by parent's invoice IDs) to catch status changes from webhook processing
- Pattern: similar to `useRealtimeInvoices` that already exists for the teacher view

### Phase 3: Refund Support

#### 3.1 Refund Edge Function
- **New Edge Function:** `stripe-create-refund`
- Accepts: `paymentId`, `amountMinor` (optional, for partial refunds), `reason`
- Looks up the payment's `provider_reference` (payment_intent_id)
- Calls `stripe.refunds.create()` via the platform account (Stripe handles Connected account routing)
- Records a negative payment or a refund record in the DB
- Updates invoice `paid_minor` and potentially reverts status from `paid` to `sent`

#### 3.2 Refund Webhook Handler
- **File:** `supabase/functions/stripe-webhook/index.ts`
- Add handler for `charge.refunded` event
- Updates the payment record, adjusts invoice `paid_minor`, sends refund confirmation email

#### 3.3 Refund UI for Teachers
- **File:** `src/pages/InvoiceDetail.tsx`
- Add "Refund" button next to each payment in the Payment History section
- Modal with amount field (pre-filled with payment amount), reason dropdown, confirmation step
- **New Component:** `src/components/invoices/RefundModal.tsx`

### Phase 4: Connect Account Lifecycle

#### 4.1 Handle Account Deauthorization
- **File:** `supabase/functions/stripe-webhook/index.ts`
- Add handler for `account.application.deauthorized` event
- Sets `stripe_connect_status: 'disconnected'`, clears `stripe_connect_account_id`
- Disables online payments for the org (`online_payments_enabled: false`)
- Sends notification to org owner

#### 4.2 Stripe Connect Completion Reminder
- **New Edge Function:** `stripe-connect-reminder` (cron-triggered)
- Checks for orgs with `stripe_connect_status: 'pending'` older than 48 hours
- Sends a reminder email to the org owner to complete Stripe setup
- Limit to 3 reminders max

### Phase 5: Payment Analytics Dashboard

#### 5.1 Payment Stats RPC
- **New Migration:** Add `get_payment_stats` RPC function
- Returns: total collected this month/quarter, payment count, average payment, outstanding balance, overdue amount, payment method breakdown
- Filtered by org_id with RLS

#### 5.2 Payment Analytics UI
- **New Component:** `src/components/invoices/PaymentAnalytics.tsx`
- Show in the Invoices page (teacher view) as a collapsible analytics section
- Charts using existing `recharts` dependency: collected over time, method breakdown pie chart
- Key metrics cards: total collected this month, outstanding, overdue

### Phase 6: Polish & UX

#### 6.1 Smarter "Pay Now" Button Visibility
- **File:** `src/pages/portal/PortalInvoices.tsx`
- When `online_payments_enabled` is true but the org has no active Connect account, hide "Pay Now" instead of showing a button that will fail
- Add a helper in `useOrgPaymentPreferences` or a new hook to check Connect readiness from the parent side

#### 6.2 Payment Confirmation Page
- **New Page:** `src/pages/portal/PortalPaymentConfirmation.tsx`
- Instead of redirecting to `/portal/invoices?payment=success`, redirect to a dedicated confirmation page
- Shows: green checkmark animation, payment amount, invoice number, "View Invoice" button, "Back to Invoices" button
- Calls `stripe-verify-session` to confirm payment server-side

#### 6.3 Customer Management Improvement
- **File:** `supabase/functions/stripe-create-checkout/index.ts`
- When creating Stripe customers, scope them to the connected account using `stripeAccountId` header for Standard accounts, or store customer IDs per-org in a `stripe_customers` junction table
- This prevents customer duplication across orgs

---

## Files Changed Summary

### Modified Files
| File | Changes |
|------|---------|
| `supabase/functions/stripe-create-checkout/index.ts` | Fix idempotency, add session_id to success URL, improve customer mgmt |
| `supabase/functions/stripe-webhook/index.ts` | Add refund handler, deauthorize handler, trigger receipt/notification emails |
| `src/pages/portal/PortalInvoices.tsx` | Add realtime subscription, polling on success, smarter Pay Now visibility |
| `src/pages/InvoiceDetail.tsx` | Add refund button for teachers |
| `src/hooks/useStripePayment.ts` | Add session verification on success redirect |

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/send-payment-receipt/index.ts` | Payment confirmation email to parent |
| `supabase/functions/notify-payment-received/index.ts` | In-app + email notification to teacher |
| `supabase/functions/stripe-create-refund/index.ts` | Refund initiation |
| `supabase/functions/stripe-verify-session/index.ts` | Server-side session verification |
| `supabase/functions/stripe-connect-reminder/index.ts` | Cron: remind incomplete Connect setup |
| `src/components/invoices/RefundModal.tsx` | Refund UI for teachers |
| `src/components/invoices/PaymentAnalytics.tsx` | Payment stats dashboard |
| `src/pages/portal/PortalPaymentConfirmation.tsx` | Dedicated payment success page |
| `src/hooks/usePaymentAnalytics.ts` | Payment analytics data hook |
| New migration SQL | `get_payment_stats` RPC, `stripe_customers` table (optional) |

### Environment Variables Required
- `STRIPE_SECRET_KEY` (already exists in Supabase secrets)
- `STRIPE_WEBHOOK_SECRET` (already exists)
- No new env vars needed

---

## Priority Order

1. **Phase 1** — Critical fixes (idempotency, session verification, race condition) — ship first
2. **Phase 2** — Payment confirmation emails + teacher notifications — high user value
3. **Phase 3** — Refund support — completes the payment lifecycle
4. **Phase 4** — Connect lifecycle resilience — prevents silent failures
5. **Phase 5** — Analytics — nice-to-have, builds on the data
6. **Phase 6** — Polish — UX improvements

## Architecture Principles
- All payment logic in Supabase Edge Functions (Deno) — never in the frontend
- All monetary amounts in **minor units** (pence/cents) as integers — no floating point
- Webhook handlers are **idempotent** with dedup guards
- RLS enforces access control — parents only see their invoices, teachers only see their org's data
- All Stripe API calls use the platform secret key with `transfer_data.destination` for Connect routing
