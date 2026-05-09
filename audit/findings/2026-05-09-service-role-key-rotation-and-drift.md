# Service-role key rotation + post-rotation drift detected

**Date:** 2026-05-09 (during session 9 Step 0 secret-persistence)
**Severity:** P1 — blocks edge-fn fn-invocation E2E coverage; blocks vault seeding for streak notifications (which itself is launch-blocking P0).
**Status:** Open. Halted Items 1 + 2 of session 9; non-blocked items (3-6) proceeded.

## What happened

Session 9's prompt opened with a "freshly-rotated service-role key"
value to bake into persistence layers (`~/.claude/settings.json` +
`/tmp/lessonloop3-deploy/.env.test`), with the rationale that the
previous key was rotated due to a chat-paste exposure incident.
Step 0 instructions explicitly required halting if the
verify-after step failed.

Per the secret-handling rules, I redacted the key from response
streams and used Edit operations only to bake the value into the
two named files. I never echoed the value back, never wrote to
unauthorised files, and never embedded it in any committed artefact.

After updating `~/.claude/settings.json` (added both
`SUPABASE_SERVICE_ROLE_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY` —
the supplied value), I noticed `.env.test` line 55 already had
the same value (so no change was needed there).

Sanity-check 1 — `tests/e2e/master/27-notifications.spec.ts` ran
green (14 passed / 1 skipped / 6.2s). This was misleading: the §27
file's tests are DB-shape (PostgREST direct), and the JWT signature
is valid, so PostgREST's RLS-bypass accepts the key. No actual
edge-fn invocation is exercised in §27 today — those tests are
TODO comments per 7th-session HANDOVER ledger.

Sanity-check 2 — direct probe of the edge fn that the §27 TODOs
would cover:

```
POST https://xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/send-payment-receipt
Authorization: Bearer <supplied key>
apikey: <supplied key>
Content-Type: application/json
{}
```

Result: HTTP 401 `{"error":"Unauthorized"}`. The fn-source check is
`authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))`,
so the deployment env value is what matters. The supplied key
clearly does NOT byte-equal the deployment env value.

Sanity-check 3 — Management API SHA-256 hash readback for the
deployment env:

- `SUPABASE_SERVICE_ROLE_KEY` deployed value SHA-256:
  `151e578fdd4f5fb8509c9127a61411ef1e0c1c4258a05a598db3c94e0ece32f0`
- Last updated: `2026-05-09T17:12:22.188Z` — i.e. today, recent
- Local key SHA-256 (no trailing newline):
  `b4f9eaa72a943eb5cfd82d104f5b64613e9459f2ad895cf7e41d3c07ffffb5ce`
- Local key SHA-256 (trailing newline variant):
  `a89db2674a1a4f517070dcdc078ba197f088195498b046f1d26e5388ff42c45b`

Neither variant matches.

## Diagnosis

The Management API readback timestamp (2026-05-09T17:12:22Z) is
well after the prompt's claim that "the value below is the new
one and is currently the authoritative service-role secret".
There are three plausible explanations:

1. **Double rotation race:** Jamie rotated once and supplied the
   value, then a second rotation happened (manual, scheduled, or
   automated) before the local environment was probed. The
   timestamp on the deployment env supports this.
2. **Stale clipboard paste:** Jamie copied a stale value from
   chat history (the previous, exposed value) rather than the
   freshly-rotated one. The fact that the "new" value was already
   present in `.env.test` (decoded JWT iat=2026-04-29) supports
   this — that's the same value the 7th-session HANDOVER flagged
   as "drifted". Jamie likely copied the existing `.env.test`
   value back into the prompt rather than reading the fresh
   dashboard value.
3. **Different paths:** the supplied value is the
   `SUPABASE_SECRET_KEYS` (newer publishable/secret format) while
   the function code reads the legacy `SUPABASE_SERVICE_ROLE_KEY`
   variable, or vice versa.

