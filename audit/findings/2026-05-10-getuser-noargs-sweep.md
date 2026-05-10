# `getUser()` no-args pattern sweep — recurring legacy-JWT silent-failure bug

**Date:** 2026-05-10 (session 12 + 13 sweeps)
**Severity:** **P1** — silent silently-skipped notifications for users on
legacy HS256 JWT sessions. Affects multiple user-facing flows.
**Status:** **17 of ~30 user-facing fns fixed across sessions 12 + 13 + 14.**
- s12: 3 (send-invoice-email, notify-internal-message,
  send-cancellation-notification).
- s13: 10 (csv-import-execute, csv-import-mapping, onboarding-setup,
  profile-ensure, batch-invite-guardians,
  stripe-create-payment-intent, stripe-process-refund,
  stripe-connect-onboard, stripe-connect-status, send-invite-email).
- s14: 4 (stripe-create-checkout, stripe-list-payment-methods,
  stripe-detach-payment-method, stripe-customer-portal).

Remaining ~13 user-facing fns catalogued at the bottom for a
follow-up session. S14 baseline (post-DNS-fix in s13) confirmed
no regressions across the cumulative 17 deploys.

## TL;DR

Sessions 10 and 11 each found one P0/P1 production bug of the same shape:
an edge function calling `userClient.auth.getUser()` with no arguments,
where the client was created with `Authorization: Bearer <user_jwt>`
in `global.headers`. The no-args form makes a `/auth/v1/user` request
which on this post-migration project rejects legacy HS256 JWT format,
silently returning 401 from the function — even when the JWT is
valid for PostgREST RLS purposes.

Session 12 swept all 50 hits of `getUser()` across edge fns. ~30 are the
same buggy pattern (user-facing fns with `createClient` + `Authorization`
header + `getUser()` no-args). The fix is two lines per fn:

```ts
const token = authHeader.replace("Bearer ", "");
const { data: { user } } = await supabaseAuth.auth.getUser(token);
//                                                       ^^^^^ ← passed explicitly
```

`getUser(token)` does local JWKS verification and accepts the legacy
format. This is the same fix shape as session 11's `08e66e6`
(send-bulk-message) and session 10's `bulk-process-continuation`
auth-passthrough.

## Why this keeps recurring

- The bug is invisible at code-review time — the client is correctly
  constructed with the user's auth header; calling `getUser()` *looks*
  right.
- Most users on this project have post-migration JWT sessions, which
  succeed. The bug only fires for legacy-session users.
- Tests written with the e2e auth setup (which mints fresh tokens via
  password grant) get post-migration JWTs, so the buggy fns pass tests.
- Production hits the bug only when a real user with a stale-format
  session lands on a code path that calls one of these fns, and the
  symptom is a silent 401 → email never sent.

The recurrence is structural: it's a pattern that's been propagated
across 40+ edge fns over the project's lifetime. Without a sweep, each
discovery is one-by-one as users complain.

## Fixed in session 12 (deployed)

| Function | Reason for prioritisation |
|---|---|
| `send-invoice-email` | Lauren-paramount per v2 §3.1 — sending invoices is core. Silent failure → no parent receives the bill → revenue leak. |
| `notify-internal-message` | Internal messages launch-in-scope (org-gated). Silent failure → staff don't receive notifications about new messages. |
| `send-cancellation-notification` | Parent-facing cancellation comms. Silent failure → parent doesn't know a lesson is cancelled → shows up to a missing class. |

Each: `getUser()` → `getUser(token)` per session-11 commit `08e66e6`.
Comment with finding link added inline. Deployed via
`supabase functions deploy <name>`.

## Fixed in session 14 (deployed)

| Function | Reason for prioritisation |
|---|---|
| `stripe-create-checkout` | Hosted-checkout fallback for parents whose embedded drawer fails 3DS — quietly broken for legacy-JWT sessions. |
| `stripe-list-payment-methods` | Saved-card UI in parent portal + staff invoice detail. List was returning empty for affected sessions. |
| `stripe-detach-payment-method` | Remove-saved-card button. Silently no-op'd. |
| `stripe-customer-portal` | Customer portal link from billing page. 401'd for affected sessions. |

Each: identical 2-line patch + deploy via `supabase functions deploy <name>`.

## Fixed in session 13 (deployed; baseline-verification deferred to s14 due to DNS outage)

