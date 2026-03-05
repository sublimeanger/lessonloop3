

# Fix: Add PortalSidebar to Mobile Branch

## Problem
The `Header` component renders a `SidebarTrigger` hamburger button on mobile, but the mobile branch of `PortalLayout.tsx` (lines 37-56) does not include `<PortalSidebar />`. Tapping the hamburger does nothing — parents cannot access Profile, sign out, or the full nav menu on iOS.

## Fix
One line addition at line 42 — add `<PortalSidebar />` after `<Header />`:

```
<Header />
<PortalSidebar />
```

The shadcn `Sidebar` component automatically renders as a sheet/drawer overlay on mobile when inside `SidebarProvider`. No other changes needed — the `SidebarTrigger` in `Header` will toggle it correctly.

**Files changed: 1** (`src/components/layout/PortalLayout.tsx`, line 42)

