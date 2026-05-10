# Edge function `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` returns ≠ dashboard service_role

**Date:** 2026-05-09 (session 11 three-probe diagnostic)
**Severity:** P1 originally; **DOWNGRADED to v1.1+ scope** at s29 close — production unaffected.
**Status:** DOWNGRADED 2026-05-10 s29 — re-investigation evidence below shows zero production impact across s25-s29 (4+ sessions of live Sentry monitoring). E2E-test-only impact; workarounds in place. Defer root-cause investigation to v1.1+.

## s29 re-investigation (HARD TIMEBOX hit, conclusion below)

Evidence considered (s29):
1. **Sentry monitoring history (s25-s29)**: zero 5xx events on any of the 6 service-role-gated fns flagged in this finding (send-payment-receipt, send-refund-notification, send-auto-pay-alert, send-auto-pay-failure-notification, send-dispute-notification, send-recurring-billing-alert). They've been wrapped with wrapEdgeFn since s27.
2. **Server-to-server byte-equal works in production**: when stripe-webhook calls send-payment-receipt with `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, both caller and callee read the SAME auto-injected value. Byte-equal succeeds. So the production flow is fine — only the E2E test, which uses the local .env.test JWT (the dashboard one), can't directly invoke these fns.
3. **The 1 known production-side symptom** (streak-notification trigger silently 401'ing per the original finding) was a SEPARATE bug — `x-cron-secret` header missing, NOT service-role mismatch. Fixed s12. See audit/findings/2026-05-10-streak-notification-x-cron-secret-mismatch.md (CLOSED).
4. **E2E workaround**: tests that need state-setup for these fns use the seedX factories + PostgREST RPC (where service-role write IS accepted because PostgREST verifies the JWT against the project's JWT secret directly — see Probe A in original finding). No test directly invokes a service-role-gated edge fn.

Conclusion: the mismatch is real but the production-impact framing was wrong. Server-to-server calls work fine; only the local-test → live-edge-fn path is affected, and that path is already worked around. v1.1+ should still investigate the root cause (probably the new sb_secret_* signing key system or asymmetric-key migration), but it's not a v1 launch blocker.

## Original finding below

---

## REPLACES

This finding REPLACES the earlier `2026-05-09-service-role-key-rotation-and-drift.md`
which is now Closed - phantom diagnosis. Sessions 9 and 10
inherited a "drift" framing based on hash mismatch between
`b4f9eaa72a94…` (the legacy JWT in `.env.test`) and `151e578fdd4f…`
(claimed deployment env value). The drift framing was wrong:

- The .env.test value IS the canonical legacy service_role JWT —
  Jamie verified externally via jwt.io: ref=xmrhmxizpslhtkibqyfy,
  role=service_role, iat=1777908755 (matches project creation
  second-for-second).
- Edge Function dashboard "Custom secrets" panel does NOT contain
  SUPABASE_SERVICE_ROLE_KEY (no override) per Jamie's own check.
- Session 11's three-probe diagnostic confirmed: PostgREST accepts
  the JWT with HTTP 200 (= signature is genuinely valid for the
  project's JWT secret).

So the agent's prior "drift" diagnosis across sessions 9, 9a, 10
was incorrect. The actual phenomenon is different.

## What's actually happening (session 11 evidence)

**Probe A — PostgREST direct with the legacy JWT:**
```
GET /rest/v1/audit_log?limit=1
Authorization: Bearer <legacy JWT>
apikey: <legacy JWT>
→ HTTP 200 with audit_log row body
```
Conclusion: legacy HS256 JWT **is** valid against the project's
JWT secret. PostgREST verifies it.

**Probe B — verify_jwt=true edge function (`send-payment-receipt`):**
```
POST /functions/v1/send-payment-receipt
Authorization: Bearer <legacy JWT>
{}
→ HTTP 401 {"error":"Unauthorized"}
```
The `Unauthorized` body matches the function's source (line 30):
```ts
if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, ... });
}
```
The function's gateway accepted the JWT (verify_jwt=true → if
gateway rejected, body would be `{"error":"Invalid or expired token"}`
from the platform). So the function ran — but the internal
`authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))`
byte-equal check failed.

**Probe C — verify_jwt=false edge function (`profile-ensure`):**
```
POST /functions/v1/profile-ensure
Authorization: Bearer <legacy JWT>
{}
→ HTTP 401 {"error":"Invalid or expired token"}
```
This 401 comes from the function's own `userClient.auth.getUser()`
call (line 30-36), NOT from the gateway. `getUser()` rejects
service-role JWTs because they have no `sub` claim. This is
**by design** — profile-ensure expects a USER JWT, not service-
role. Probe C is therefore not informative for this finding;
should not be in future diagnostic kits.

**Force-redeploy did NOT change behavior** — neither
`supabase functions deploy profile-ensure` nor
`supabase functions deploy send-payment-receipt` made Probe B's
`.includes()` check pass. So this isn't a stale-deployment-cache
issue.

**Management API readback** of the deployment's environment
variables:
```
SUPABASE_SERVICE_ROLE_KEY  hash=151e578fdd4f5fb8…  updated=2026-05-09T22:46:09.115Z
SUPABASE_PUBLISHABLE_KEYS  hash=efd52984f4cda7a0…
SUPABASE_SECRET_KEYS       hash=0bf578f35dd535f8…
```

My local JWT's SHA-256: `b4f9eaa72a943eb5cfd82d104f5b64613e9459f2ad895cf7e41d3c07ffffb5ce`
Deployment env hash:   `151e578fdd4f5fb8509c9127a61411ef1e0c1c4258a05a598db3c94e0ece32f0`

These are genuinely different values. Whatever Supabase auto-injects
under `SUPABASE_SERVICE_ROLE_KEY` for edge functions on this
project is NOT the same string as the dashboard's
"Project API keys" → service_role row.

Neither of those hashes match the new sb_secret_*-format keys
either (`SUPABASE_SECRET_KEYS` hash is `0bf578f3…`).

## Hypotheses (not validated — surfaced for Jamie's pick)

1. **Supabase auto-injection of edge fn env wraps the JWT in a
   different format** (e.g. JSON-serialised, prefixed with role
   metadata, or hashed for HMAC use). The dashboard value Jamie
   sees and the env value the function reads are not byte-equal
   even when no override exists.
2. **There's a project-level secret override visible only via
   Management API**, not the Edge Function "Custom secrets" UI
   panel Jamie checked. The 22:46 updated_at timestamp suggests
   an active write at some point.
3. **Platform partial migration to signing-keys**: the gateway
   verifies JWTs against the project's symmetric secret (legacy
   working) but auto-injects `SUPABASE_SERVICE_ROLE_KEY` as the
   new asymmetric private key for use within the function. Code
   that does `authHeader.includes(env)` byte-equal would then
   always fail with a legacy-format authHeader.

## What can still work + what can't

**Works** with the legacy JWT in `.env.test`:
- PostgREST direct calls (RLS bypass for tests)
- DB-side SECURITY DEFINER function calls via PostgREST RPC
- The vast majority of E2E test infrastructure

**Doesn't work** with the legacy JWT:
- Calling edge functions that do
  `authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))`
  to gate service-role access. That includes:
  - send-payment-receipt
  - send-refund-notification (likely; same pattern)
  - send-auto-pay-alert (likely; same pattern)
  - send-auto-pay-failure-notification (likely)
- Triggering streak notifications via the
  `_notify_streak_milestone` trigger after vault seeding —
  because the trigger does `net.http_post` with
  `Authorization: Bearer <vault.SUPABASE_SERVICE_ROLE_KEY>`
  to the streak-notification edge fn, which would then 401
  if its `.includes()` check is on the same env-injected value.

## Why this matters for launch

Streak milestone notifications (P0 launch-blocker per HANDOVER)
likely won't deliver in production for the same reason §27
fn-invocation tests fail in dev. The trigger fires, the audit_log
row commits as the durable record, the `net.http_post` POST
returns 401 from the edge fn — silently — and no push notification
reaches the user.

The previous 'fix' of `ec94ee3` (defensive trigger wrapping
errors instead of rolling back) made the trigger non-blocking
but did NOT fix the actual notification delivery.

## Recommended next steps (for Jamie, not the agent)

This is genuinely a Supabase platform question. Two paths:

1. **Open a Supabase support ticket** asking: "Project
   xmrhmxizpslhtkibqyfy — `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`
   in our edge functions returns a value that is NOT byte-equal to
   our dashboard 'Project API keys' → service_role row, despite
   no Custom Secrets override. What value is being auto-injected?
   How do we make code that does `authHeader.includes(env)`
   work as documented?"

2. **Migrate edge functions to use new sb_secret_* format keys**
   — but this is explicitly out of scope for v1.0 per the
   session-11 prompt's hard rules. v1.1+ work.

The agent should NOT propose JWT secret reset, NOT modify
project settings, NOT migrate to sb_secret_ system unilaterally.

## How to avoid carrying this saga forward another session

Future sessions reading HANDOVER must not inherit "drift"
framing. The phenomenon is **not drift**. The legacy JWT IS
the canonical project key. The edge fn env injection is what's
unexpected. Future drift-style probes should:

1. Run Probe A (PostgREST direct) FIRST as the definitive
   project-key validity test.
2. Compute `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` value
   ONLY via auditable means (not env-probe-temp, which has been
   discredited).
3. NOT propose JWT secret reset.
4. NOT attempt to "fix" by code changes — this is a platform-
   side question.

## Anti-pattern logged

Session 11 added to HANDOVER: "Don't inherit diagnostic
conclusions across sessions without re-running the diagnostic.
The drift saga across sessions 9 + 10 carried forward an
unreliable env-probe-temp hash as if it were established fact;
cost two infrastructure sessions of deferred work and one P0
launch-blocker (vault seeding) staying unfixed."