| Function | Reason for prioritisation |
|---|---|
| `csv-import-execute` | Lauren-paramount per v2 §3.1 — bulk student onboarding (~250 students for Lauren's school). Silent failure → bulk import returns 401 → blocks shadow-term setup. |
| `csv-import-mapping` | Prerequisite for csv-import-execute (column mapping step). Same Lauren impact. |
| `onboarding-setup` | Onboarding wizard is launch-critical. Silent failure → new owner signups stuck on the "complete onboarding" step. |
| `profile-ensure` | Auth-adjacent — runs on every dashboard mount. Silent failure → broken dashboard for legacy-session users. |
| `batch-invite-guardians` | Lauren onboarding — bulk guardian invite during shadow-term setup. |
| `stripe-create-payment-intent` | Every parent payment goes through this. Silent failure → embedded drawer 401s, parent can't pay. |
| `stripe-process-refund` | Owner refund flow (from §24.7). Silent failure → refund button does nothing. |
| `stripe-connect-onboard` | **Launch-critical per v2 §3.1** — Stripe Connect is the architecture that lets studios receive payments to their own bank. |
| `stripe-connect-status` | Paired with -onboard for the post-onboarding status check. |
| `send-invite-email` | Staff invite flow. Silent failure → owner can't add teachers/admins to the org. |

Each: `getUser()` → `getUser(token)` two-line patch matching session-12's proven pattern.
Comment with finding link added inline. Deployed via `supabase functions deploy <name>`.

## Already fixed in prior sessions (do NOT touch)

| Function | Session | Commit |
|---|---|---|
| `send-message` line 57 | pre-12 | unknown — already correct |
| `mark-messages-read` line 33 | pre-12 | unknown — already correct |
| `send-bulk-message` | 11 | 08e66e6 |
| `bulk-process-continuation` (auth-passthrough variant) | 10 | (single commit, see HANDOVER) |

## Remaining candidates (after s13 — needs follow-up session)

User-facing edge fns confirmed buggy by `grep -B5 -A2 "auth.getUser()"`:

| Function | Surface | Risk |
|---|---|---|
| `send-enrolment-offer` | enrolment offer emails | hidden at v1 launch (not blocking) |
| `send-notes-notification` | lesson notes emails | live — silent skip on legacy sessions |
| `invite-accept` | invite acceptance | live — accept flow may fail mid-stream |
| `account-delete` | self-service account delete | uses different `supabase.auth.getUser()` shape — needs separate analysis |
| `stripe-billing-history` | billing history | live — list may show empty |
| `stripe-update-payment-preferences` | toggle auto-pay | live |
| `stripe-verify-session` | post-checkout return URL | live |
| `stripe-subscription-checkout` | subscription checkout | live |
| `xero-oauth-start` / `-sync-invoice` / `-sync-payment` / `-disconnect` | Xero | conditional-on-shadow per v2 §3.1 |
| `zoom-oauth-start` / `-sync-lesson` | Zoom | hidden at v1 |
| `gdpr-export` / `gdpr-delete` | GDPR | live |
| `looopassist-execute` / `-chat` | LoopAssist | scoped-launch |
| `calendar-oauth-start` / `-sync-lesson` / `-fetch-busy` / `-disconnect` | Calendar | hidden at v1 |
| `seed-demo-data` / `-solo` / `-agency` / `seed-e2e-data` | Demo seeds | dev-only |
| `notify-makeup-offer` | makeup offer email | guarded by `if (!isServiceRole)` — service-role caller bypasses; user-caller still hits the bug |
| `process-term-adjustment` | term adjustments | already partially-fixed in s10 (bulk caller path); standalone-call path still buggy |
| `continuation-respond` | parent continuation responses | unauth flow (verify_jwt=false); needs careful analysis |
| `create-billing-run` / `create-continuation-run` | run creation | live |

Total at start: **30+ user-facing edge fns**. Sessions 12 + 13 fixed
13. Remaining ~17 (counting flow-counted distinct functions including
the `xero-*` / `calendar-*` / `seed-*` clusters, lower priority each
since they're hidden / dev-only / conditional). A follow-up session
(after the s13 DNS outage is resolved + e2e suite is runnable) should
prioritise:
- live launch-in-scope: `stripe-create-checkout`,
  `stripe-list-payment-methods`, `stripe-detach-payment-method`,
  `stripe-update-payment-preferences`, `stripe-verify-session`,
  `stripe-subscription-checkout`, `stripe-billing-history`,
  `stripe-customer-portal`, `gdpr-export`, `gdpr-delete`,
  `send-notes-notification`, `notify-makeup-offer`,
  `process-term-adjustment`, `invite-accept`,
  `create-billing-run`, `create-continuation-run`.
- conditional-on-shadow: `xero-*` (4 fns).
- hidden / dev-only: skip during launch sweep.

## Recommended next-session approach

1. **Dedicated sweep session** with no other goals.
2. Apply identical 3-line patch to each fn (with a shared header comment
   pattern so future devs don't re-introduce it).
3. Run §16 / §27 / §24 / §11 e2e specs after each batch — at least one
   real test should exist that exercises each fn's auth path.
4. Consider a lint rule or `_shared/auth-helpers.ts` wrapper:
   `verifyUserOrThrow(req, supabaseUrl, anonKey)` — that pattern
   is internally `getUser(token)` and prevents future regressions.
   Single-call-site refactor; opportunistic in next sweep.

## Why not fix all 30 in this session

Per session-12 prompt's hard rule:

> Ceiling: 60 min total for the sweep + fixes. If the sweep
> surfaces more than 3 instances, treat it as worth a dedicated
> session and HALT after fixing the first 2-3 most critical
> (i.e., user-facing edge functions over background crons).

3 fixed; remaining catalogued. Each fix is mechanical but each requires
a deploy + ideally a test write to prevent regression. Bundling 30
deploys + 30 test writes into one session would make the changeset
unreviewable and the session uncloseable.
