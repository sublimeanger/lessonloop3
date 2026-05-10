# subscription_plan enum vs UI/marketing tier names diverge

**Severity:** P3 (cosmetic / DX)
**Status:** deferred to v1.1
**Area:** schema / naming consistency
**Discovered:** 2026-05-10 (s31, confirmed s32)
**Affected components:** `public.subscription_plan` enum, `seed-shadow-org` tier mapping, future plan-tier UI surfaces

## Symptom

The DB enum and the user-facing tier nomenclature are not aligned:

| User-facing name (UI / marketing / handover docs) | DB enum value (`subscription_plan`) |
| --- | --- |
| Teacher tier (solo)                                | `solo_teacher`                       |
| **Studio tier**                                    | **`academy`** (no `studio` value)    |
| Agency tier                                        | `agency`                             |
| (trial)                                            | `trial`                              |
| Custom plan                                        | `custom`                             |

`seed-shadow-org` resolves this by mapping `tier="studio"` → `subscription_plan="academy"` (and `org_type="studio"`), which is correct at the data level but surprising at the code level. The mapping lives in `supabase/functions/seed-shadow-org/index.ts:158-163`.

## Why it matters

- New engineers (or future-me) will look at the enum and assume `academy` and `studio` are the same plan — but the org_type IS `studio` and the plan IS `academy`, which is confusing.
- The CHANGELOG / billing UI that surfaces "you're on the Studio plan" has to translate `academy` → "Studio" at render time.
- Any feature flag keyed on `subscription_plan` needs to remember the historical naming.

## Recommended v1.1 fix

Two options — neither is launch-blocking:

1. **Rename the enum value** `academy` → `studio`. Migration is mechanical: `ALTER TYPE subscription_plan RENAME VALUE 'academy' TO 'studio'`. Backfill any code references. Risk: trips up any external system that has serialised the string (currently none).

2. **Codify the mapping** in `src/lib/subscription-tiers.ts` (or similar) so that both directions are explicit:
   ```ts
   export const TIER_TO_PLAN = { teacher: 'solo_teacher', studio: 'academy', agency: 'agency' } as const;
   export const PLAN_TO_TIER_LABEL = { solo_teacher: 'Teacher', academy: 'Studio', agency: 'Agency' } as const;
   ```
   Lower-risk; the source-of-truth becomes explicit even if the enum stays.

Pick whichever the codebase treats as the source-of-truth.

## Deferral rationale

Doesn't break any flow. Doesn't surprise users (UI renders "Studio" correctly). Surprises only engineers reading the schema. Not launch-blocking. Scheduled for v1.1 hygiene pass alongside other naming-consistency fixes.

## References

- s31 milestone: shadow programme infrastructure deployed; seed-shadow-org tier mapping established.
- s32 finding: confirmed the mismatch persists; documented here rather than fixing during the shadow-seed-expansion session to keep s32 focused on minimum-viable-shadow data.
