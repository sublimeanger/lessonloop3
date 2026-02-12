

# Fix Slow Auth Loading State

## Problem
When the app loads behind authentication, users see a bare spinner with "Loading..." text, and after 2 seconds a "Logout and try again" button appears. This feels broken and slow, even though auth typically resolves in 1-3 seconds.

## Solution
Replace the `AuthLoading` component in `RouteGuard.tsx` with a proper app-shell skeleton that mimics the real layout (sidebar + header + content area), giving users an instant sense of the app loading rather than a blank screen with a spinner.

## Changes

### File: `src/components/shared/LoadingState.tsx`
- Add a new `AppShellSkeleton` export that renders a full-page skeleton mimicking the AppLayout:
  - Left sidebar column with skeleton nav items (logo placeholder, 6 menu item skeletons)
  - Top header bar with skeleton breadcrumb and avatar
  - Main content area with 4 stat card skeletons and a list of card skeletons
- Uses existing `Skeleton` component for visual consistency

### File: `src/components/auth/RouteGuard.tsx`
- Replace the `AuthLoading` component's current spinner-on-blank-page with `AppShellSkeleton`
- The "Logout and try again" button (2s delay) and 8s force redirect logic stay, but render as a floating overlay on the skeleton rather than replacing the whole screen
- Result: users see a professional loading state that looks like the app is about to appear, not a broken blank page

No auth logic, timing, or routing changes -- purely a visual upgrade.

