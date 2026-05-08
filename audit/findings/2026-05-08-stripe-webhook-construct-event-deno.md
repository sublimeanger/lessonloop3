# Stripe webhook constructEvent throws on Deno

**Severity:** critical
**Status:** fixed
**Area:** webhooks
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** baa072c
**Affected components:** supabase/functions/stripe-webhook/index.ts

## Symptom

Every Stripe webhook event returned HTTP 400 at signature verification step. No events reached the database — `stripe_webhook_events` rows never written, breaking Stripe → destination DB sync (subscriptions, invoices, customers).

## Root cause

`stripe.webhooks.constructEvent(...)` is the **synchronous** verification method. It uses Node's `crypto` module under the hood, which doesn't work on Deno's WebCrypto runtime — Deno can't do synchronous HMAC. The Stripe SDK ships a Deno-compatible `constructEventAsync(...)` for exactly this case. Took 3 failed probe rounds to spot — would have been first-line if the Stripe Deno docs were consulted via Context7 from the start.

## Fix

Switched the call to `await stripe.webhooks.constructEventAsync(payload, signature, webhookSecret)`. Handler was already async so no other refactor needed.

## Verification

- Triggered `customer.created` via Stripe API; `stripe_webhook_events` row appeared with `processed_at` set
- 200 response from function; signature verification logs clean
- End-to-end Stripe sync now operational on destination

## Lessons / follow-ups

Any synchronous crypto API is a portability risk between Node and Deno. When porting Node-targeted SDKs into Supabase edge functions, default to `*Async` variants. Audit other `crypto.createHmac` / `crypto.createHash` synchronous use across edge functions. **Use Context7 to verify SDK patterns for non-Node runtimes BEFORE writing code, not after a failure.**
