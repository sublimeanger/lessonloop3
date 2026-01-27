
# Remaining UI Polish Fixes

## Overview

This plan completes the UI polish audit by addressing the remaining gaps in modal mobile margins. All three main dialog components need edge spacing for small mobile screens.

---

## Files to Update

### 1. CreateInvoiceModal.tsx (Line 240)
**Current:**
```tsx
<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
```
**Change to:**
```tsx
<DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto mx-4 sm:mx-auto">
```

### 2. BillingRunWizard.tsx (Line 138)
**Current:**
```tsx
<DialogContent className="max-w-xl">
```
**Change to:**
```tsx
<DialogContent className="max-w-xl mx-4 sm:mx-auto">
```

### 3. LessonModal.tsx (Line 501)
**Current:**
```tsx
<DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
```
**Change to:**
```tsx
<DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
```

---

## GDPR.tsx Status

After review, `GDPR.tsx` does **not** use the `prose` class - it uses individual Tailwind text classes (`text-foreground`, `text-muted-foreground`). These are already theme-aware and work correctly in dark mode. No changes needed.

---

## Technical Details

The `mx-4 sm:mx-auto` pattern ensures:
- **Mobile (< 640px)**: 16px margin on each side, preventing edge-to-edge dialogs
- **Tablet/Desktop (>= 640px)**: Auto margins centre the dialog as normal

This is a minimal, non-breaking change that improves touch target spacing on mobile devices.

---

## Summary

| File | Change |
|------|--------|
| `CreateInvoiceModal.tsx` | Add mobile edge margins |
| `BillingRunWizard.tsx` | Add mobile edge margins |
| `LessonModal.tsx` | Add mobile edge margins |
| `GDPR.tsx` | No change needed (already theme-aware) |

**Total: 3 single-line edits**
