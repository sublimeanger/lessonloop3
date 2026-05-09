# §5.4 email-verification gate test — fundamentally broken design

**Date:** 2026-05-09 (during session 9 Item 5 root-cause)
**Severity:** P2 — single test file, no production impact, but
counts as a persistent baseline failure that hides real regressions.
**Status:** Open. Needs ~2-3h to redesign the test approach.

## Symptom

Per HANDOVER, this has been a "persistent flake" for several
sessions. 7th-session investigation disproved the JWT-stale theory.
8th-session left the test failing in baselines. 9th-session
confirmed it is **not a flake** — it's deterministic.

```
./node_modules/.bin/playwright test tests/e2e/master/05-rbac.spec.ts \
  -g "5.4" --workers=1 --repeat-each=5
```

Result: **5/5 fail** with the same error each run:

```
Error: signInAndWriteStorageState failed:
  {"code":400,"error_code":"email_not_confirmed","msg":"Email not confirmed"}
  at signInAndWriteStorageState (tests/e2e/supabase-admin.ts:669:13)
  at tests/e2e/master/05-rbac.spec.ts:137:21
```

## Root cause

The test attempts to test the route guard for unconfirmed-email
users by:

1. Creating a throwaway user via admin API with `email_confirm: false`
   (`createThrowawayUser({ emailConfirmed: false })`).
2. Calling `signInAndWriteStorageState(email, password)` which
   POSTs to `/auth/v1/token?grant_type=password`.
3. Loading that storage state into a Playwright browser context.
4. Navigating to `/dashboard` and asserting redirect to
   `/verify-email`.

The premise is broken at step 2. Supabase auth's
`enable_email_confirmations` is on for this project (part of the
2026-05-08 auth tightening — see `audit/findings/2026-05-08-supabase-auth-tightening-pre-launch.md`),
so password grant for an unconfirmed user is rejected with
HTTP 400 `email_not_confirmed`. There is no path through password
grant that gives an unconfirmed user a valid session token.

The route-guard logic the test wants to verify only fires for
users who have a session (`auth.users.email_confirmed_at IS NULL`
+ a valid access token). Under current Supabase config, that
combination only happens for users who go through the in-app
signup form (which produces a session via `signUp`) and then
don't click their confirm email — that is, the production happy
path is already real but **unreachable by the test's chosen
shortcut**.

## Why this didn't fail every session before

The HANDOVER ledger shows §5.4 has been failing across the last
several baselines but was always grouped with the "13 brittle
JWT-stale" cluster. 7th-session investigation disproved the JWT
theory but didn't dig into the real cause. 8th-session left the
flake in place per the session-9-deferral plan. 9th-session
confirmed it via 5x repeat.

The test almost certainly worked before the 2026-05-08 auth
tightening. The migration enabled `password_hibp_enabled` +
`security_update_password_require_reauthentication` + 6
security-event emails, but I suspect it ALSO toggled
`enable_email_confirmations` (or that was a Supabase default
change rolled into the same window). The test's `email_confirmed: false`
parameter is what the admin API stores, but the password grant
path now refuses to accept that user.

## Fix options (not implemented this session — out of ceiling)

**Option A — magic-link grant (preferred):**
Use the admin generate-link endpoint to get a session for an
unconfirmed user. The magic-link grant path DOES return a session
without requiring pre-confirmation (the link click is the
confirmation event in production).

Sketch:
```ts
// In supabase-admin.ts, alongside signInAndWriteStorageState:
function adminGenerateMagicLink(email: string): { hashed_token: string; redirect_url: string } {
  // POST /auth/v1/admin/generate_link with type=magiclink + email
  // Returns the action_link which contains the recovery token
}

// In §5.4 test:
//   const { hashed_token } = adminGenerateMagicLink(u.email);
//   // Visit /auth/v1/verify?token=<hashed>&type=magiclink in a Playwright page
//   // The redirect lands at the app with #access_token=... — this gives a session
//   // even though email_confirmed_at is still null
```

Catch: the magic-link click MAY confirm the email as a side-effect
(matching production behavior). If so, the test's premise still
fails — we'd have a session but the user is now confirmed, and
the route guard won't fire. Need to verify Supabase's behavior
on this empirically.

**Option B — bypass Supabase, forge a session:**
Use the JWT signing secret to mint a fake access token claiming
the user's id with `email_confirmed_at: null`. Write to localStorage
as a complete session blob. Brittle (any Supabase JWT format
change breaks it) and requires JWT_SECRET access (probably not
exposed to test code).

**Option C — convert to UI-driven test:**
Stop trying to forge an unconfirmed-but-signed-in state. Instead:
1. Sign up a fresh throwaway via `signUp` through the actual
   signup form (Playwright UI flow).
2. The form submits, Supabase returns a session (without email
   confirmation), the UI redirects to `/verify-email` automatically.
3. Assert URL shows `/verify-email`.

This tests the production happy path end-to-end. Brittle to
signup form UI changes but those should be rare. Probably the
most resilient long-term fix.

**Option D — skip the test:**
Document that the gate is structurally verified via code review
and deferred to manual QA. Not satisfying given §5.4 is a
genuine launch-relevant gate (unconfirmed users should not see
dashboard data).

## Recommendation

Option C — UI-driven signup → assert /verify-email redirect. Most
stable across Supabase config changes. Estimate 1-2h to write
including dealing with whatever email-validation captcha or rate
limit applies.

## What this session's pass produced

- Confirmed deterministic 5/5 fail with consistent error message.
- Identified root cause (Supabase auth-confirm gate vs password
  grant).
- Documented three fix paths.
- Left test in failing state — known-bad in baselines until next
  session redesigns it.
- HANDOVER updated to remove §5.4 from "JWT-stale" lineage and
  move to its own dedicated entry.
