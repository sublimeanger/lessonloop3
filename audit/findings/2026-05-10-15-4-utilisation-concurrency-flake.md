# §15.4 Utilisation report concurrency flake

**Severity:** P3 (test-side concurrency, not production race)
**Status:** OPEN — investigation only; not blocking launch. Did not recur in s31 setup baseline (intermittent).
**First observed:** 2026-05-10 s30 final baseline
**Not observed in:** s28, s29, s31 setup baselines

## Test

`tests/e2e/master/15-reports.spec.ts` — §15.4 Utilisation: seeded room + lesson in that room last month → unique room name appears

## Failure mode

Surfaced in the s30 final baseline (662/5/122/4.8m). Same family as the s27/s30-filed §15.4 Payroll seedLesson flake (already CLOSED via per-testId offset in seedLesson). The Utilisation report variant likely has its own seeding pattern not yet covered by the s28 Track 2.4 / s30 Track 3 fixes.

## Recommended fix shape (s32 if recurs)

Apply same family of fix: testId-scoped filter on the report assertion, per-testId offset on room/lesson seeding. Should be similar to s30 Track 3's `termsBaseYear(testId)` pattern but for room+lesson tuples.

## Status

Not recur in s31 setup baseline (intermittent). s32+ to revisit if it consistently surfaces in further baselines.
