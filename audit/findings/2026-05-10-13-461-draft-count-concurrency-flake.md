# §13:461 Stats-reflect-DB draft count concurrency flake

**Severity:** P3 (test-side concurrency, not production race)
**Status:** OPEN — investigation only; not blocking launch
**First observed:** 2026-05-10 s27 (second baseline run)
**Not observed in:** s27 first run, s28 first run (intermittent)

## Test

```
tests/e2e/master/13-invoices.spec.ts:461
§13 — Stats reflect DB — seeded draft increments status=draft count visible to query
```

## What the test does

1. Snapshot count of draft invoices for E2E_ORG_ID
2. Seed a new draft invoice via createTestInvoice
3. Re-count drafts
4. Assert `afterCount === beforeCount + 1`
5. Delete the seeded invoice

## Failure mode

`afterCount !== beforeCount + 1` — usually by 2-3 invoices off.

## Root cause hypothesis

The test runs at workers=4 with other tests in parallel. Each parallel test that hits `createTestInvoice` or `seedInvoice` against E2E_ORG_ID creates new draft rows. Between the test's `before` snapshot and its `after` snapshot, other tests can:
- Insert N new drafts
- Delete N old drafts (their own cleanup)

The "before/after" delta is racing with the parallel test population.

## Why this isn't production

- Real users hit their own org_id, not E2E_ORG_ID
- Real users don't run 4 parallel test suites against the same org
- The schema/RLS guarantees the COUNT is correct; what's flaky is the EXPECTED VALUE in the test

## Recommended fix (deferred — test-side, not launch-critical)

Either:
1. **Isolate by test_id filter**: filter the count by `notes LIKE '${testId}_%'` so only this test's drafts are counted. Then `afterCount === 1` deterministically.
2. **Snapshot all draft IDs before, assert post-set is before + 1 new specific ID**: use a set-diff rather than a count.
3. **Move test to serial-only mode**: only this describe block runs serial. Cheapest fix.

## Why not fix in s28

- Intermittent — failed once across 3 s27+s28 baseline runs (~33% rate). Real users not impacted.
- Pre-launch hardening session focus is on the class-bug (Track 1) and Sentry coverage (Track 3); a flaky test on a count assertion is well-documented and doesn't gate launch.
- Defer to s29 along with the §15.4 Payroll seedLesson flake (sibling concurrency pattern).

## Reference

- s27 baseline output: 5 fails included this test
- s28 first baseline: 3 fails, this test passed
- audit/findings/2026-05-10-15-4-payroll-seedlesson-concurrency-flake.md (sibling)
