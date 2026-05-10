# §15.4 Payroll seedLesson concurrency flake

**Severity:** P3 (test-side concurrency, not production race)
**Status:** OPEN — investigation only; not blocking launch
**First observed:** 2026-05-10 s27 (second baseline run)
**Not observed in:** s27 first run, s28 first run (intermittent)

## Test

```
tests/e2e/master/15-reports.spec.ts:422
§15.4 — Report data correctness — Payroll: seeded completed lesson last month → owner teacher row appears
```

## Failure mode

```
Error: seedLesson: insert failed
  at supabase-admin.ts:461
  if (!lesson?.id) throw new Error('seedLesson: insert failed');
```

The `seedLesson` factory's lessons INSERT returned no row (null id). The next line of code throws because `lesson?.id` is undefined.

## Root cause hypothesis

`seedLesson` does an INSERT into `lessons` table via service-role. The INSERT can fail silently (return null) if:
- RLS denial (unlikely with service-role)
- Constraint violation (e.g., overlapping lessons for same teacher in same slot)
- Concurrent delete of the parent student / org / location
- Race with another parallel test inserting into the same slot

Most likely: another parallel test seeded a lesson at the same `start_at` time for the same `teacher_id`. The trigger/constraint that prevents teacher double-booking fired, INSERT returned null without raising, and `lesson?.id` is undefined.

## Why this isn't production

- Real users don't have 4 parallel test suites racing on the same teacher's calendar
- The schema constraint that fires here (teacher slot uniqueness) is doing its job correctly — it's the test seeder that needs a slot-deconfliction strategy

## Recommended fix (deferred — test-side, not launch-critical)

- Add a `testId`-derived minute offset to the lesson's `start_at` so parallel tests land in different slots (same approach as §26.6.1 PortalSchedule serial deconfliction in `f7ee87d`).
- Or: make `seedLesson` retry once on null-result with a +1 min start_at bump.
- Or: gate this test as serial-only within its describe.

## Why not fix in s28

- Intermittent — failed once across 3 s27+s28 baseline runs.
- Pre-launch hardening session focus elsewhere (Tracks 1 + 3).
- Defer to s29 along with the §13:461 sibling flake.

## Reference

- s27 baseline second run: 5 fails included this test
- s28 first baseline: 3 fails, this test passed
- audit/findings/2026-05-10-13-461-draft-count-concurrency-flake.md (sibling)
