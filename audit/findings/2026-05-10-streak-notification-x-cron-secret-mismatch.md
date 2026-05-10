# `_notify_streak_milestone` posts wrong auth header → `streak-notification` returns 401

**Date:** 2026-05-10 (session 12 vault-seeding probe)
**Severity:** **P0** — silent revenue / engagement leak on every streak milestone
in production. Replaces the partial fix in `ec94ee3` which made the trigger
non-blocking (audit row commits) but did NOT fix delivery.
**Status:** Found + fixed in this session. Deployed via migration
`20260519100000_notify_streak_milestone_x_cron_secret.sql`.

## TL;DR

The `_notify_streak_milestone` plpgsql trigger calls `streak-notification`
with `Authorization: Bearer <vault.SUPABASE_SERVICE_ROLE_KEY>`, but the
deployed `streak-notification` edge function gates on `validateCronAuth()`,
which requires the `x-cron-secret` header (matched against env
`INTERNAL_CRON_SECRET`). The trigger never sends `x-cron-secret`, so every
milestone callout returned **401 Unauthorized** — silently — even after
session 12 finally seeded `vault.SUPABASE_URL` and
`vault.SUPABASE_SERVICE_ROLE_KEY`.

The `audit_log` row commits in either case (it is the durable record), but
no email reaches the guardian on the 3rd / 7th / 14th / 30th / 60th /
100th consecutive practice day.

## How session 12 found it

Per the session-12 prompt, vault was seeded then a 3-day streak was
fired against an active student to verify end-to-end. The diagnostic
SQL captured `net._http_response`:

```
id=714 status_code=401 created=2026-05-09 23:45:44.84+00
content={"error":"Unauthorized"}
```

That body matches `cron-auth.ts` `validateCronAuth()` exactly. The
gateway accepted the request (verify_jwt=false → no gateway auth),
the function ran, and its first internal check rejected.

Cross-checked deployed source via Management API
`get_edge_function streak-notification` (version 18); local source at
`supabase/functions/streak-notification/index.ts:90` and deployed
source are byte-equal:

```ts
const cronAuthError = validateCronAuth(req);
if (cronAuthError) return cronAuthError;
```

`_shared/cron-auth.ts` only ever checks `x-cron-secret`:

```ts
const expectedSecret = Deno.env.get("INTERNAL_CRON_SECRET");
const providedSecret = req.headers.get("x-cron-secret");
if (!expectedSecret || providedSecret !== expectedSecret) { /* 401 */ }
```

But the trigger (per `pg_get_functiondef _notify_streak_milestone` and
the `20260518110000_notify_streak_milestone_defensive.sql` migration)
sends only `Authorization: Bearer ${_service_key}`. The `x-cron-secret`
header is not in `headers := jsonb_build_object(...)`.

## Why prior sessions missed it

- `ec94ee3` fixed the *trigger blowing up* on missing vault secrets
  (NULL URL → sqlstate 23502 → AFTER INSERT rollback → user-visible
  500 on practice_logs insert). That fix wrapped pg_net in a nested
  EXCEPTION handler. It did not check whether the call, once it fires,
  actually reaches delivery.
- The §17.4 test added in `ec94ee3` asserts only the `audit_log` row.
  It does not poll `net._http_response`. A 200/400/401/500 from
  streak-notification is invisible to that assertion.
- Prior sessions reading the trigger source saw vault lookups +
  Authorization Bearer and assumed that was what the function checked.
  Nobody cross-read `streak-notification/index.ts` to verify.
- The drift saga (sessions 9-10) anchored on a different (phantom)
  blocker, deferring vault seeding 7 sessions. Once seeding finally
  ran in session 12, the second mismatch surfaced.

This is the same anti-pattern HANDOVER's session-11 entry warns
about: "Don't inherit diagnostic conclusions across sessions without
re-running the diagnostic. Trace the entire flow first."

## Fix (applied)

`supabase/migrations/20260519100000_notify_streak_milestone_x_cron_secret.sql`:

- Adds a third vault lookup for `INTERNAL_CRON_SECRET`.
- Adds `x-cron-secret: <_cron_secret>` to the headers passed to
  `net.http_post`.
- Keeps `Authorization: Bearer ...` for forward-compat (current
  edge fn ignores it, future versions might want it). Service-role
  key vault read is preserved but no longer required for the call to
  succeed (`COALESCE(_service_key, '')`).
- Fail-fast condition flips: if `INTERNAL_CRON_SECRET` is missing in
  vault, RAISE WARNING and skip. (`SUPABASE_URL` is still required.)

## Verification

After applying the migration, fired another streak (4-day milestone is
not a milestone, but a 7-day window can be set up — used the 3-day path
again on a separately-cleaned student):

```
audit_log row: action=streak_milestone, streak=3 ✓
net._http_response: status_code=200 ✓
content_type: application/json ✓
emails_sent: 0 (RESEND_API_KEY not seeded; intentional — best-effort)
```

Documented as the §17.4 e2e test in `tests/e2e/master/17-practice.spec.ts`.

## Why this isn't `edge-fn-env-injection-mismatch.md`

That P1 finding (session 11) is about
`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` returning a different
value than the dashboard service_role row, which breaks edge fns
that do `authHeader.includes(env)` byte-equal checks. This finding
is unrelated: streak-notification doesn't touch
`SUPABASE_SERVICE_ROLE_KEY` for auth at all (it uses
`INTERNAL_CRON_SECRET`). The two findings are independent.

## Related work surfaced

- Other plpgsql triggers / functions that POST to edge functions
  with `Authorization: Bearer <vault.SUPABASE_SERVICE_ROLE_KEY>`
  must be sweep-checked. If their target edge fn uses
  `validateCronAuth`, the same bug exists. Search:
  `grep -rn "vault.decrypted_secrets" supabase/migrations/`
- Session 12 follow-up Item 3 (getUser() sweep) covers a related
  pattern where edge fns call `getUser()` with no args; combined
  with this finding, the broader theme is "trigger / edge fn auth
  contracts aren't being verified at integration boundaries".
