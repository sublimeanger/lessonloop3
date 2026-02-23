

## Fix: Payroll Pay Rates Are 100x Too High

### Problem
The `pay_rate_value` column in the `teachers` table stores values in **pence (minor units)** -- e.g. `3500` means GBP 35.00. But the payroll hook (`usePayroll.ts`) reads this value with `Number(teacherData?.pay_rate_value)` and uses it directly in calculations as if it were pounds. This makes every pay figure 100x too large:

- A GBP 35/lesson rate displays as GBP 3,500/lesson
- A GBP 25/hr rate displays as GBP 2,500/hr

### Root Cause
In `src/hooks/usePayroll.ts`, line 156:
```typescript
payRateValue: Number(teacherData?.pay_rate_value) || 0,
```
This reads the minor-unit value (3500) and passes it straight into the pay calculation without dividing by 100.

### Fix
A single change in `src/hooks/usePayroll.ts` -- divide by 100 when reading `pay_rate_value` from the database, in both the primary path and the fallback path:

**Primary path (line 156):**
```typescript
// Before
payRateValue: Number(teacherData?.pay_rate_value) || 0,

// After
payRateValue: (Number(teacherData?.pay_rate_value) || 0) / 100,
```

**Fallback path (line 136):** The fallback sets `payRateValue: 0` so no change needed there.

**Also fix the display label** in `Payroll.tsx` (line 63-65) -- `getPayRateLabel` calls `fmtCurrency(value)` which treats the value as pounds. After the division fix, this will automatically display correctly (e.g. GBP 35 instead of GBP 3,500).

### Scope
- **1 file changed**: `src/hooks/usePayroll.ts` -- one line edit
- No database migration needed
- No UI changes needed (the display functions already handle pounds correctly)

### Verification
After the fix, James Fletcher (pay_rate_value = 3500, per_lesson) should show as "GBP 35.00 per lesson" instead of "GBP 3,500 per lesson".
