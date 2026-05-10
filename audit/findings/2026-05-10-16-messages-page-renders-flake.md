# §16 Messages page renders intermittent flake

**Severity:** P3 (test-side, no production impact)
**Status:** OPEN — investigation only; not blocking launch. Did not recur in s31 setup baseline (intermittent).
**First observed:** 2026-05-10 s30 final baseline
**Not observed in:** s28, s29, s31 setup baselines

## Test

`tests/e2e/master/16-messages.spec.ts:25` — Messages page › renders without error

## Failure mode

Page navigation assertion failed intermittently in the s30 final baseline. Page render flakes typically come from:
- Stale parent-portal storageState (auth refresh race)
- Storage of `current_org_id` lagging behind active membership state
- Lazy-loaded component timing

Did not recur in s31 setup baseline (665/2/122/5.1m) — same `master` project + workers=4 config. Strongly suggests genuine intermittent flake, not a regression.

## Recommended fix shape (s32 if recurs)

1. Re-run with --repeat-each=5 to confirm flake rate.
2. If consistent: add explicit wait on a known DOM element before the renders-without-error assertion.
3. If 1/5 or less: defer to v1.1+ as low-priority test brittleness.

## Status

Logged per s31 discipline (file s30-surfaced flakes even if they don't immediately recur). s32+ to revisit if it consistently surfaces.
