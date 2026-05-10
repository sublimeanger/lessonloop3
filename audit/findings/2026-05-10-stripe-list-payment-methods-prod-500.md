# stripe-list-payment-methods 500 — real prod traffic (3 users, 1h)

**Severity:** P2 (real users seeing 500; not money-path but blocks payment-method management UI)
**Status:** PARTIAL FIX (s29) — response shape migrated to classifyAndRespond. **s30 hypothesis investigation: WRONG — both Stripe customers VERIFIED to exist in live mode.** Deeper root cause unknown; deferred to s31 shadow-term capture with live debugging.
**First observed:** 2026-05-10T18:45:50Z (s29 mid-session)
**Sentry issue:** [JAVASCRIPT-REACT-8](https://lessonloop.sentry.io/issues/JAVASCRIPT-REACT-8)
**Events:** 3 events / 3 distinct users in ~1h
**Surfaced by:** s27+ Sentry wrapEdgeFn instrumentation

## s30 hypothesis investigation (HALTED per HARD RULE)

Hypothesis: stale `stripe_customer_id` in `guardian_payment_preferences` for the 2 affected orgs.

Test: GET /v1/customers/{id} via Stripe live secret key for both affected customers.

Results:
- `cus_UFqLL4spcjxs3o` (New's Teaching Inst., org 34e560fe-...): 200 OK, deleted=null, email=qa.tester.005.2@gmail.com — **EXISTS**.
- `cus_UEufGdbPZx1t3F` (QA's Teaching Center, org ce918a03-...): 200 OK, deleted=null, email=getanypdf1@gmail.com — **EXISTS**.

Followup test: GET /v1/payment_methods?customer={id}&type=card for both — both return `{object: list, data: []}` (empty PM lists, no error).

So the direct Stripe API call works fine for both customers. The 500 must come from inside the edge fn but NOT from the Stripe customer lookup. Possible alternative causes (none currently testable from s30):
- Stripe Deno SDK (`https://esm.sh/stripe@14.21.0`) hitting a different code path with different error semantics than direct curl
- DB query failure in `guardian_payment_preferences` SELECT (RLS or column drift)
- Response mapping throw (e.g., unexpected `pm.card` shape)
- Edge runtime intermittent issue (rare, but possible — duration was 415ms)

## What's still actionable for s30

Nothing scope-bounded. The hypothesis was wrong; without ability to reproduce in synthetic traffic, no fix can be validated.

## Deferral to s31

s31 onwards: Lauren shadow-term traffic will (likely) re-fire this 500. With Sentry capture continuing, s31 should:
1. Wait for next event recurrence (real user traffic).
2. Pull the exact Supabase edge fn log at the event timestamp — `console.error` line will reveal the actual error.
3. With real error message in hand, file targeted fix finding.

If no event recurrence after 7d shadow-term traffic: implicitly closed (regression from s29 stripe migration may have fixed the root cause as a side-effect).

## Sentry status

JAVASCRIPT-REACT-8 stays unresolved. s31 to update.

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
