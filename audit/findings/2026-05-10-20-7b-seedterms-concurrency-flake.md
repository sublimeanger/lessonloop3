# §20.7b seedTerms fixture concurrency flake

**Severity:** P3 (test-side fixture race, not production)
**Status:** OPEN — investigation only; not blocking launch
**First observed:** 2026-05-10 s29 final baseline (after Track 2.4 fixed 2 other concurrency flakes)
**Not observed in:** s28, s29 setup baselines

## Test

```
tests/e2e/master/20-continuation.spec.ts:1024
§20.7b — bulk-process-continuation (withdrawals flow) — process_type="withdrawals" cancels remaining lessons + creates credit note + cleanup_withdrawal_credits audit log
```

## Failure mode

```
Error: seedTerms failed: {"currentTerm":...,"nextTerm":...}
  at tests/e2e/master/20-continuation.spec.ts:1049:13
```

Fixture function `seedTerms` (probably defined inline or in supabase-admin.ts) tried to seed `currentTerm` + `nextTerm` rows; one or both came back null/missing.

## Root cause hypothesis

Same family as the 2 flakes Track 2.4 fixed: parallel workers (workers=4) race on shared E2E_ORG_ID seed state. Either:
- Both workers seed terms with overlapping date ranges → second INSERT silently fails a constraint
- A cleanup hook from a sibling test deletes terms mid-creation
- The E2E_PREFIX naming clashes when two tests run simultaneously

## Why this isn't production

Real users seed terms once at org setup. They don't have 4 parallel workers spinning up term fixtures.

## s30 fix shape (recommended)

Same family as Track 2.4 fixes:
- Add per-testId uniqueness to the term name / date_range (e.g., shift each testId's term dates by a per-testId offset of N days)
- OR retry seedTerms once on null result with a +1 month bump
- OR isolate `§20.7b` to a serial describe block (cheapest)

Estimate ~20 min in s30.

## Why filed at session close

Surfaced in the s29 final baseline run (the THIRD baseline of s29). Not present in the s29 setup baseline. Indicates the flake is genuinely intermittent — same flake family as §13:461 + §15.4 fixed earlier this session.

## Reference

- s28 baseline: 643/3/122/5.2m (3 fails: §5.4, §6, §13.7.4)
- s29 setup baseline: 643/3/122/4.7m (same 3)
- s29 final baseline: 663/3/123/4.7m (§5.4 skipped, §20.7b NEW, §6 + §13.7.4 still failing)
