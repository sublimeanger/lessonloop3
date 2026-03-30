

# P1: Invoice/Refund/Void UI Fixes — 4 Bugs

## Bug 1: Refund button missing for manual payments

**Root cause**: Line 464 of `InvoiceDetail.tsx` requires `payment.provider === 'stripe' && payment.provider_reference`. Manual payments never match.

**Fix**: The edge function `stripe-process-refund` explicitly rejects non-Stripe payments (line 55-57). So we need a separate "Record Refund" flow for manual payments that directly inserts a refund record.

### Changes:

**`src/pages/InvoiceDetail.tsx`** (~line 464):
- Change the refund button condition: show for ANY payment where `totalRefundedForPayment < payment.amount_minor`
- For Stripe payments (`payment.provider === 'stripe' && payment.provider_reference`): use existing RefundDialog (calls `stripe-process-refund`)
- For manual payments: use same RefundDialog but pass a new `isManual` prop

**`src/components/invoices/RefundDialog.tsx`**:
- Add `isManual?: boolean` prop
- When `isManual` is true, the confirm step text changes from "refund to parent's payment method" to "record this refund"
- When `isManual`, `handleConfirm` calls a new `processManualRefund` function instead of `processRefund`

**`src/hooks/useRefund.ts`**:
- Add a `processManualRefund` function that directly inserts into the `refunds` table via Supabase client (provider='manual', status='succeeded'), then calls the `recalculate_invoice_paid` RPC, then invalidates queries
- Export it alongside `processRefund`

---

## Bug 2: Void partially-paid invoice without warning

**Root cause**: Void dialog at line 711 doesn't check `totalPaid`.

### Changes:

**`src/pages/InvoiceDetail.tsx`** (~line 711-730):
- In the `AlertDialogDescription`, add a warning when `totalPaid > 0`:
  - "⚠️ This invoice has {formatCurrencyMinor(totalPaid, currency)} in recorded payments. Consider processing a refund before voiding."
- Change the action button text to "Void Anyway" when `totalPaid > 0`

---

## Bug 3: "From Lessons" invoice creation fails

**Root cause analysis**: The `findRateForDuration` function has a fallback of `3000` (£30) when no rate cards exist, so NaN isn't the issue. Looking at the code flow, the `onSubmit` at line 173 wraps `createInvoice.mutateAsync` without try/catch — if it throws, the error propagates silently.

More likely issues:
- The `From Lessons` path passes `linked_lesson_id` and `student_id` in items, but the `create_invoice_with_items` RPC only accepts `description`, `quantity`, `unit_price_minor` fields in the items JSONB — it does handle `linked_lesson_id` and `student_id` (line in the RPC). So the schema should work.
- Possible: lessons have no participants → `studentId` is undefined → RPC may fail on the UUID cast

### Changes:

**`src/components/invoices/CreateInvoiceModal.tsx`**:
- Wrap the `onSubmit` handler in try/catch with a toast on error (currently missing — the `mutateAsync` throws but nothing catches it for the lessons path)
- Add validation: if any lesson has no participants, show a warning toast and skip those lessons
- Add validation: if no rate cards exist AND tab is 'lessons', show an info message "No rate cards configured — using default rate of £30"

---

## Bug 4: Double-click creates duplicate students

**Root cause**: `StudentWizard.tsx` line 475 already has `disabled={isSaving}` on the Create button, and `isSaving` is set to `true` at the start of `handleCreate`. However, `handleCreate` is `async` and called from form `onSubmit` — the `setIsSaving(true)` call at the top of `handleCreate` may not disable the button fast enough if the duplicate check query takes time.

### Changes:

**`src/components/students/StudentWizard.tsx`**:
- The button at line 475 already has `disabled={isSaving}` — verify `isSaving` is set at the very start of `handleCreate` before any async operations
- Look at line 149: `handleCreate` starts with `if (!currentOrg) return;` then duplicate check. Add `if (isSaving) return;` as the first line to guard against re-entry
- Also add `setIsSaving(true)` immediately before the duplicate check, and ensure `setIsSaving(false)` in finally block
- For the "Continue Anyway" button in the duplicate dialog (line 510), add `disabled={isSaving}` as well

---

## Files Modified

| File | Bug |
|------|-----|
| `src/pages/InvoiceDetail.tsx` | #1 (refund button), #2 (void warning) |
| `src/components/invoices/RefundDialog.tsx` | #1 (manual refund support) |
| `src/hooks/useRefund.ts` | #1 (manual refund function) |
| `src/components/invoices/CreateInvoiceModal.tsx` | #3 (error handling + validation) |
| `src/components/students/StudentWizard.tsx` | #4 (double-click guard) |

