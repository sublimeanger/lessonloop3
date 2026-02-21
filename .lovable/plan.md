

# World-Class Page Transitions

## Problem
When clicking between pages, the entire screen flashes a skeleton (sidebar, header, and all) because the `Suspense` boundary wraps all routes at the top level of `App.tsx`. Every lazy-loaded page triggers a full-screen skeleton replacement. Inside `AppLayout`, there's a `motion.div` with a fade-in, but no `AnimatePresence` for smooth exit animations -- so old content just vanishes instantly.

## Solution

A two-part fix that keeps the sidebar/header stable and crossfades only the page content area.

### 1. Move Suspense inside layouts (not around Routes)

Instead of one giant `<Suspense fallback={<AppShellSkeleton />}>` wrapping all routes, each layout will handle its own Suspense with a minimal, content-area-only fallback. This means the sidebar and header never flash or disappear during navigation.

**`AppLayout.tsx`**: Wrap `{children}` in a `<Suspense>` with a subtle inline spinner/shimmer (not the full AppShellSkeleton). The sidebar and header stay painted at all times.

**`PortalLayout.tsx`**: Same treatment -- Suspense wraps only the content area.

**`App.tsx`**: Replace the single Suspense with a lighter fallback (or remove it for routes already wrapped by layouts). Keep a minimal Suspense for routes that don't use a layout (marketing pages, auth pages).

### 2. Add AnimatePresence crossfade in layouts

**`AppLayout.tsx`**: Wrap the existing `motion.div` with `<AnimatePresence mode="wait">`. Add an `exit` prop so old content fades out before new content fades in. This creates a smooth crossfade between pages.

**`PortalLayout.tsx`**: Add the same `AnimatePresence` + `motion.div` pattern for portal pages.

### 3. Create a minimal content-area loading component

A new `PageTransitionFallback` component -- just a subtle centered spinner with a fade-in delay (so fast navigations show nothing). This replaces the jarring full-skeleton for Suspense boundaries inside layouts.

---

## Technical Details

### Files changed

**`src/components/shared/PageTransitionFallback.tsx`** (new)
- Minimal loading indicator: a small spinner that only appears after 150ms delay
- Matches the content area dimensions, no sidebar/header duplication

**`src/components/layout/AppLayout.tsx`**
- Import `AnimatePresence` from framer-motion and `Suspense` from React
- Wrap `motion.div` with `<AnimatePresence mode="wait">`
- Add `exit={{ opacity: 0, y: -4 }}` to the motion.div
- Wrap `{children}` inside a `<Suspense fallback={<PageTransitionFallback />}>`

**`src/components/layout/PortalLayout.tsx`**
- Import `AnimatePresence`, `motion`, `Suspense`, `useLocation`
- Add the same crossfade pattern around `{children}` in both mobile and desktop branches
- Use `<Suspense fallback={<PageTransitionFallback />}>` inside the content area

**`src/App.tsx`**
- Keep the outer `<Suspense>` but change fallback to `<AppShellSkeleton />` only for the initial cold load
- This is still needed for the very first page load, but in-app navigation will be handled by the layout-level Suspense instead

### Animation spec

```text
Enter:  opacity 0 -> 1, y 6px -> 0, duration 200ms, ease [0.22, 1, 0.36, 1]
Exit:   opacity 1 -> 0, y 0 -> -4px, duration 120ms, ease "easeIn"
Mode:   "wait" (old exits before new enters)
```

This gives a fast, premium feel -- old content subtly lifts and fades, new content drops in from below.

### No changes to routing or lazy loading

All existing `lazy()` imports and route definitions stay exactly as they are. This is purely a presentation-layer change.
