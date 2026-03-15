

## Plan: Fix 6 Remaining Audit Bugs

### FIX 1: Bulk message recipient error handling
**File:** `src/hooks/useBulkMessage.ts`

Add `error` destructuring and throw to 5 queries in `useRecipientPreview`:
- Line 97: `const { data: assignments, error: assignErr }` → `if (assignErr) throw assignErr;`
- Line 110: `const { data: students, error: studentErr }` → `if (studentErr) throw studentErr;`
- Line 117: `const { data: studentGuardians, error: sgErr }` → `if (sgErr) throw sgErr;`
- Line 135: `const { data: guardians, error: gErr }` → `if (gErr) throw gErr;`
- Line 140: `const { data: overdueInvoices, error: oErr }` → `if (oErr) throw oErr;`

### FIX 2: Missing error handling in hooks

**`useReports.ts`** — 4 unguarded queries:
- Line 13: `resolveTeacherId` helper — add `error` check
- Line 312: teachers fetch — add error check
- Line 320: locations fetch — add error check  
- Line 460, 472: attendance + teachers in cancellation report — add error checks

**`useRegisterData.ts`** — 6 unguarded queries:
- Line 122: teacher record lookup — add error check
- Lines 150, 158: location/room lookups — add error checks
- Lines 232, 243: lesson + membership auth checks — add error checks
- Lines 345, 350: participants + existing attendance — add error checks
- Line 440: teacher record in batch attendance — add error check

**`useTeacherAvailability.ts`** — Already has error handling on all queries. No changes needed.

**`useDeleteValidation.ts`** — 10+ queries using `{ count }` or `{ data }` without error checks. Add `error` destructuring and throw to each query (lines 36, 50, 62, 90, 107, 114, 121, 154, 171, 199, 217, 224, 243, 271).

### FIX 3: Invoice dropdown double-click protection
**File:** `src/components/invoices/InvoiceList.tsx`

The `InvoiceActions` component receives callback props without isPending. Add a local guard:

```typescript
const [busy, setBusy] = useState(false);
const guard = (fn: (inv: InvoiceWithDetails) => void) => {
  if (busy) return;
  setBusy(true);
  fn(invoice);
};
```

Apply `guard()` wrapper to onSend, onMarkPaid, onSendReminder, onVoid onClick handlers. The dropdown closes after click so `setBusy` resets naturally via unmount.

### FIX 4: Double-click on mutation buttons
**Verified status of each file:**
- `NeedsActionSection.tsx` — Already has `disabled={offerMutation.isPending}` and `disabled={dismissMutation.isPending}`. No change needed.
- `BrandingTab.tsx` — Already has `disabled={saveMutation.isPending}` with Loader2 spinner. No change needed.
- `ProfileTab.tsx` — Already has `disabled={saveMutation.isPending}` with Loader2 spinner. No change needed.
- **`ZoomIntegrationTab.tsx`** — Line 138: `AlertDialogAction` for disconnect is missing `disabled`. Add `disabled={disconnectCalendar.isPending}` and Loader2 spinner.

### FIX 5: CalendarPage null safety
**File:** `src/pages/CalendarPage.tsx`

- Line 34: Add defaults to destructuring:
  ```typescript
  const { teachers = [], locations = [], rooms = [], instruments = [] } = useTeachersAndLocations();
  ```
- Line 208: Already safe with defaults from above, but add defensive `(teachers ?? [])` as belt-and-suspenders.

### FIX 6: Delete unused files
All 20 files verified as having zero imports elsewhere. Safe to delete:

**Hooks (2):**
- `src/hooks/useNativeFeatures.ts`
- `src/hooks/useNativeNetwork.ts`

**Filter wrappers (2):**
- `src/components/invoices/InvoiceFiltersBarWithHelp.tsx`
- `src/components/calendar/CalendarFiltersBarWithHelp.tsx`

**Marketing components (16):**
- `src/components/marketing/LogoCloud.tsx`
- `src/components/marketing/CredibilityStrip.tsx`
- `src/components/marketing/FeaturesSection.tsx`
- `src/components/marketing/BentoFeatures.tsx`
- `src/components/marketing/LogoMarquee.tsx`
- `src/components/marketing/StatsCounter.tsx`
- `src/components/marketing/AudiencePaths.tsx`
- `src/components/marketing/feature-page/FeaturePageHero.tsx`
- `src/components/marketing/feature-page/FeaturePageCTA.tsx`
- `src/components/marketing/feature-page/FeaturePageProblem.tsx`
- `src/components/marketing/feature-page/FeaturePageSolution.tsx`
- `src/components/marketing/feature-page/FeaturePageHowItWorks.tsx`
- `src/components/marketing/feature-page/FeaturePageRelated.tsx`
- `src/components/marketing/use-case/UseCaseHero.tsx`
- `src/components/marketing/use-case/UseCasePainPoints.tsx`
- `src/components/marketing/use-case/UseCaseFeatures.tsx`

Note: `UseCaseTestimonial.tsx` was listed but doesn't exist in the directory — skipped.

### Files Modified

| File | Fix |
|------|-----|
| `useBulkMessage.ts` | #1: Error handling on 5 queries |
| `useReports.ts` | #2: Error handling on ~5 queries |
| `useRegisterData.ts` | #2: Error handling on ~8 queries |
| `useDeleteValidation.ts` | #2: Error handling on ~10 queries |
| `InvoiceList.tsx` | #3: Local busy guard on dropdown actions |
| `ZoomIntegrationTab.tsx` | #4: Add isPending to disconnect button |
| `CalendarPage.tsx` | #5: Default destructuring + defensive chaining |
| 20 files | #6: Delete unused components/hooks |

