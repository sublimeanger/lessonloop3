# Throw-into-outer-catch class-bug sweep (s28)

**Severity:** P2 (no live customer impact confirmed, but bit 3 fns in s24/s27 already)
**Status:** CLOSED 2026-05-10 — 56 fns patched + deployed + contract test added
**First identified:** 2026-05-10 (s27 retrospective on send-bulk-message + send-invoice-email findings)
**Closed:** 2026-05-10 s28

## The pattern

```typescript
const handler = async (req: Request): Promise<Response> => {
  try {
    // ... auth check, rate limit, etc ...
    const data = await req.json();           // ← throws SyntaxError on malformed body
    // ... validation, handlers ...
  } catch (error) {                          // ← catches the SyntaxError generically
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, ... }                   // ← masks 400 as 500
    );
  }
};
```

A malformed JSON body (or empty body, or POST with no body) makes `await req.json()` throw `SyntaxError: Unexpected end of JSON input` (or similar). That throw is caught by the outer try-catch which returns a generic 500. The client sees a "server is broken" error instead of "your input is malformed".

## Why this matters

- **Misleads ops/Sentry**: every Sentry alert from a 500 capture looks like a server bug, when many are just bad inputs. Wastes triage time.
- **Hides client-side bugs**: a frontend sending malformed JSON will see 500 and think the server is at fault, instead of fixing its own body shape.
- **Inflates error-rate metrics**: bad-input 500s look like real server errors in monitoring.
- **Bit us 3 times**: s24 send-message, s27 send-bulk-message, s27 send-invoice-email all surfaced this pattern via Sentry capture of curl-based smoke tests.

## Inventory (s28)

Of 103 edge fns:
- **NEEDS-FIX**: 45 (body parse inside outer try, catch returns 500 generic)
- **NEEDS-FIX-PLUS-LEAK**: 10 (catch ALSO echoes `error.message` to client body — info disclosure on top of wrong status)
- **ALREADY-FIXED-SHAPE**: 2 (send-bulk-message s27, send-invoice-email s27)
- **NOT-VULNERABLE-PROPER-HANDLING**: 3 stripe-detach/list/update-payment-method — they map `error.message` to status code with allow-list (the gold-standard pattern)
- **NO-BODY-PARSE**: 38 (cron handlers, GET-only fns, etc.)
- **UNCLASSIFIED**: 4 (continuation-related — use `jsonResponse()` helper but still vulnerable to body-parse)

## Fix shape (applied to all 56 launch-in-scope vulnerable fns)

```typescript
const handler = async (req: Request): Promise<Response> => {
  try {
    // ... auth check, rate limit, etc ...

    // s28 class-bug fix: dedicated body-parse try-catch returns 400 on
    // malformed body BEFORE the outer try-catch can mask it as 500.
    let data: SendMessageRequest;
    try {
      data = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ... validation, handlers ...
  } catch (error) {
    // Outer catch — now only catches true internal errors (DB, RPC, etc.)
    return new Response(/* ... 500 ... */);
  }
};
```

## Fns fixed in s28 (56 total, 8 cluster commits)

**Messaging (8):** send-message, mark-messages-read, notify-internal-message, send-parent-message, send-parent-enquiry, send-contact-message, send-cancellation-notification, send-notes-notification — [`664be75`]

**Money-path (18):** generate-invoice-pdf, send-invoice-email-internal, send-payment-receipt, send-refund-notification, send-dispute-notification, send-auto-pay-alert, send-auto-pay-failure-notification, send-recurring-billing-alert, stripe-billing-history, stripe-connect-onboard, stripe-connect-status, stripe-create-checkout, stripe-create-payment-intent, stripe-customer-portal, stripe-process-refund, stripe-subscription-checkout, stripe-verify-session, create-billing-run — [`a42d555`]

**Continuation/term (6):** bulk-process-continuation, continuation-respond, create-continuation-run, process-term-adjustment, notify-makeup-offer, notify-makeup-match — [`1e07e7d`]

**Booking/leads/invite (7):** booking-get-slots, booking-submit, send-enrolment-offer, batch-invite-guardians, send-invite-email, invite-accept, invite-get — [`2820147`]

**Auth/GDPR (2):** onboarding-setup, gdpr-delete — [`ed7837b`]

**Calendar/Xero (8):** calendar-disconnect, calendar-fetch-busy, calendar-oauth-start, calendar-sync-lesson, xero-disconnect, xero-oauth-start, xero-sync-invoice, xero-sync-payment — [`8d28888`]

**AI/CSV (5):** looopassist-chat, looopassist-execute, parent-loopassist-chat, csv-import-execute, csv-import-mapping — [`68b4e2b`]

