# `app.lessonloop.net` → CNAME → `lessonloop-app.netlify.app` → NXDOMAIN (PRODUCTION OUTAGE)

**Date:** 2026-05-10 (session 13 baseline)
**Severity:** **P0** — every user attempting to load the app gets
`net::ERR_NAME_NOT_RESOLVED` from Chromium / `NXDOMAIN` from any DNS
resolver. The application itself is healthy (Netlify edge IPs serve
HTTP 200 when reached by Host-header override), but the DNS chain
that gets users there is broken.
**Status:** Discovered during session 13 baseline. NOT caused by
session 13's edge-fn deploys (those landed on
`xmrhmxizpslhtkibqyfy.supabase.co`, an entirely separate domain).
Requires Jamie / DNS-owner action — not fixable from this session.

## Evidence

```bash
$ dig +noall +answer @1.1.1.1 app.lessonloop.net
app.lessonloop.net.  204 IN  CNAME  lessonloop-app.netlify.app.

$ dig +noall +answer @1.1.1.1 lessonloop-app.netlify.app A
(empty — 0 answer)

$ dig +cd @1.1.1.1 lessonloop-app.netlify.app A
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN, id: 2669

$ dig @8.8.8.8 lessonloop-app.netlify.app A
0 ANSWER

$ curl --resolve app.lessonloop.net:443:3.33.186.135 https://app.lessonloop.net/
HTTP/2 200   ← site is healthy when reached by Host-header
```

Triangulated:
- The Cloudflare DNS record for `app.lessonloop.net` still CNAMEs
  to `lessonloop-app.netlify.app`.
- That Netlify auto-subdomain returns NXDOMAIN from every public
  resolver tried.
- Netlify's MGMT API confirms the project exists, primary URL is
  configured as `https://app.lessonloop.net`, current deploy state
  is "ready", and `branchVersionOfSite` is
  `http://main--lessonloop-app.netlify.app` (note the `main--` prefix
  — different from the bare auto-subdomain in the CNAME).

## Likely cause (hypothesis)

Netlify deletes / renames the bare project auto-subdomain
(`<project>.netlify.app`) once the project has a custom domain
configured. The current branch deploy lives at
`main--<project>.netlify.app`. The Cloudflare CNAME at the customer
side still points to the old bare subdomain.

If correct, the fix is one of:

1. Update the Cloudflare CNAME for `app.lessonloop.net` to point to
   `main--lessonloop-app.netlify.app` (or whatever Netlify's current
   recommended target is).
2. Restore / re-create the bare auto-subdomain in Netlify settings.
3. Switch to Netlify DNS hosting (instead of Cloudflare CNAME) so
   Netlify manages its own DNS chain end-to-end.

## Why this isn't caused by session 13

Session 13 deployed 10 Supabase edge functions (`csv-import-execute`,
`csv-import-mapping`, `onboarding-setup`, `profile-ensure`,
`batch-invite-guardians`, `stripe-create-payment-intent`,
`stripe-process-refund`, `stripe-connect-onboard`,
`stripe-connect-status`, `send-invite-email`). All target
`xmrhmxizpslhtkibqyfy.supabase.co/functions/v1/<name>`.

The Netlify-served frontend (which this CNAME failure breaks) is
deployed independently and was last redeployed by Netlify on
deploy `69fe222805855c3e8a690724` (state: "ready" per Netlify MGMT
API readback). No frontend deploy happened in this session.

Session 12's final baseline (~30 min before session 13 started) ran
464 passed / 7 failed / 4.5m wall-clock — DNS was working then.
Something changed in the ~30-minute gap, and it wasn't in this
codebase.

## Impact on session 13

- Baseline: **343 failed / 111 passed / 132 skipped / 19 did not run**.
  All "failed" tests fail with `net::ERR_NAME_NOT_RESOLVED`.
- Cannot verify the 10 edge-fn deploys via E2E tests this session —
  every test that does `page.goto('https://app.lessonloop.net/...')`
  fails before reaching any auth / function-invocation logic.
- Edge functions themselves were verifiably deployed (Supabase MGMT
  API returns updated SHAs); the source code changes are minimal
  2-line patches matching session 12's proven pattern (commits
  `759faa3` for the s12 batch).

## Halt + surface action

Per session-13 prompt rule "If you hit a NEW production bug pattern
(not getUser-no-args): file a separate finding and HALT", session 13
halts catalog work after this finding lands. Edge-fn deploys stay in
production (no rollback warranted — patches are syntactically clean,
match a proven pattern, and the issue is upstream of any fn-invocation).
Tests will be re-runnable as soon as DNS is restored. Session 14's
prompt should start with a baseline + verify the 10 s13 deploys via
the §27 / §16 / §11 / §13 e2e specs that exercise their auth paths.

## Recommended next-step ownership

1. **Jamie**: log into Netlify dashboard → confirm whether
   `lessonloop-app.netlify.app` should resolve, or whether the CNAME
   target needs to update.
2. **Jamie**: log into Cloudflare → if Netlify auto-subdomain has
   moved, update the CNAME for `app.lessonloop.net`.
3. **Jamie**: optionally switch the apex `lessonloop.net` to Netlify
   DNS to remove this multi-provider DNS coupling (the long-running
   "Cloudflare proxy decision" item per HANDOVER's
   `audit/00-launch-readiness.md`).
4. **Session 14 agent**: re-run baseline before any other work, verify
   session 13's 10 edge-fn deploys haven't introduced regressions.
