

# UI Polish — Part 3: Animations & Micro-Interactions

## 3.1 — Page entrance animation
Already handled in previous step (duration 0.2s → 0.25s, translateY 6px → 8px). No further work needed.

## 3.2 — Loading skeletons for key pages

Add skeletons to 5 pages that currently show nothing or a generic spinner while loading:

| Page | Current loading state | Skeleton design |
|------|----------------------|-----------------|
| **Invoices** (`src/pages/Invoices.tsx` line 147) | `<LoadingState>` spinner | Stats widget (4 shimmer cards) + table rows (6 rows) |
| **Leads** (`src/pages/Leads.tsx`) | No loading guard at all | Kanban: 4 columns with 2-3 card shimmers each |
| **Reports** (`src/pages/Reports.tsx` line 179) | `<LoadingState>` spinner | Grid of 6 card shimmers matching the report card layout |
| **Resources** (`src/pages/Resources.tsx`) | No loading guard | Grid of 6 card shimmers |

**Implementation**: Add new skeleton functions to `src/components/shared/LoadingState.tsx`:
- `InvoicesSkeleton`: 4 stat cards row + 6 table row shimmers
- `KanbanSkeleton`: 4 columns with card placeholders
- `ReportGridSkeleton`: 3-col grid of card shimmers
- `ResourceGridSkeleton`: 3-col grid of card shimmers

Then replace `<LoadingState>` / add `isLoading` guards in each page.

Calendar already uses `<CalendarSkeleton>` so no change needed there.

## 3.3 — Cards missing hover elevation

Add `data-interactive` to clickable cards that navigate on click:

| Component | Location |
|-----------|----------|
| `LeadCard.tsx` | The outer div with `onClick={() => navigate(...)}` |
| `InvoiceList.tsx` | Mobile card div (line ~206) and desktop row div (line ~400) |
| `ResourceCard.tsx` | If it wraps a clickable card |

The `data-interactive` attribute on `<Card>` or card-like divs triggers `cursor-pointer`, `hover:shadow-card-hover`, and `active:scale-[0.995]` from the Card component's base styles.

For non-Card divs (like invoice rows), add `hover:shadow-sm` and ensure `cursor-pointer` is present.

## 3.4 — LoopAssist typing indicator polish

The staff `TypingIndicator` already uses `typing-bounce` with teal-ish dots (`bg-muted-foreground/60`). The parent `ParentLoopAssist` uses a different pattern (`bg-primary/40 animate-bounce`).

**Fix**: Update `ParentLoopAssist.tsx` (lines 199-202) to match the staff pattern — use the same `typing-bounce` keyframe with staggered delays (0s, 0.2s, 0.4s) and `bg-primary/40` dots. This gives consistent brand feel.

Staff indicator is already well-styled — no changes needed there.

## 3.5 — Toast progress bar

The `ToastProgress` component already exists in `src/components/ui/toast.tsx` and is already rendered in `src/components/ui/toaster.tsx`. The `toast-progress` keyframe is defined in `index.css`. This is **already implemented**. No changes needed.

## 3.6 — Button press feedback

The base `Button` component already has `active:scale-[0.98]` which applies to all variants including `ghost` and all sizes including `icon`. No audit needed — any element using `<Button>` gets press feedback automatically.

**Fix**: Only non-Button clickable elements need attention. The sidebar nav items and filter pills use `<NavLink>` or custom divs. Add `active:scale-[0.98]` to:
- `NavLink.tsx` base classes (line 18)

This covers sidebar links and any other NavLink usage.

## 3.7 — Sidebar active link transition

`SidebarNavItem` in `AppSidebar.tsx` (line 212) already has `transition-colors` on the NavLink. The active class `bg-sidebar-primary text-sidebar-primary-foreground` will transition smoothly. Verify `duration-150` is present — if not, add it.

Current: `transition-colors hover:bg-sidebar-accent`
Fix: `transition-colors duration-150 hover:bg-sidebar-accent`

---

## Files touched

| File | Change |
|------|--------|
| `src/components/shared/LoadingState.tsx` | Add 4 new skeleton components |
| `src/pages/Invoices.tsx` | Replace `<LoadingState>` with `InvoicesSkeleton` |
| `src/pages/Leads.tsx` | Add loading guard with `KanbanSkeleton` |
| `src/pages/Reports.tsx` | Replace `<LoadingState>` with `ReportGridSkeleton` |
| `src/pages/Resources.tsx` | Add loading guard with `ResourceGridSkeleton` |
| `src/components/leads/LeadCard.tsx` | Add `data-interactive` |
| `src/components/invoices/InvoiceList.tsx` | Add hover elevation classes |
| `src/components/parent-portal/ParentLoopAssist.tsx` | Align typing dots to `typing-bounce` keyframe |
| `src/components/NavLink.tsx` | Add `active:scale-[0.98]` |
| `src/components/layout/AppSidebar.tsx` | Add `duration-150` to nav item transition |