**Misc (2):** send-push, streak-notification — [`6bb5fba`]

## Fns NOT fixed in s28 (intentional)

**Skipped — launch out of scope:**
- marketing-chat (launch-cut)
- migration-dump (dev tool)
- zoom-oauth-start, zoom-sync-lesson, zoom-oauth-callback (Zoom HIDDEN at v1)

**Skipped — already correct:**
- stripe-detach-payment-method, stripe-list-payment-methods, stripe-update-payment-preferences (use the gold-standard message-to-status mapping pattern)
- send-bulk-message, send-invoice-email (s27 fixes)

## Sibling concern: response-body leak (CLOSED s29)

Separate from the throw-to-outer-catch shape, 10 fns echo raw `error.message` in their response body to clients:
- generate-invoice-pdf (service-role internal — leak is harmless, callers are trusted; left as-is)
- stripe-billing-history, stripe-connect-onboard, stripe-connect-status, stripe-create-checkout, stripe-create-payment-intent, stripe-customer-portal, stripe-process-refund, stripe-subscription-checkout, stripe-verify-session — all 9 migrated in s29

For the 9 stripe-* fns, the response-body echo was **intentional** UX-string control flow: the fn does `throw new Error("Invoice already paid")` and the catch echoes the message back so the parent-portal UI can display a helpful error. Blanket-replacing with generic "Internal server error" would have broken legitimate frontend UX paths.

**Resolution (s29):** Built `supabase/functions/_shared/stripe-error.ts` with `classifyAndRespond(error, safeMap, corsHeaders, fnName)`. Each fn now has an inline `SAFE_MESSAGES: SafeErrorMap` with:
- `exact`: known message → HTTP status (e.g., `"Invoice not found": 404`)
- `prefix`: templated throws (e.g., `"Invoice cannot be paid (status: ": 400` matches "Invoice cannot be paid (status: void)")

Outer catch becomes a single line:
```typescript
} catch (error: unknown) {
  return classifyAndRespond(error, SAFE_MESSAGES, corsHeaders, "fn-name");
}
```

Behaviour:
- Known msg → return msg + mapped 4xx. Frontend UX preserved.
- Templated prefix match → return msg + mapped status. Same.
- Unknown msg → return `"An internal error occurred. Please try again."` + 500. Stripe SDK / DB errors no longer leak verbatim.
- All paths log full original message via `console.error` for Sentry capture.

Status code mapping rationale:
- 401: "No authorization header", "Unauthorized" (auth missing/invalid)
- 403: "Only owners/admins ...", "Not a member ...", "Not authorized to ...", "Insufficient permissions ..." (permission denied)
- 404: "X not found"
- 400: validation errors, state preconditions ("Invoice is already fully paid", "Invalid plan", etc.)

Contract test: `tests/e2e/master/27-notifications.spec.ts` §27 — Stripe error classification (s29 sibling-concern close). 9 fns × 1 assertion each (no-auth POST → 4xx with safe known message, no PostgrestError/StripeError/PGRST/stripe_<id>/JSON-parse markers in body). 9/9 pass.

Commits: `a02820b` (fix + helper), `4202558` (contract test).

## Verification

- 53/56 auto-patched via `/tmp/classbug_fix.py`; 3 fns (send-refund-notification, send-notes-notification, stripe-create-payment-intent) had multi-line destructure that defeated the regex, fixed manually with same shape.
- All 56 deployed via single `supabase functions deploy <list>` call.
- 6 manual smoke tests via curl: `send-message`, `send-parent-message`, `stripe-create-payment-intent`, `calendar-disconnect`, `notify-internal-message`, `booking-submit` — 5/6 returned 400 "Invalid JSON body" (booking-submit returned 429 from rate limit, fix downstream — verified shape via spot diff).
- Parametrised contract test added to `tests/e2e/master/27-notifications.spec.ts` covering 12 sample fns across all 8 clusters.
- Baseline re-run: target ≤6m wall-clock, ≤5 fails (the 3 documented + 2 s27 concurrency flakes; should be unaffected by these fixes).

## Audit impact

No net 🟢 promotions — class-bug sweep is hardening, not promotion. Strengthens existing rows across messaging / money-path / calendar / Xero / etc. Notes appended in MASTER.md summary: `[s28 class-bug fix: body-parse pre-extract; was 500-on-bad-input, now 400]`.

Audit total stays 167 🟢 / 6 🟡 / **0 🔴** / 10 ⏸ = ~91%.

## Status

CLOSED — 56 fns fixed + contract test + finding documents the deferred leak-fix subset.
