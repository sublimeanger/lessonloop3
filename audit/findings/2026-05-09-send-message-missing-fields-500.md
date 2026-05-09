# `send-message` returned 500 (not 400) on missing required fields

**Date discovered:** 2026-05-09
**Discovered by:** Claude Opus 4.7 (1M context, 6th session) while writing §16.3 catalog tests
**Severity:** P3 — DX bug, no data integrity impact
**Status:** Fixed in `supabase/functions/send-message/index.ts` (deployed v18 to dest project `xmrhmxizpslhtkibqyfy`)

## What was wrong

`send-message/index.ts` at line 79 (pre-fix) handled missing required fields by `throw new Error("Missing required fields")` inside the outer `try`. The outer `catch` at the bottom of the handler swallows everything into a generic 500 with body `{"error": "An internal error occurred. Please try again."}`.

The very next validation block (line 84-89, oversized body/subject) correctly returns a 400 with a structured error body. So the contract was inconsistent: a client that omitted `recipient_id` got the same status code as a server crash, with no actionable message.

This made client-side error handling brittle:
- The frontend (`ComposeMessageModal.tsx` calls `supabase.functions.invoke('send-message', ...)`) couldn't distinguish "you forgot a field" from "the database is down."
- Catalog test §16.3 specifies "missing fields → 400" per the convention used elsewhere in the same file.

## Fix

Replace the `throw` with the same `return new Response({...}, { status: 400 })` pattern the next validation already uses:

```ts
if (!data.org_id || !data.recipient_id || !data.recipient_type || !data.subject || !data.body) {
  return new Response(
    JSON.stringify({ error: "Missing required fields" }),
    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

3-line change. No semantic shift to the validation logic itself — only the response shape.

## Regression test

`tests/e2e/master/16-messages.spec.ts` describe "§16.3 — send-message edge fn (staff-side)" includes:

- `§16.3 validation: missing required fields → 400` — asserts both status 400 and body matches `/Missing required/`.
- `§16.3 validation: oversized subject (>500) and body (>10000) → 400` — covers the existing 400 path that was always working.

If the fix regresses (someone re-introduces the throw), the missing-fields test fails immediately.

## Related contracts the fix did NOT change

- The outer `catch` at the bottom (lines 325-334) still returns 500 for genuine internal errors (DB unreachable, message_log insert exception, etc.). That's correct.
- `send-parent-message` already returns 400 on missing fields — the inconsistency was only in `send-message`.
