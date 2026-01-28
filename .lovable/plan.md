

# Mobile Dialog Polish Plan

## Problem Summary

The Add Student wizard (and other modals) appear "janky" on mobile because:

1. **Base Dialog margin issue**: The `mx-4 sm:mx-auto` class on DialogContent doesn't work with fixed positioning + `w-full` + `translate-x-[-50%]`. Margins are applied but don't constrain the actual width.

2. **Step indicator layout**: On mobile (without connectors), the 3 steps still use `justify-between` which spreads icons across the full width with too much space.

3. **Step label text wrapping**: Labels like "Teaching Setup" may wrap awkwardly on very small screens.

---

## Solution

### 1. Fix Base Dialog Component

Update `src/components/ui/dialog.tsx` to use proper mobile-safe width constraints:

**Current (line 39)**:
```css
fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] ...
```

**Fixed**:
```css
fixed left-4 right-4 top-[50%] z-50 grid w-auto max-w-lg translate-y-[-50%] sm:left-[50%] sm:right-auto sm:w-full sm:translate-x-[-50%] ...
```

This uses `left-4 right-4` on mobile (which respects the 16px edge gaps) and reverts to centered positioning on `sm:` and above.

### 2. Fix Student Wizard Step Indicator

Update `src/components/students/StudentWizard.tsx` step indicator layout:

**Current (line 290)**:
```jsx
<div className="flex items-center justify-between py-4 px-2">
```

**Fixed**:
```jsx
<div className="flex items-center justify-center gap-4 sm:justify-between py-4 px-2">
```

On mobile, this centers the step icons with consistent gaps instead of spreading them edge-to-edge.

### 3. Shorten Mobile Step Labels

Update step labels to use abbreviated text on very small screens:

**Current (line 310-315)**:
```jsx
<span className="mt-2 text-xs font-medium text-center">
  {label}
</span>
```

**Fixed**:
```jsx
<span className="mt-2 text-xs font-medium text-center max-w-[60px] sm:max-w-none truncate">
  {label}
</span>
```

This constrains the label width on mobile to prevent awkward wrapping.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/dialog.tsx` | Fix base DialogContent positioning for mobile |
| `src/components/students/StudentWizard.tsx` | Center step indicator on mobile + truncate labels |

---

## Technical Details

The key insight is that with `position: fixed`, you cannot use margins to create edge gaps. Instead, you must use `left: 16px; right: 16px` to pin the element with proper gaps, then override with centered positioning on larger screens.

```text
Mobile (before):
+------------------------------------------+
|  [========== DIALOG ===========]  <- Full width, margins don't work
+------------------------------------------+

Mobile (after):
+------------------------------------------+
|    [======= DIALOG =======]    <- 16px gaps on left and right
+------------------------------------------+
```

---

## Expected Result

After implementation:
- All dialogs will have proper 16px edge margins on mobile
- Step indicator will be visually balanced on small screens
- No text overflow or awkward wrapping in wizard steps
- Desktop layout remains unchanged

