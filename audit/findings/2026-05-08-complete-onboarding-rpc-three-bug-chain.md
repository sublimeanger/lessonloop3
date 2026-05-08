# complete_onboarding RPC — 3-bug chain on first smoke test

**Severity:** critical
**Status:** fixed
**Area:** onboarding
**Discovered:** 2026-05-08
**Fixed:** 2026-05-08
**Fixed in:** 19d8efc
**Affected components:** supabase/migrations/20260508110000_fix_complete_onboarding_enum_casts.sql, public.complete_onboarding, public.seed_make_up_policies

## Symptom

First end-to-end onboarding test on destination errored at the `complete_onboarding` RPC call. Frontend showed "An internal error occurred. Please try again." Three distinct bugs chained — fixing each unmasked the next.

## Root cause

Three compounding bugs:

1. **Text→enum cast missing.** `organisations.org_type`, `.subscription_plan`, `.subscription_status` are USER-DEFINED enums. RPC passed text params straight in: `ERROR 42804: column "org_type" is of type org_type but expression is of type text`. Source's environment had implicit text→enum assignment casts that weren't in the migrated baseline.
2. **`seed_make_up_policies` blocked service_role.** Seed function guarded itself with `is_org_admin(auth.uid(), _org_id)`, but `auth.uid()` is NULL when called in service_role context. Result: every onboarding call raised "Not authorised" inside the seed step.
3. **Exception catch too narrow.** complete_onboarding only caught `undefined_function` for the seed helper. Bug 2's P0001 bubbled up and rolled back the whole transaction.

## Fix

Single migration addresses all three:
- Added explicit `::org_type`, `::subscription_plan`, `::subscription_status` casts on insert
- Added `current_setting('role')='service_role'` bypass in seed function
- Broadened exception catch to `WHEN OTHERS` with WARNING log

## Verification

- Re-ran RPC under `SET LOCAL ROLE service_role`: organisation created, owner membership active, profile flag flipped, 8 make_up_policies seeded, 1 location, 1 teacher (solo_teacher path)
- Cleaned up test org + reset Jamie's profile flag for fresh re-test

## Lessons / follow-ups

When an RPC has a chain of dependent steps, single fixes can unmask new failures at each step. Run the smoke test after each fix until it completes cleanly. The `auth.uid() IS NOT NULL` guard pattern is a recurring footgun in code that legitimately needs service-role invocation paths — audit for similar guards elsewhere.
