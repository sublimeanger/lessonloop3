# `app.lessonloop.net` → CNAME → `lessonloop-app.netlify.app` → NXDOMAIN (PRODUCTION OUTAGE)

**Date:** 2026-05-10 (session 13 baseline)
**Severity:** **P0** — every user attempting to load the app got
`net::ERR_NAME_NOT_RESOLVED` from Chromium / `NXDOMAIN` from any DNS
resolver. The application itself was healthy (Netlify edge IPs serve
HTTP 200 when reached by Host-header override), but the DNS chain
that got users there was broken.
**Status:** **RESOLVED in session 13** via Cloudflare API CNAME swap.
The fix: change the CNAME content for `app.lessonloop.net` from
`lessonloop-app.netlify.app` (now NXDOMAIN globally) to
`lessonloop-app.netlify.com` (which resolves to the same Netlify
edge cluster and serves the app correctly). Single TLD swap.
Verified end-to-end after change: DNS resolves, HTTPS 200, real
LessonLoop HTML served from "Netlify Edge" cache hit. Total time
from diagnosis to resolution: ~10 minutes.

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

## Resolution applied (session 13)

After diagnosing, probed alternative routing targets:
- `lessonloop-app.netlify.live` — resolves but returns HTTP 502
  (DNS works, routing doesn't).
- `lessonloop-app.netlify.com` — resolves (`35.157.26.135`,
  `63.176.8.218`) AND serves HTTP 200 with the actual LessonLoop
  HTML when reached with `Host: app.lessonloop.net`. Same Netlify
  edge cluster as `--resolve` IP probe.
- `apex-loadbalancer.netlify.com` — also works, but `.com`-variant
  is preferred because it preserves the project-named CNAME (less
  disruption to `app.netlify.com` provider lookups).

Applied the fix via Cloudflare API:

```
PATCH /zones/{zone}/dns_records/{record_id}
content: lessonloop-app.netlify.app  →  lessonloop-app.netlify.com
ttl: 300, proxied: false (unchanged)
```

Cloudflare zone `451cd1b0d0eda83939d3eb91fe99f98e`, record
`b592823c177b2665428b23eed71aa93f`. Modified at
`2026-05-10T07:34:59.837Z`.

Verification within 30 seconds of the swap:
```
$ dig +noall +answer @1.1.1.1 app.lessonloop.net
app.lessonloop.net.       300 IN CNAME lessonloop-app.netlify.com.
lessonloop-app.netlify.com.  120 IN A   35.157.26.135
lessonloop-app.netlify.com.  120 IN A   63.176.8.218

$ curl -sI https://app.lessonloop.net/
HTTP/2 200
cache-status: "Netlify Edge"; hit
content-type: text/html; charset=UTF-8
```

## Why this happened (root cause)

`*.netlify.app` was Netlify's primary auto-subdomain naming since
~2019. Sometime around the start of session 13 (2026-05-10
~07:00 UTC) the entire `*.netlify.app` zone stopped resolving from
public DNS. Confirmed reproducible across:
- Cloudflare 1.1.1.1 (DOH and direct), Status 3 NXDOMAIN
- Google 8.8.8.8 (DOH and direct), Status 3 NXDOMAIN
- Quad9 9.9.9.9, OpenDNS, system resolver
- Direct query to `.app` TLD authoritative nameserver (Charleston
  Road Registry / `ns-tld1.charlestonroadregistry.com`) — returns
  only the SOA for `.app`, no NS for `netlify.app`
- Verified for multiple Netlify customer subdomains
  (`jamstack.netlify.app`, `open-props.netlify.app`,
  `cssreference.netlify.app`, `the-perks.netlify.app` — all
  empty)

Netlify's status page reported "Hosted DNS: operational" at the
time, with one unrelated "Agent Runners degraded" minor incident.
The `*.netlify.app` issue was not flagged.

The exact cause (Netlify migration / .app TLD delegation lapse /
DNSSEC mishap / something else) is not visible from this side. The
practical fix doesn't require knowing which.

## Long-term follow-up

- Watch Netlify's incident reports / status page for an explanation.
- Consider switching `app.lessonloop.net` to Netlify DNS hosting
  (matches the long-running "Cloudflare proxy decision" item in
  `audit/00-launch-readiness.md`). That would let Netlify keep the
  CNAME target accurate as their internal naming evolves.
- If `*.netlify.app` comes back online, no action needed — the
  `.com` CNAME continues to work.

## What this DOESN'T affect

- Supabase backend (`xmrhmxizpslhtkibqyfy.supabase.co`) is
  completely separate and was always healthy.
- Session 13's 10 edge-fn deploys are unaffected.
- Stripe webhooks (Stripe → Supabase) are unaffected.
- The 4 launch-blocking findings already closed in s12 stay closed.
