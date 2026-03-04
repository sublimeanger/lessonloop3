

# UI Polish — Part 2: Typography Hierarchy

## Scope

App components only. Marketing pages excluded (they'll be migrated to static HTML and have their own typographic needs with larger display sizes).

---

## 2.1 — Replace `font-bold` with design tokens

Audit every `font-bold` in non-marketing app components and replace with the correct token. Here's the mapping by file:

| File | Current | Replace with |
|------|---------|-------------|
| `PaymentAnalyticsCard.tsx` | `text-lg font-bold` | `text-lg font-semibold` (numeric display) |
| `CalendarMobileLayout.tsx` | `text-xl font-bold` | `text-xl font-semibold` |
| `MobileWeekView.tsx` | `text-lg font-bold` | `text-lg font-semibold` |
| `LessonCard.tsx` | `text-xl sm:text-2xl font-bold` | `text-xl sm:text-2xl font-semibold` |
| `WeekTimeGrid.tsx` | `text-lg font-bold` | `text-lg font-semibold` |
| `LessonDetailSidePanel.tsx` | `text-lg font-bold` (title) | `text-section-title` |
| `LessonDetailSidePanel.tsx` | `text-micro font-bold` (avatar initial) | keep — decorative |
| `WeekContextStrip.tsx` | `text-base sm:text-lg font-bold` | `text-base sm:text-lg font-semibold` |
| `MobileLessonSheet.tsx` | `text-lg font-bold` (title) | `text-section-title` |
| `MobileLessonSheet.tsx` | `text-micro font-bold` (avatar) | keep |
| `StackedWeekView.tsx` | `text-sm sm:text-lg font-bold` | `text-sm sm:text-lg font-semibold` |
| `RefundDialog.tsx` | `text-2xl font-bold` | `text-2xl font-semibold` |
| `RefundDialog.tsx` | `font-bold text-lg` | `font-semibold text-lg` |
| `InvoicePreview.tsx` | `text-sm font-bold` (logo initial) | keep — decorative |
| `InvoicePreview.tsx` | `text-xs font-bold` (status badge) | `text-xs font-semibold` |
| `InvoiceList.tsx` | `text-base font-bold` | `text-base font-semibold` |
| `BillingRunWizard.tsx` | `text-2xl font-bold` (×3) | `text-2xl font-semibold` |
| `PaymentPlansDashboard.tsx` | `text-2xl font-bold` | `text-2xl font-semibold` |
| `PaymentPlanSetup.tsx` | `font-bold` in table cells (×3) | `font-semibold` |
| `StudentPracticePanel.tsx` | `text-sm font-bold` | `text-body-strong` |
| `PaymentPlanInvoiceCard.tsx` | `text-xl font-bold` | `text-xl font-semibold` |
| `WeeklyProgressCard.tsx` | `text-xs font-bold` | `text-xs font-semibold` |
| `PaymentDrawer.tsx` | `text-3xl font-bold` (×2) | `text-3xl font-semibold` |
| `PracticeTimer.tsx` | `text-6xl font-bold` | `text-6xl font-semibold` |
| `BillingTab.tsx` | `text-4xl font-bold` | `text-4xl font-semibold` |
| `CalendarSyncHealth.tsx` | `text-xl font-bold` (×3) | `text-xl font-semibold` |
| `NotificationBell.tsx` | `text-[9px] font-bold` | keep — badge, decorative |

**Rule**: `font-bold` (700) is reserved for marketing hero text only. All app UI uses `font-semibold` (600) or the design system token classes which already encode the correct weight.

## 2.2 — Heading semantic tokens

The search shows app pages don't use raw `<h2>/<h3>` with custom classes — `PageHeader` handles `<h1>` with `text-page-title`, and section headings use `CardTitle`. Two specific fixes:

- `LessonDetailSidePanel.tsx` line 99: `<h2 className="text-lg font-bold">` → `<h2 className="text-section-title">`
- `MobileLessonSheet.tsx` line 60: `<DrawerTitle className="text-lg font-bold">` → `<DrawerTitle className="text-section-title">`

No other raw heading issues found in app components.

## 2.3 — Form label consistency

The `Label` component already maps to `text-sm font-medium`. The design system token `text-body-strong` is `0.875rem / 600`. These are close but not identical (500 vs 600 weight).

**Decision**: Leave the shadcn `Label` component as-is (it's the standard). The inconsistency is where code uses raw `<Label className="text-sm font-medium">` redundantly or uses `<span className="text-sm font-medium">` instead of `<Label>`. No changes needed to the Label component itself — just ensure all form labels use `<Label>` and don't override its built-in styling with redundant classes.

Specific fixes:
- `ContinuationResponseDetail.tsx`: Remove redundant `className="text-sm font-medium"` from 5 `<Label>` instances (lines 117, 126, 187, 205, 219)
- `RescheduleSlotPicker.tsx`: `<CardTitle className="text-sm font-medium">` (lines 235, 254) → `<CardTitle className="text-body-strong">`

---

## Files touched (27 files)

All calendar, invoice, portal, dashboard, settings, and student component files listed above. Roughly 35 individual `font-bold` → `font-semibold` replacements plus 2 heading token fixes and 7 label cleanups.

