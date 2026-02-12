

# Stripe Connect Integration

## Overview
Enable each academy/teacher to connect their own Stripe account so parent payments go directly to them, with LessonLoop optionally taking a platform fee. This uses **Stripe Connect (Standard)** -- the simplest model where connected accounts manage their own Stripe dashboard.

## How It Works (User Journey)

1. **Owner/Admin** goes to Settings > Billing and sees a new "Payment Collection" section
2. They click "Connect Stripe Account" which redirects them to Stripe's hosted onboarding
3. After completing onboarding, they're redirected back and their account is linked
4. When a **parent** clicks "Pay Now" on an invoice, the checkout session is created on the connected account (or via `transfer_data`) so funds go directly to the teacher/academy
5. LessonLoop can optionally collect a platform fee (configurable, default 0%)

## Technical Changes

### 1. Database Migration

Add columns to the `organisations` table:

```text
stripe_connect_account_id  TEXT     -- Stripe connected account ID (acct_xxx)
stripe_connect_status      TEXT     -- 'pending', 'active', 'restricted', 'disabled'
stripe_connect_onboarded_at TIMESTAMPTZ
platform_fee_percent       NUMERIC  DEFAULT 0  -- optional platform fee (0-10%)
```

### 2. New Edge Function: `stripe-connect-onboard`

- Authenticated endpoint (owner/admin only)
- Creates a Stripe Connect account via `stripe.accounts.create({ type: 'standard' })`
- Generates an Account Link (`stripe.accountLinks.create`) for onboarding
- Saves the `stripe_connect_account_id` to the organisation
- Returns the onboarding URL for redirect

### 3. New Edge Function: `stripe-connect-callback`

- Handles the return redirect after Stripe onboarding
- Checks account status via `stripe.accounts.retrieve`
- Updates `stripe_connect_status` to 'active' if `charges_enabled` and `payouts_enabled`
- Redirects to Settings > Billing with a success/error parameter

### 4. New Edge Function: `stripe-connect-status`

- Lightweight endpoint to check current Connect account status
- Used by the frontend to refresh status and show dashboard link

### 5. Modify: `stripe-create-checkout` Edge Function

- Before creating a checkout session, look up the org's `stripe_connect_account_id`
- If connected: use `payment_intent_data.transfer_data` to route funds to the connected account with an optional `application_fee_amount`
- If not connected: fall back to current behaviour (platform account receives funds)

### 6. Modify: `stripe-webhook` Edge Function

- Handle `account.updated` events to keep `stripe_connect_status` in sync
- When a connected account becomes restricted or disabled, update the org accordingly

### 7. Frontend: New "Payment Collection" Card in BillingTab

Add a card in `BillingTab.tsx` below the subscription section:

- **Not connected state**: Shows explanation + "Connect Stripe Account" button
- **Pending state**: Shows "Complete Setup" button (generates new account link)
- **Connected state**: Shows green badge, "View Stripe Dashboard" link, and optional disconnect
- Only visible to owner/admin roles

### 8. Frontend: Hook `useStripeConnect`

New hook providing:
- `connectStatus` -- current connect state from the org
- `startOnboarding()` -- calls the onboard edge function and redirects
- `refreshStatus()` -- checks current status
- `dashboardUrl` -- link to Stripe Express Dashboard

### 9. Config Updates

Register new edge functions in `supabase/config.toml`:
- `stripe-connect-onboard` with `verify_jwt = false` (handles auth internally)
- `stripe-connect-callback` with `verify_jwt = false` (redirect handler)
- `stripe-connect-status` with `verify_jwt = false`

### Files Summary

| Action | File |
|--------|------|
| Create | `supabase/functions/stripe-connect-onboard/index.ts` |
| Create | `supabase/functions/stripe-connect-callback/index.ts` |
| Create | `supabase/functions/stripe-connect-status/index.ts` |
| Create | `src/hooks/useStripeConnect.ts` |
| Modify | `supabase/functions/stripe-create-checkout/index.ts` (add transfer_data) |
| Modify | `supabase/functions/stripe-webhook/index.ts` (add account.updated handler) |
| Modify | `src/components/settings/BillingTab.tsx` (add Payment Collection card) |
| Modify | `supabase/config.toml` (register new functions) |
| Migration | Add columns to `organisations` table |

### Security Considerations

- Only owner/admin can initiate Connect onboarding (verified server-side)
- The connected account ID is validated before creating checkout sessions
- Platform fee is stored server-side and cannot be manipulated by clients
- RLS on `organisations` already protects the new columns

