
Goal: make child filtering actually work end-to-end (not just on the current URL), and make it visibly clear when filtering is active.

1) Audit findings (why it feels broken today)
- The filter source of truth is `?child=` in URL (`ChildFilterContext`).
- Most portal navigation links do not preserve query params, so switching pages drops the selected child.
- Home still links to schedule with legacy `?student=` (`PortalHome.tsx`), but context only reads `?child=`.
- Schedule currently depends on `selectedChildId`; if query gets dropped, it silently shows all.
- UX issue: there is no strong “active filter” indicator on Home/Schedule, so users perceive no change.

2) Implementation plan (complete fix)
- A. Normalize filter param and keep backward compatibility
  - Update `src/contexts/ChildFilterContext.tsx` to:
    - accept both `child` and legacy `student` params,
    - auto-normalize legacy `student` → `child` (replace URL),
    - expose current child id consistently.
- B. Preserve child filter across portal navigation
  - Add a small helper (new hook/util) to build portal links while retaining `child` query param.
  - Apply it in:
    - `src/components/layout/PortalSidebar.tsx`
    - `src/components/layout/PortalBottomNav.tsx`
    - `src/pages/portal/PortalHome.tsx` (all `Link`/`navigate` portal targets)
    - `src/components/portal/ThisWeekFocus.tsx` (future-proof links)
- C. Fix incorrect Home schedule deep-link
  - Replace `navigate('/portal/schedule?student=...')` with child-aware route using `child`.
- D. Make active filter visible (UX fix so it never “does nothing”)
  - On Home and Schedule page headers, show an “Active child: {Name}” badge/chip + “Clear” action.
  - Update empty states to mention selected child (e.g., “No lessons found for {child}”).
- E. Hardening edge cases
  - In `ChildSwitcher`, if URL child id is no longer valid for this guardian/org, reset to “All children”.
  - In `useParentLessons` (`src/hooks/useParentPortal.ts`), add a post-filter guard:
    - if `options.studentId` is set and no matching allowed student IDs remain, return `[]` early (avoid malformed/empty `in()` calls and confusing behavior).

3) Scope/behavior after fix
- Selecting a child will persist while moving between portal pages.
- Home and Schedule will both reflect the same active child filter.
- Legacy links using `?student=` will continue to work (auto-migrated to `?child=`).
- “All children” remains one click away and clearly represented.

4) Technical details
- No backend schema/RLS changes required.
- Primary files to update:
  - `src/contexts/ChildFilterContext.tsx`
  - `src/components/layout/PortalSidebar.tsx`
  - `src/components/layout/PortalBottomNav.tsx`
  - `src/pages/portal/PortalHome.tsx`
  - `src/pages/portal/PortalSchedule.tsx`
  - `src/components/portal/ChildSwitcher.tsx`
  - `src/hooks/useParentPortal.ts` (guard in `useParentLessons`)
  - `src/components/portal/ThisWeekFocus.tsx` (link consistency)
- Keep current architecture (React Query + URL-driven filter), just make it consistent and resilient.

5) Verification checklist (must pass)
- Select Child A on Home → Home cards/next lesson reflect Child A.
- Navigate to Schedule via sidebar, bottom nav, and Home CTA → still filtered to Child A.
- Switch to Child B on Schedule → list updates and stays filtered when navigating back Home.
- Hit old URL `/portal/schedule?student=<id>` → auto-converts and filters correctly.
- Clear filter (“All children”) → all pages return to aggregated view.
- Test on both desktop sidebar and mobile bottom nav flows.
