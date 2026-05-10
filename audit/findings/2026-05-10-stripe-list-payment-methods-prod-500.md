# stripe-list-payment-methods 500 — real prod traffic (3 users, 1h)

**Severity:** P2 (real users seeing 500; not money-path but blocks payment-method management UI)
**Status:** PARTIAL FIX (s29 migrated to classifyAndRespond; root cause of underlying 500 not yet identified — likely stale Stripe customer ID)
**First observed:** 2026-05-10T18:45:50Z (s29 mid-session)
**Sentry issue:** [JAVASCRIPT-REACT-8](https://lessonloop.sentry.io/issues/JAVASCRIPT-REACT-8)
**Events:** 3 events / 3 distinct users in ~1h
**Surfaced by:** s27+ Sentry wrapEdgeFn instrumentation

## Symptom

3 real production users (Chrome 145 on Windows, UK BT mobile IPv6 range) hit `stripe-list-payment-methods` and got HTTP 500. duration_ms ~415ms — fn proceeded past auth + body parse, errored inside.

## Likely root cause (not confirmed)

The fn calls `stripe.paymentMethods.list({ customer: prefs.stripe_customer_id, type: "card" })`. If `prefs.stripe_customer_id` is stale (customer deleted in Stripe or pointing to wrong account), Stripe SDK throws and the catch falls through to the generic 500.

Other possible causes:
- Stripe API rate limit / timeout
- Stripe live ↔ test mode mismatch (J24-A introduced org-scoped Stripe key)
- DB error during `guardian_payment_preferences` SELECT

## s29 action

1. **Migrated stripe-list-payment-methods to classifyAndRespond pattern** (commit `<next>`). Adds:
   - Body-parse guard (was: `await req.json()` in outer try → 500 on malformed; now: 400 "Invalid JSON body")
   - Auth + validation → mapped 4xx via SAFE_MESSAGES
   - Unknown errors (Stripe SDK, DB) → generic 500 (response shape unchanged; was already generic)

2. **Filed this finding** with hypothesis. Did NOT modify the underlying Stripe call.

## Deferred investigation (s30)

Per the s29 prompt's HARD RULE "if a Stripe-API-level bug emerges: HALT, file finding, do NOT auto-fix" — the underlying call needs investigation in s30:
- Query Supabase `guardian_payment_preferences` for the 3 affected user IDs (extractable from Sentry user.ip — best-effort match to org_memberships)
- Verify their `stripe_customer_id` exists in Stripe (live or test mode per their org's `stripe_test_mode`)
- If stale: add cleanup migration to null-out invalid customer IDs
- If valid but Stripe call still fails: investigate Stripe API quota / connection

## Sentry status

Will leave JAVASCRIPT-REACT-8 unresolved. s30 investigation closes it (or escalates with deeper finding).
