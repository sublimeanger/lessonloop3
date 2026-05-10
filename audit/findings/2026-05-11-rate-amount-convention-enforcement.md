# rate_cards.rate_amount unit-convention contradiction (P1 → resolved)

**Severity:** P1 (launch-blocker before fix)
**Status:** RESOLVED in s36
**Area:** money / billing
**Discovered:** 2026-05-11 (Jamie's UI walkthrough of 551ca74e shadow studio)
**Fixed:** 2026-05-11 (s36)
**Affected components:** `rate_cards.rate_amount` column + 18 application files + 4 PL/pgSQL functions + 5 seed scripts

## Symptom

Two of three discoveries (Jamie's UI walkthrough; the LoopAssist edge fn audit; cross-org data archaeology) revealed the same root cause: the `rate_cards.rate_amount` column had two contradictory unit conventions in the codebase.

| Convention | Where used |
| --- | --- |
| **A — Pence (minor units)** | UI (RateCardsTab, formatCurrencyMinor calls), `useRateCards`, all invoicing edge fns (`create-billing-run`, `create-continuation-run`, `process-term-adjustment`, `csv-import-execute`), `confirm_makeup_booking` PL/pgSQL |
| **B — Pounds (major units)** | `looopassist-execute` (2 sites with `* 100` conversion + explicit `// rate_amount is stored as decimal major units` comment), `auto_issue_credit_on_absence` PL/pgSQL, `generate_invoices_from_template` PL/pgSQL (3 lookups), `retry_failed_recipients` PL/pgSQL (3 lookups), all 5 seed functions |

The column itself was named `rate_amount` (no `_minor` suffix) and stored as `NUMERIC` with no DB-level enforcement — making either convention legible.

Live data was correspondingly split. Of 63 rate_cards across 13 orgs:
- 36 were pence-shaped (values in 875-6500 range)
- 27 were pound-shaped (values in 22-65 range) across 6 orgs: 3 different orgs named "Crescendo Music Agency", LTP Music (4 of 5 cards), Ms Taylor's Music (all 3), E2E Test Academy (1).
- LTP Music had MIXED shape — 4 pound + 1 pence in the same org.

Jamie noticed when opening the shadow studio's Rate Cards UI: all 8 cards showed as £0.15-£0.65 (the UI uses Convention A and divides by 100, so 20.00 pounds-shaped renders as £0.20).

Had Lauren signed in for shadow term + run LoopAssist billing on a pence-shaped org → invoices would have been **100× too cheap** (LoopAssist multiplies by 100, treating pence as pounds).
Had Lauren run LoopAssist on a pound-shaped org → invoices would have been correct via Convention B.
Either way, the moment two orgs were billed differently, the bug would be visible. Launch-blocker.

## Root cause

Column name `rate_amount` is ambiguous. Without a `_minor` suffix or a DB CHECK constraint, both conventions are syntactically valid. Two camps of contributors landed code with opposite assumptions over the project's history, neither catching the other's pattern.

The seed functions wrote pound-shaped values because their literals read as natural prices (`30, 35, 60` etc.) without `* 100`. The UI's RateCardsTab masked the bug by dividing-by-100 on load and multiplying-by-100 on save, which made the form state appear in pounds — internally consistent if you only used the UI to create cards. But seed-script-created cards bypassed the UI and shipped pound-shaped to disk.

## Fix (s36)

### Phase 1 — DB migration

1. `UPDATE rate_cards SET rate_amount = rate_amount * 100 WHERE rate_amount < 200` — migrates the 27 pound-shaped rows to pence-shaped. Pre-flight HALT if count > 100 (safety check for real-customer scale).
2. `ADD CONSTRAINT rate_amount_is_minor_units CHECK (rate_amount >= 100 OR rate_amount = 0)` — DB-level enforcement preventing future pound-shaped inserts.
3. `RENAME COLUMN rate_amount TO rate_amount_minor` — column name now matches codebase convention.
4. `COMMENT ON COLUMN rate_amount_minor IS 'Lesson rate in MINOR units (pence/cents)...'` — discoverable documentation.

Applied via `apply_migration` as `rate_amount_to_minor_pence_convention`.

### Phase 2 — App-side propagation

- LoopAssist `looopassist-execute/index.ts` Convention-B bug fixed at 2 sites (lines 485-518 and 1071-1112). Comment updated. `* 100` removed.
- 4 live PL/pgSQL functions recreated with `rate_amount_minor` + Convention-B `* 100` removed where present:
  - `confirm_makeup_booking` (rename only)
  - `auto_issue_credit_on_absence` (2× `* 100` removed)
  - `generate_invoices_from_template` (2× `* 100` removed)
  - `retry_failed_recipients` (2× `* 100` removed)
  Applied via `rate_amount_minor_propagate_to_plpgsql` + `_to_template_runners` + `_retry_failed` migrations.
- 18 application files updated via `perl -i -pe 's/\brate_amount\b/rate_amount_minor/g'`. `npx tsc --noEmit` clean post-rename. Files touched:
  - `src/components/calendar/QuickCreatePopover.tsx`
  - `src/components/calendar/useLessonForm.ts`
  - `src/components/invoices/BillingRunWizard.tsx`
  - `src/components/settings/RateCardsTab.tsx`
  - `src/components/students/TeachingDefaultsCard.tsx`
  - `src/components/students/wizard/TeachingDefaultsStep.tsx`
  - `src/hooks/useRateCards.ts`
  - `src/integrations/supabase/types.ts`
  - `supabase/functions/create-billing-run/index.ts`
  - `supabase/functions/create-continuation-run/index.ts`
  - `supabase/functions/csv-import-execute/index.ts`
  - `supabase/functions/looopassist-chat/index.ts`
  - `supabase/functions/process-term-adjustment/index.ts`
  - `supabase/functions/seed-demo-agency/index.ts`
  - `supabase/functions/seed-demo-data/index.ts`
  - `supabase/functions/seed-demo-solo/index.ts`
  - `supabase/functions/seed-e2e-data/index.ts`
  - `scripts/seed-shadow-clusters.sql`

### Phase 3 — World-class money input UX

- New component: `src/components/ui/money-input.tsx` (135 lines). Stores values as MINOR units in parent state. User-facing text input with `inputMode="decimal"` so mobile keyboards show the decimal point. Strips non-numeric chars, allows one decimal point, caps at 2 decimal places. On blur, pads to 2 decimals ("35" → "35.00"). Live preview below input: "= £35.00 GBP". Optional info-icon helpText.
- Wired into RateCardsTab: removed the load-time `/100` and save-time `*100` dance. Form state now matches DB column directly. Help text: "Enter the price as you'd write it. 35 or 35.00 both mean thirty-five pounds. 3500 means three thousand five hundred pounds."
- 14 unit tests in `src/test/ui/MoneyInput.test.tsx` cover: typing intuition (`35`, `35.00`, `3500`, `35.5`), input sanitisation (strip non-numeric, single dot, max 2 decimals), state sync (initial render + external prop change), preview behaviour (hidden when 0, formatted when >0), accessibility (inputMode=decimal, type=text not number). 14/14 pass.

### Phase 3 deferral — other money inputs

9 other `Input type="number"` sites in `src/components/invoices/` use `amount_minor` / `unit_price_minor` columns (already correctly named). The HARD RULE for s36 was to not touch those columns. Deferred to v1.1 UX polish:
- BillingRunWizard custom amount overrides
- CreateInvoiceModal item amounts (2 sites)
- EditInvoiceModal item amounts (2 sites)
- PaymentPlanSetup per-installment override
- PaymentPlanToggle threshold
- RecordPaymentModal amount
- RefundDialog amount

These are functionally correct as-is (no unit ambiguity) — they're just rougher UX.

### Phase 4 — verification

- `SELECT count(*) FILTER (WHERE rate_amount_minor < 200 AND > 0) FROM rate_cards` → 0 pound-shaped remaining
- 63 cards / 13 orgs / min £8.75 / max £65.00
- All live PL/pgSQL function bodies no longer reference the old column name (confirmed via `pg_proc.prosrc` regex)
- `npx tsc --noEmit` clean
- 14/14 MoneyInput unit tests pass

## Latent over-billing risk (none materialised)

The LoopAssist `* 100` Convention-B bug would have over-billed by 100× on any pence-shaped org's invoices. No real customers exist yet, so no real bills were inflated. Documenting the latent risk in case post-mortem investigation is ever needed for test-org data:
- Shadow studio invoices generated in s32 used hardcoded values, not LoopAssist — unaffected.
- s33 LoopAssist test invocations on pound-shaped orgs would have been correct via Convention B (the bug masked itself on those).
- No production LoopAssist runs occurred against pence-shaped orgs.

## Why Option A (column rename) vs Option B (CHECK only)

Per the s36 prompt's recommendation. Option B (CHECK constraint without rename) would have left the column named `rate_amount` while documenting via comment that it's minor units — preserving the readability landmine for future contributors. Option A's `_minor` suffix matches the existing convention (`unit_price_minor`, `amount_minor`, `credit_value_minor`, etc.) and makes future ambiguity impossible at the name layer.

## v1.1+ follow-up

- Audit other `numeric` money columns without `_minor` suffix for similar ambiguity (none found in this scan, but worth a v1.1 sweep).
- Wire MoneyInput into the remaining 9 numeric money inputs in `src/components/invoices/` for UX consistency.
- Consider extracting `MoneyInput` props for `valueMinorCents` vs `valueMinorPence` so non-GBP orgs (when we have them) feel native.
