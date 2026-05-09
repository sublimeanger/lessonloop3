# bulk-process-continuation withdrawal flow — silently broken since deployment

**Date:** 2026-05-09 (during session 10 §20.7b test write)
**Severity:** P0 — launch-blocking. Term-end critical per v2 plan §3.1.
Lauren shadow-term week 4 timer has been counting down assuming
this works.
**Status:** **Fix applied + tested.** Single-fn change in `bulk-process-continuation/index.ts`
(see commit at end of session 10).

## Symptom

§20.7b test asserted `processedCount=1, withdrawnCount=1` after
calling `bulk-process-continuation` with `process_type='withdrawals'`.
Got `processedCount=0, withdrawnCount=0`. Debug surfaced:

```
[20.7b debug] seeded response: [{
  "id": "...",
  "response": "withdrawing",
  "is_processed": false,
  "run_id": "...",
  "org_id": "..."
}]
[20.7b debug] bulk-process body: {
  "success": true,
  "processedCount": 0,
  "extendedCount": 0,
  "withdrawnCount": 0,
  "lessonsCreated": 0,
  "conflictWarnings": []
}
```

## Root cause

`bulk-process-continuation/index.ts` (line ~290 + line ~327) calls
`process-term-adjustment` for each `withdrawing` response:

```ts
const previewResp = await fetch(
  `${supabaseUrl}/functions/v1/process-term-adjustment`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,  // ← BUG
      apikey: supabaseAnonKey,
    },
    ...
```

`process-term-adjustment/index.ts:113-122` does:

```ts
const userClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: userError } =
  await userClient.auth.getUser();
if (userError || !user) {
  return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
}
```

`getUser()` calls Supabase's `/auth/v1/user` endpoint with the
provided bearer. Service-role JWTs don't carry a `sub` claim
(they represent the role itself, not a user), and Supabase
auth rejects them with HTTP 403 `{"code":403,"error_code":"bad_jwt","msg":"invalid claim: missing sub claim"}`.

Verified via direct probe:
```
$ curl -s -X GET "$URL/auth/v1/user" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <anon>"
HTTP:403
{"code":403,"error_code":"bad_jwt","msg":"invalid claim: missing sub claim"}
```

So every internal call from bulk-process to process-term-adjustment
returns 401, the inner `if (!previewResp.ok) continue;` swallows
it silently, `anyWithdrawalSucceeded` stays false, and the response
is skipped without incrementing counters. processedCount stays 0.

## Why this wasn't caught

- No production user has used the withdrawal flow yet — it would
  appear to "succeed" (HTTP 200) but with 0 effect. Users would
  see "0 withdrawals processed" toast and either retry or move on.
- §20.7 confirmed flow doesn't go through process-term-adjustment;
  it does `extend recurrence + materialise lessons` directly via
  `adminClient` and `materialise_continuation_lessons` RPC.
- Sessions 7+8+9 explicitly deferred §20.7b withdrawal because
  "meaningful complexity worth dedicated pickup" — no test ever
  exercised the path.
- The fn returns success: true with all counters at 0, which looks
  identical to "no responses to process" state.

## Fix

Pass the original user's authHeader through to process-term-adjustment
instead of using serviceRoleKey:

```diff
- Authorization: `Bearer ${serviceRoleKey}`,
+ Authorization: authHeader,
```

at both call sites (preview at line ~290, confirm at line ~327).

The auth chain is correct after the fix:
1. Caller (frontend owner/admin) sends user JWT to bulk-process
2. bulk-process validates user via getUser() at line 76-83
3. bulk-process passes user JWT through to process-term-adjustment
4. process-term-adjustment validates same user via getUser() at line 117-122
5. process-term-adjustment continues with adminClient for DB writes
   (its own service-role key from env — stays internal to that fn)

User JWT might expire if a bulk operation runs for many minutes.
For now we accept that risk; if it bites, the fix is to mint a
short-lived JWT via service-role admin API per loop iteration.

## Test

§20.7b test in `tests/e2e/master/20-continuation.spec.ts` exercises
the full chain end-to-end:
- Seeds run + response with response='withdrawing', lesson_summary populated
- POSTs bulk-process-continuation with process_type='withdrawals'
  using OWNER JWT
- Asserts processedCount=1, withdrawnCount=1
- Asserts term_adjustments row created with status='confirmed'
- Asserts lessons cancelled
- Asserts recurrence end_date capped to (effective_date - 1)
- Asserts credit note invoice created
- Asserts cleanup_withdrawal_credits RPC fired (audit_log row present)
- Asserts run.status='completed'

This is the regression test that proves the chain works.

## Prevention

Add a runbook check (or post-launch monitoring): if any production
withdrawal "succeeds" with processedCount=0, page somebody. This
shape is the failure signature.
