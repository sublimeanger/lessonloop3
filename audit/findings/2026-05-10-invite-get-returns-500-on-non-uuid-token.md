# invite-get returns 500 on non-UUID token (input-validation gap)

**Severity:** low
**Status:** fixed
**Area:** auth / invites
**Discovered:** 2026-05-10 (s24)
**Fixed:** 2026-05-10 (s26)
**Fixed in:** invite-get edge fn deploy via Supabase CLI in s26
**Affected components:** supabase/functions/invite-get/index.ts

## Symptom

POST `/functions/v1/invite-get` with `{token: "not-a-uuid"}` returns HTTP 500 + `{"error":"Failed to fetch invitation"}`. Expected: 400 (or 404) with a meaningful error.

## Root cause

`invites.token` is `uuid` type. The function does:

```ts
.from("invites").select(...).eq("token", token).maybeSingle();
```

When `token` is not a valid UUID, PostgREST returns a 22P02 invalid_text_representation error. The function catches this in `inviteError` and returns 500. Real users (clicking valid email-link tokens) never hit this; the gap shows when bots / fuzzers POST junk.

## Fix

Validate UUID format before the query:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_RE.test(token)) {
  return new Response(
    JSON.stringify({ error: "Invitation not found" }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

Single-file change, ~5 line patch. Defer to a hardening pass — not blocking launch (real flow always uses valid UUIDs).

## Verification

Once fixed: POST with junk token → 404 + {"error":"Invitation not found"}. The s24 §27 contract test `invite-get — POST non-existent token → 404` already uses a valid-UUID-but-non-existent token (`00000000-...`) and passes against the current implementation.

## Lessons / follow-ups

Audit other public token-endpoints for similar patterns (waitlist-respond uses jose JWT validation so it's fine; csv-import-execute reads JWT-auth context). Add a shared `assertUuidOr404(token, corsHeaders)` helper for the next time this pattern appears.
