

# Best-in-Class UK Payment Collection

## Overview
Close the gaps identified in the competitive analysis to make LessonLoop's billing the most flexible and seamless option for UK music teachers. This plan adds Bacs Direct Debit support, manual bank transfer details on invoices, per-org payment preferences, and proper opt-out flow.

## Changes

### 1. Database Migration

Add payment preference fields to `organisations`:

```text
payment_methods_enabled   TEXT[]    DEFAULT '{card}'  
  -- Array of enabled methods: 'card', 'bacs_debit'
  -- Controls what Stripe Checkout offers parents

bank_account_name         TEXT      -- e.g. "Mrs J Smith" or "ABC Music Academy"
bank_sort_code            TEXT      -- e.g. "12-34-56"
bank_account_number       TEXT      -- e.g. "12345678"
bank_reference_prefix     TEXT      -- e.g. "LESSON" (auto-appends invoice number)

online_payments_enabled   BOOLEAN   DEFAULT true
  -- When false, hides "Pay Now" buttons entirely
  -- Invoice emails show bank details instead of payment link
```

### 2. Settings UI: Payment Preferences Card

Add a new "Payment Preferences" card in `BillingTab.tsx` (below the Stripe Connect card):

- **Online Payments toggle** -- enable/disable the "Pay Now" button across the portal
- **Accepted Methods** -- checkboxes for "Card" and "Bacs Direct Debit" (only shown when online payments are enabled and Stripe is connected)
- **Bank Transfer Details** section -- fields for account name, sort code, account number, reference prefix
- **Preview** -- shows how bank details will appear on invoices
- When Stripe Connect is not set up but bank details are entered, show an info banner: "Parents will see your bank details on invoices for manual payment"

### 3. Stripe Checkout: Add Bacs Direct Debit

Modify `stripe-create-checkout` edge function:
- Fetch `payment_methods_enabled` and `online_payments_enabled` from the org
- If `online_payments_enabled` is false, return an error (the frontend should not call this)
- Set `payment_method_types` dynamically from `payment_methods_enabled` instead of hardcoded `["card"]`
- When `bacs_debit` is included, Stripe handles the mandate collection automatically

### 4. Parent Portal: Conditional Pay Button + Bank Details

Modify `PortalInvoices.tsx` and `InvoiceDetail.tsx`:
- Fetch the org's `online_payments_enabled` flag
- If **online payments disabled**: hide "Pay Now" button, show bank transfer details card instead
- If **online payments enabled**: show "Pay Now" as today (Stripe handles method selection)
- Always show bank transfer details (if configured) as a secondary option below the Pay Now button, with text like "Or pay by bank transfer" with sort code and account number

### 5. Invoice Email: Dynamic CTA

Modify `send-invoice-email` edge function:
- Fetch org payment preferences
- If online payments enabled: show "View and Pay Invoice" CTA button (as today)
- If online payments disabled: replace CTA with bank transfer details block showing sort code, account number, and reference
- If both: show "View and Pay Invoice" button plus bank details below

### 6. PDF Invoice: Bank Details Footer

Modify `invoice-pdf` edge function:
- If bank details are configured, add a "Payment Details" section at the bottom of the PDF:
  - Account Name, Sort Code, Account Number
  - Reference: `{prefix}-{invoice_number}`
- This appears regardless of whether online payments are enabled (parents always have the option)

### 7. Platform Fee Decision

No code change needed -- the `platform_fee_percent` column already exists and defaults to 0%. The `stripe-create-checkout` function already calculates and applies `application_fee_amount` when the value is above 0. This can be set per-org via the database if needed in future. For now, **LessonLoop takes 0% of parent payments** -- revenue comes purely from subscription fees.

## Files Summary

| Action | File |
|--------|------|
| Migration | Add columns to `organisations` |
| Modify | `src/components/settings/BillingTab.tsx` (payment preferences card) |
| Modify | `supabase/functions/stripe-create-checkout/index.ts` (dynamic payment methods) |
| Modify | `src/pages/portal/PortalInvoices.tsx` (conditional pay/bank details) |
| Modify | `src/pages/InvoiceDetail.tsx` (conditional pay/bank details) |
| Modify | `supabase/functions/send-invoice-email/index.ts` (dynamic CTA) |
| Modify | `supabase/functions/invoice-pdf/index.ts` (bank details footer) |

## Competitor Advantage After Implementation

| Feature | MyMusicStaff | LessonLoop |
|---------|-------------|------------|
| Card payments | Yes (Stripe/PayPal) | Yes (Stripe) |
| Bacs Direct Debit | No | **Yes** |
| Bank details on invoices | Basic | **Rich (PDF + email + portal)** |
| Payment method preferences | No | **Yes (per-org toggle)** |
| Opt-out of online payments | Basic | **Yes (graceful fallback to bank details)** |
| Platform fee on payments | N/A | **0% (subscription model)** |
| Actionable email CTAs | No | **Yes (View and Pay)** |
| Parent self-service portal | Basic | **Full portal with history** |

This makes LessonLoop the most flexible payment collection system in the UK music teaching market -- supporting card, Bacs Direct Debit, and manual bank transfer, with per-organisation control over what's offered.
