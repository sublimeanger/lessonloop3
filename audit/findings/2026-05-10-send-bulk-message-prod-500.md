# send-bulk-message returned 500 on malformed/incomplete payloads

**Severity:** P2 (hardening — no customer impact confirmed)
**Status:** FIXED (s27)
**First seen:** 2026-05-10T17:37:20Z
**Last seen:** 2026-05-10T17:55:48Z
**Sentry issue:** [JAVASCRIPT-REACT-7](https://lessonloop.sentry.io/issues/JAVASCRIPT-REACT-7)
**Events:** 2 (both curl 8.7.1 from BT mobile IPv6 /48 in UK)
**Surfaced by:** s26 Sentry wrapEdgeFn instrumentation

## Symptom

Sentry captured 2 events of `send-bulk-message returned HTTP 500` over an 18-minute window, both from `curl 8.7.1` UA against `http://xmrhmxizpslhtkibqyfy.supabase.co/send-bulk-message`. Duration ~167ms — fast error path.

## Root cause

Line 162 of `supabase/functions/send-bulk-message/index.ts`:

```typescript
if (!data.org_id || !data.subject || !data.body || !data.name) {
  throw new Error("Missing required fields: org_id, name, subject, body");
}
```

A `throw` here falls into the outer try/catch which returns 500 with a generic message — masking what is actually a 400 validation error. **Same bug pattern as the s24 `send-message` missing-fields fix** (audit/findings/2026-05-09-send-message-missing-fields-500.md).

Also: `await req.json()` at line 141 will throw on empty/malformed bodies, with the same outer-catch → 500 result.

## Reproduction (confirmed in prod pre-fix)

```bash
curl -X POST https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/send-bulk-message \
  -H "Authorization: Bearer <owner-JWT>" \
  -H "Content-Type: application/json" \
  --data '{"org_id":"...","filter_criteria":{}}'
# → 500 "An internal error occurred. Please try again."
```

## Is this customer-impacting?

Likely no. Evidence the events are synthetic test traffic, not real customers:
- `browser.name=curl 8.7.1` (browsers don't UA as curl)
- IPv6 from `2a05:d01c:76e:79xx::/64` (BT/EE mobile range, UK)
- Direct edge-fn URL (not via app.lessonloop.net)
- Matches a wider pattern in concurrent edge-fn logs (placeholder tokens like `definitely-not-a-real-token`, `not-valid-base64-json`, etc.)

But the underlying bug IS real — any real client sending an incomplete bulk-message request would have hit this same 500 instead of the actionable 400.

## Fix

Two-step:
1. Wrap `await req.json()` in try/catch returning 400 on malformed JSON.
2. Move the missing-fields check above the membership check + replace the `throw` with an explicit `return new Response(..., {status: 400})`.

```diff
- const data: BulkMessageRequest = await req.json();
+ let data: BulkMessageRequest;
+ try {
+   data = await req.json();
+ } catch {
+   return new Response(
+     JSON.stringify({ error: "Invalid JSON body" }),
+     { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
+   );
+ }
+
+ if (!data.org_id || !data.subject || !data.body || !data.name) {
+   return new Response(
+     JSON.stringify({ error: "Missing required fields: org_id, name, subject, body" }),
+     { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
+   );
+ }
  ...
- if (!data.org_id || !data.subject || !data.body || !data.name) {
-   throw new Error("Missing required fields: org_id, name, subject, body");
- }
```

## Verification

Post-deploy curl reproductions all return 400:
- `{}` payload → 400 "Missing required fields: org_id, name, subject, body"
- `{"org_id":"<uuid>","filter_criteria":{}}` → 400 (same)
- empty body → 400 "Invalid JSON body"
- malformed JSON → 400 "Invalid JSON body"

## Audit impact

`send-bulk-message` audit row remains 🟢 — the fn's launch-readiness is unchanged; this fix removes a hardening gap that masked validation errors as 500. Notes updated to record `[s27 prod hardening: validation now returns 400 not 500; was JAVASCRIPT-REACT-7]`.
