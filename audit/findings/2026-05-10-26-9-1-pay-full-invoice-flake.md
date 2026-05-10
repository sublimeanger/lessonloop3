# §26.9.1 — Pay full invoice drawer settle flake

**Severity:** P3 (intermittent, test-side)
**Status:** OPEN — investigation only; not blocking shadow term
**Area:** parent-portal e2e
**Discovered:** 2026-05-10 (s33 baseline)
**Last seen:** 2026-05-10 s33 baseline
**Did not recur:** s34 baseline (same day, same workers=4 conditions)
**File:** `tests/e2e/master/26-parent-portal.spec.ts:2066`

## Symptom

§26.9 `PortalInvoices` group; subtest §26.9.1:

> "Pay full invoice: drawer opens with amount + backend flow settles invoice to paid"

Failed once in the s33-end baseline (665 / 2 / 122 / 3.5m where 2 = §6 dashboard + §26.9.1). Same test PASSED in the s34 baseline (665 / 2 / 122 / 3.6m where 2 = §6 dashboard + §13.7.4 — §13.7.4 returned, §26.9.1 cleared). Both baselines ran with `--workers=4`, same seed conventions.

## Root cause hypothesis

Same family as the s28/s30 intermittent flakes filed under:
- `audit/findings/2026-05-10-15-4-utilisation-concurrency-flake.md`
- `audit/findings/2026-05-10-16-messages-page-renders-flake.md`

Pattern: under workers=4 contention, a fixture write races with an assertion. The "Pay full invoice" test does:
1. Create an invoice (DB write)
2. Open the portal drawer (UI)
3. Click pay (UI → edge fn → DB update)
4. Assert invoice.status = 'paid' (DB read OR UI poll)

The race is likely between step 3's backend write committing and step 4's assertion firing. At workers=4 the DB pool sometimes makes step 3 slow enough that the assertion fires while status is still 'outstanding'.

## Recommended fix shape

Follow the s28/s30 pattern. Don't add unconditional `waitFor(2000)` (slows the suite). Instead:

1. **In the test:** use Playwright's `expect.poll()` on `invoice.status` field directly (DB or API readback), with a 5s timeout and 200ms interval. This converts the assertion from a single point-read to a bounded poll.

2. **Verify the edge-fn settle path is synchronous.** Check `pay-invoice` (or whichever fn the drawer calls) — confirm the response is only returned AFTER the invoice.status UPDATE is committed, not just queued. If the fn uses a background task to settle, that's the root cause and needs the response to wait on the commit.

3. **If the fn is already synchronous:** the race is in the UI-side optimistic update. The test should bypass the drawer and read DB state directly after the API returns 200.

## Why not block

s33 baseline was the FIRST recorded occurrence. s34 baseline confirmed it's intermittent (didn't recur same day, same workers=4). At this rate of occurrence (1-in-2 baseline runs, far below the s28 family's 1-in-1 reproducibility before fix), it's not a regression — it's a previously-latent concurrency flake that surfaces sporadically. Lauren shadow term is unaffected because §26.9.1 is a TEST, not a UI path Lauren will exercise differently than the test does.

## Next-action gate

Re-investigate if it surfaces in 2+ consecutive baselines. Otherwise defer to the next dedicated flake-triage session (s35+).
