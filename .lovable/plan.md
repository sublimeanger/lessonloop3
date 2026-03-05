

# Part 7: Parent Portal Mobile Overflow Fix

## Root Cause

The screenshots confirm horizontal overflow on every portal page. The outermost `<div>` in `PortalLayout.tsx` mobile branch has no overflow constraint, so any child that exceeds viewport width makes the entire page draggable sideways. The `<main>` has `overflow-auto` which explicitly allows horizontal scroll.

Likely overflow sources:
- Hero card decorative circles (`absolute -top-8 -right-8`) — even with `overflow-hidden` on the card, the card itself sits inside a non-clipped container
- Children cards `min-w-[220px]` in a flex row with `overflow-x-auto`
- Various cards without width constraints

## Fix — 3 changes, all in PortalLayout.tsx

### 1. Outermost wrapper: lock horizontal overflow
Line 41: Add `overflow-x-hidden` to the mobile wrapper div.

```
// Before
<div className="min-h-screen flex flex-col bg-background">

// After  
<div className="min-h-screen flex flex-col bg-background overflow-x-hidden">
```

### 2. Main element: prevent horizontal scroll
Line 46: Replace `overflow-auto` with `overflow-y-auto overflow-x-hidden`.

```
// Before
<main className="flex-1 overflow-auto px-4 py-4 pb-24">

// After
<main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24">
```

### 3. Content wrapper: constrain width
Line 47: Add `w-full` to ensure the max-w container respects parent width.

```
// Before
<div className="max-w-4xl mx-auto">

// After
<div className="max-w-4xl mx-auto w-full">
```

These 3 changes fix the horizontal drag on every portal page since they all render inside `PortalLayout`. No per-page changes needed — the layout shell is the single fix point.

**Files changed: 1** (`src/components/layout/PortalLayout.tsx`, 3 class modifications on lines 41, 46, 47)

