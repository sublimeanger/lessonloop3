

# UI Polish Audit — Part 1: Spacing & Alignment

## Summary

Five targeted fixes to standardise spacing across the app. No redesign — just tightening inconsistencies in layout padding, header margins, stat grids, card padding, and gap utilities.

---

## 1.1 — Standardise layout padding

**AppLayout.tsx line 58**: Change `p-4 md:p-6 lg:p-8` to `px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6`

**PortalLayout.tsx line 46** (mobile): Change `p-6 pb-24` to `px-4 py-4 pb-24`
**PortalLayout.tsx line 66** (desktop): Change `p-6 md:p-8` to `px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6`

Both layouts will share the same responsive padding pattern.

## 1.2 — PageHeader bottom margin

**PageHeader.tsx line 13**: Change `mb-4` to `mb-5 sm:mb-6`

Single change, consistent across all pages that use this component.

## 1.3 — Shared StatsGrid component

Create `src/components/shared/StatsGrid.tsx`:
```tsx
// Simple wrapper: grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4
// Accepts children, optional className override
```

Update consumers:
- **Dashboard.tsx** (3 stat grid instances at lines ~200, ~313, ~459): Replace inline grid divs with `<StatsGrid>`
- **MakeUpStatsCards.tsx**: Replace its internal grid with `<StatsGrid>`
- **InvoiceStatsWidget** stays as-is (it's an inline text layout, not a card grid)

## 1.4 — Card padding standardisation

Apply consistent responsive padding to card types:

- **StatCard.tsx** (line ~71): Already `p-4 sm:p-5` — change to `p-3 sm:p-4` (compact)
- **MakeUpStatsCards.tsx**: Change `p-4` to `p-3 sm:p-4` (compact)
- **Card component default** (`CardContent`/`CardHeader`): Leave the base `p-5` as-is since it serves content cards well. Individual compact cards override locally.

This is a targeted fix on stat-type cards only to avoid a massive diff across dozens of files.

## 1.5 — space-y to gap migration (scoped)

Full migration of all 66 files is too risky in one pass. Scope to **layout and page-level containers only**:

- **PageHeader.tsx line 15**: `space-y-1` on a div that already uses flex — change to `gap-1` and add `flex flex-col`
- **Dashboard.tsx**: Audit top-level `space-y-4 sm:space-y-6` section wrappers — convert to `flex flex-col gap-4 sm:gap-6`
- Leave form `space-y-2` patterns (Label + Input stacks) untouched — those are plain stacked layouts without flex and work correctly

---

## Files touched

| File | Change |
|------|--------|
| `src/components/layout/AppLayout.tsx` | Padding classes |
| `src/components/layout/PortalLayout.tsx` | Padding classes (2 spots) |
| `src/components/layout/PageHeader.tsx` | Margin + gap |
| `src/components/shared/StatsGrid.tsx` | **New file** |
| `src/pages/Dashboard.tsx` | Use StatsGrid, convert space-y to gap |
| `src/components/dashboard/StatCard.tsx` | Compact padding |
| `src/components/makeups/MakeUpStatsCards.tsx` | Use StatsGrid, compact padding |

