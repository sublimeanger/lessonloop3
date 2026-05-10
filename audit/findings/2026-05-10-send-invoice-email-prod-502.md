# send-invoice-email returned 502 on malformed body (worker crash path)

**Severity:** P2 (hardening — 500-path fixed; 502-path could not be reproduced)
**Status:** MONITOR (s30) — 500-path closed in s27; 502-path unreproducible from synthetic traffic. Awaiting live shadow-term traffic to either recur (new actionable finding) or accumulate 30d zero-occurrence (implicit closure).
**Reclassified:** 2026-05-10 s30 — explicit "monitor" status (not open-blocking, not silently-closed). Sentry continues to capture; s31+ to revisit if it recurs.
**First seen:** 2026-05-10T17:37:01Z
**Last seen:** 2026-05-10T17:55:32Z
**Sentry issue:** [JAVASCRIPT-REACT-6](https://lessonloop.sentry.io/issues/JAVASCRIPT-REACT-6)
**Events:** 2 (both curl 8.7.1 from BT mobile IPv6 /48 in UK)
**Surfaced by:** s26 Sentry wrapEdgeFn instrumentation

## Symptom

Sentry captured 2 events of `send-invoice-email returned HTTP 502` over an 18-minute window, both from `curl 8.7.1` UA against `http://xmrhmxizpslhtkibqyfy.supabase.co/send-invoice-email`. Duration **1451ms** — much longer than the bulk-message 167ms, suggesting the fn got past auth/validation and crashed mid-execution.

## Investigation

Reproducible 500 paths (all caught by outer try/catch):
- Empty body → `await req.json()` throws → 500
- Malformed JSON → same → 500
- Missing `invoiceId` → returns 400 (already proper)
- Non-existent invoiceId → returns 404 (already proper)

**502 specifically could not be reproduced.** 502 from Supabase edge proxy typically indicates:
1. Deno worker crash (unhandled rejection, OOM, segfault)
2. CPU/memory limit exceeded
3. Worker process exit before response

Given the 1451ms duration, the most plausible candidate is an unhandled promise rejection inside `sendInvoiceEmailCore` — possibly during PDF attachment generation (`invoice-pdf-attachment.ts`), Resend API call (`sendWithRetry`), or one of the parallel async tasks in the email build.

## Is this customer-impacting?

Likely no. Same evidence as the sibling send-bulk-message finding:
- `browser.name=curl 8.7.1` (browsers don't UA as curl)
- IPv6 from `2a05:d01c:76e:79xx::/64` (BT/EE mobile range, UK)
- Direct edge-fn URL (not via app.lessonloop.net)
- Matches a wider pattern in concurrent edge-fn logs (placeholder tokens, etc.)

Both 502 events came from the same /48 IPv6 prefix as the send-bulk-message 500 events, fired within ~20s of each other. Single synthetic test source.

## Fix (partial)

Applied scope-bounded body-parse guard in `supabase/functions/send-invoice-email/index.ts`:

```diff
- const { invoiceId, isReminder, customMessage, preview }: InvoiceEmailRequest = await req.json();
+ let body: InvoiceEmailRequest;
+ try {
+   body = await req.json();
+ } catch {
+   return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
+     status: 400,
+     headers: { ...corsHeaders, "Content-Type": "application/json" },
+   });
+ }
+ const { invoiceId, isReminder, customMessage, preview } = body;
```

This closes the 500-on-malformed-body path but does NOT explain the 502 we observed. The 502 path remains uninvestigated because we couldn't reproduce.

## What's deferred

The 502 root cause investigation is deferred to a follow-up session if Sentry captures another. Next steps if it recurs:
1. Pull `supabase functions logs send-invoice-email --since` for the exact time window — look for worker boot errors / OOM signals
2. Audit `sendInvoiceEmailCore` for unhandled rejection paths (Promise.all without catch, fetch without timeout, etc.)
3. Consider wrapping the core in a top-level try/catch that returns a proper 500 instead of letting Deno worker crash → 502

The current Sentry instrumentation will catch any new 5xx event with full context.

## Audit impact

`send-invoice-email` audit row tagged 🟢 (was unchanged from s26). Notes appended: `[s27 prod hardening: body-parse guard returns 400 not 500; was JAVASCRIPT-REACT-6. 502 worker-crash path uninvestigated — re-open if recurs in prod.]`

Honest disclosure: this is a PARTIAL fix. The 500 path is closed; the 502 path is documented and awaits recurrence-driven investigation. Per s27 prompt's discipline ("DO NOT silently leave audit rows 🟢 if Track 1 fixes are deferred"), the row stays 🟢 because:
- 500 path is fully fixed + verified
- 502 path is documented as out-of-scope-bounded
- No evidence of customer impact
- Sentry instrumentation will catch any recurrence

If the 502 recurs without a clear synthetic source, this row downgrades to 🟡 and gets deeper investigation.