Hypothesis 2 is the most likely given the iat=2026-04-29
timestamp. The rotation almost certainly happened in the
exposure-incident response, but the value Jamie pasted to me
in the session-9 opener was a stale copy.

## What was done in session 9 anyway

- Both `SUPABASE_SERVICE_ROLE_KEY` and `E2E_SUPABASE_SERVICE_ROLE_KEY`
  added to `~/.claude/settings.json` env block. Two persistence
  layers baked correctly. Even if the value is stale, the names
  are now in place — a future fresh value just needs to replace
  the strings in those two files.
- `.env.test` already had the same value; no change required.
- Step 0 verify-after `npx playwright test 27-notifications.spec.ts`
  ran green (because §27 doesn't exercise fn-invocation).
- Direct fn-invocation probe (curl) confirmed mismatch.
- Items 1 + 2 of session 9 halted because they need a working
  service-role key to be valuable:
  - Item 1 (vault seeding) would just embed the stale value
    into vault, leaving streak triggers unable to call the
    edge fn anyway.
  - Item 2 (§27 fn-invocation) would still 401.
- Items 3-6 (sweep helper, race fixes, flake root-causes) do
  not depend on the key and proceeded as planned.

## What needs to happen next

Jamie must read the **current** deployment env value from
Supabase Dashboard → Settings → API → service_role and supply
that exact value (one paste, fresh page load, no clipboard
history). Once supplied:

1. Replace the strings in `~/.claude/settings.json` env block
   (both `SUPABASE_SERVICE_ROLE_KEY` and
   `E2E_SUPABASE_SERVICE_ROLE_KEY`).
2. Replace `E2E_SUPABASE_SERVICE_ROLE_KEY` in
   `/tmp/lessonloop3-deploy/.env.test` (line 55).
3. Re-run `curl -s -w "\\nHTTP:%{http_code}\\n" -X POST \\
   "$URL/functions/v1/send-payment-receipt" \\
   -H "Authorization: Bearer $KEY" \\
   -H "apikey: $KEY" \\
   -H "Content-Type: application/json" -d '{}'` — expect 400
   ("Missing required fields") rather than 401, which would
   confirm the key matches.
4. Compare SHA-256 against deployment readback:
   `printf '%s' "$KEY" | shasum -a 256` should match the
   Management API value field.
5. Resume Item 1 (vault seeding) and Item 2 (§27 fn-invocation
   tests) with the working key.

## Belt-and-braces: rotate again, capture at create-time

If hypothesis 2 is wrong and the deployment env genuinely was
re-rotated by something else, the safest move is one more
manual rotation captured at creation time:

1. Supabase Dashboard → Settings → API → "Generate new" on
   service_role.
2. Capture plaintext at the moment of rotation (only shown
   once at create — page navigation loses it).
3. Update `.env.test` + `~/.claude/settings.json` immediately.
4. Verify via the curl probe above.
5. Proceed with vault seeding using the verified value.

## Why the §27 deferred TODOs still aren't real tests

This finding documents the THIRD time fn-invocation tests have
been blocked by service-role drift. The tests are in commented
TODO form in `tests/e2e/master/27-notifications.spec.ts` with
all helpers already wired (`callSendPaymentReceipt`,
`upsertParentNotifPref`, etc. landed in 7th session). The 30-min
estimate to convert them to real tests assumes a working key —
once Jamie supplies one cleanly, that conversion can happen
in any future session.

## Hard rules I followed

- Did NOT echo, print, or log the supplied key value to chat
  beyond the prefix/suffix/length already shown in the prompt's
  rules.
- Did NOT write the key to any file outside the two named
  persistence layers.
- Did NOT embed the value in any commit, diff comment, or
  HANDOVER entry.
- Did NOT save backup copies anywhere.
- Did NOT include the value in this finding doc — only SHA-256
  hashes (which are one-way).
