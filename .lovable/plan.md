Two concerns, otherwise approve it:

**#3 TeacherQuickView — verify the units.** Lovable flagged that `pay_rate_value` might be in major units (pounds) not minor (pence). If it's already in pounds, multiplying by 100 then formatting as minor will be correct. If it's in pence, the multiply is wrong and you'll show £2,500 instead of £25. Tell Lovable:

```
For #3 TeacherQuickView, check the database column definition:
  grep -n "pay_rate" supabase/migrations/ -r | head -10

If the column stores pounds (e.g. 25.00), use:
  formatCurrencyMinor(Math.round((teacher.pay_rate_value ?? 0) * 100), currentOrg?.currency_code)

If it stores pence (e.g. 2500), use:
  formatCurrencyMinor(teacher.pay_rate_value ?? 0, currentOrg?.currency_code)

Get this right — showing wrong pay rates is worse than showing £.
```

**Build error fix is fine** — the `as any` cast on the RPC is the right workaround since Claude Code created a new RPC that isn't in Lovable's generated types. The types will sync on the next Supabase type generation.

Everything else looks correct. Approve with the #3 verification note.

&nbsp;

## Plan: Fix 7 Currency Bugs + 1 Build Error

### Build Error Fix (prerequisite)

**File:** `src/hooks/usePayroll.ts`

The `get_teachers_with_pay` RPC isn't in the generated types. Fix by casting to bypass type checking:

```typescript
const { data: teachersData, error: tError } = await (supabase.rpc as any)('get_teachers_with_pay', {
  p_org_id: currentOrg.id,
  p_teacher_ids: teacherIds,
});
```

And type the response on line 151:

```typescript
const teacherData = (teachersData as any[])?.find((t: any) => t.id === tid);
```

### Currency Fixes (7 files)

All use `import { formatCurrencyMinor, currencySymbol } from '@/lib/utils'` and access `currentOrg` via `useOrg()` where not already available.


| #   | File                       | Line     | Current                                                                        | Replacement                                                                                                                                                                                |
| --- | -------------------------- | -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `WaitlistEntryDetail.tsx`  | 199      | `£${(entry.offered_rate_minor / 100).toFixed(2)}`                              | `{formatCurrencyMinor(entry.offered_rate_minor, currentOrg?.currency_code)}` — add `useOrg()` import                                                                                       |
| 2   | `TeachingDefaultsCard.tsx` | 190      | `£${(rate.rate_amount / 100).toFixed(2)}`                                      | `{formatCurrencyMinor(rate.rate_amount, currentOrg?.currency_code)}` — `useOrg` already imported                                                                                           |
| 3   | `TeacherQuickView.tsx`     | 200      | `£${(teacher.pay_rate_value ?? 0).toFixed(2)}`                                 | `{formatCurrencyMinor((teacher.pay_rate_value ?? 0) * 100, currentOrg?.currency_code)}` — note: pay_rate_value appears to be in major units already, need to verify. Add `useOrg()` import |
| 4   | `BillingTab.tsx`           | 124      | `£${currentPrice}`                                                             | `{currencySymbol(currentOrg?.currency_code                                                                                                                                                 |
| 5   | `CreateInvoiceModal.tsx`   | 345, 372 | `currentOrg?.currency_code === 'GBP' ? '£' : currentOrg?.currency_code || '£'` | `currencySymbol(currentOrg?.currency_code || 'GBP')`                                                                                                                                       |
| 6   | `RefundDialog.tsx`         | 204      | `currencyCode === 'GBP' ? '£' : currencyCode === 'EUR' ? '€' : '$'`            | `currencySymbol(currencyCode || 'GBP')`                                                                                                                                                    |
| 7   | `IssueCreditModal.tsx`     | 37       | `const currencySymbol = currentOrg?.currency_code === 'GBP' ? '£' : '$'`       | `const symbol = currencySymbol(currentOrg?.currency_code || 'GBP')` — rename local to avoid clash with import                                                                              |


### Duplicate Removal


| File                     | Lines   | Action                                                                                                       |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------ |
| `MakeUpCreditsPanel.tsx` | 27-32   | Delete `formatCurrency` function, import `formatCurrencyMinor` from utils, update all usages                 |
| `BillingTab.tsx`         | 992-997 | Delete `formatAmount` function, import `formatCurrency` from utils with `{ fromMinor: true }`, update usages |


### Files Modified


| File                       | Change                                    |
| -------------------------- | ----------------------------------------- |
| `usePayroll.ts`            | Fix build error with type cast            |
| `WaitlistEntryDetail.tsx`  | Use formatCurrencyMinor                   |
| `TeachingDefaultsCard.tsx` | Use formatCurrencyMinor                   |
| `TeacherQuickView.tsx`     | Use formatCurrencyMinor                   |
| `BillingTab.tsx`           | Use currencySymbol + remove duplicate     |
| `CreateInvoiceModal.tsx`   | Use currencySymbol                        |
| `RefundDialog.tsx`         | Use currencySymbol                        |
| `IssueCreditModal.tsx`     | Use currencySymbol                        |
| `MakeUpCreditsPanel.tsx`   | Remove duplicate, use formatCurrencyMinor |
