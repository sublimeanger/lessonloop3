

# Fix: Portal Mobile Content Width

## Root Cause

The `SidebarProvider` (line 119 of sidebar.tsx) renders a **flex row** wrapper:
```
className="group/sidebar-wrapper flex min-h-svh w-full ..."
```

The mobile branch's outer `<div>` on line 41 is a child of this flex row but has **no `w-full`**, so it only sizes to its content width (~60% of viewport). The `max-w-4xl mx-auto` on the content wrapper (line 48) is harmless at 390px but combined with `mx-auto` inside a flex context may further constrain width.

## Changes (1 file: `PortalLayout.tsx`)

### Line 41 — Outer div: add `w-full`
```
// Before
<div className="min-h-screen flex flex-col bg-background overflow-x-hidden">

// After
<div className="min-h-screen w-full flex flex-col bg-background overflow-x-hidden">
```

### Line 44 — ChildSwitcher wrapper: add `w-full`, drop `md:px-6`
```
// Before
<div className="px-4 pt-3 md:px-6">

// After
<div className="w-full px-4 pt-3">
```

### Line 48 — Content wrapper: remove `max-w-4xl mx-auto`, keep `w-full`
```
// Before
<div className="max-w-4xl mx-auto w-full">

// After
<div className="w-full">
```

### Line 47 — Main: add `w-full`
```
// Before
<main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-24">

// After
<main className="flex-1 w-full overflow-y-auto overflow-x-hidden px-4 py-4 pb-24">
```

These 4 class tweaks ensure every element in the mobile branch stretches to fill the SidebarProvider's flex row. Desktop branch is untouched — it keeps `max-w-4xl mx-auto` for wide screens.

