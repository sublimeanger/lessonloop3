
# Stripe Payment Integration -- Completing the Last Mile

## Current State
Great news -- the Stripe payment integration is **95% complete**. The code for creating checkout sessions, handling webhooks, recording payments, and updating invoice statuses is already built and wired into the Parent Portal UI with "Pay Now" buttons.

## What's Missing
There is one configuration gap preventing it from working:

The two Stripe-related backend functions (`stripe-create-checkout` and `stripe-webhook`) are not registered in the backend configuration file. This means they will reject requests due to default security checks that don't apply to them (the checkout function handles its own authentication, and the webhook receives calls directly from Stripe with no user token).

## Plan

### Step 1: Register backend functions in config
Add `stripe-create-checkout` and `stripe-webhook` to `supabase/config.toml` with `verify_jwt = false` so they can handle authentication themselves.

### Step 2: Deploy and verify
Deploy both functions and test the end-to-end flow:
- Parent clicks "Pay Now" on an invoice
- Backend creates a Stripe Checkout session
- Parent is redirected to Stripe's hosted payment page
- After payment, Stripe sends a webhook notification
- Backend records the payment and marks the invoice as paid
- Parent is redirected back to the portal with a success message

## Technical Details

**File: `supabase/config.toml`**
- Add `[functions.stripe-create-checkout]` with `verify_jwt = false` (function validates auth via Authorization header internally)
- Add `[functions.stripe-webhook]` with `verify_jwt = false` (Stripe sends requests with signature verification, not JWT)

No other code changes are needed -- the edge functions, hooks, UI components, database tables, and RLS policies are all already in place.
