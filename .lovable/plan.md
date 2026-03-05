# UI Polish — Part 4: Mobile Responsiveness  
  
This is a clean, well-scoped plan. Lovable's done the homework — verified what's already correct, identified exactly what needs changing, and kept it tight. A few notes:

**The dialog fix (4.6) is the most impactful single change.** `max-h-[85vh] overflow-y-auto` on DialogContent prevents every modal in the app from pushing submit buttons below the fold on mobile. That one line fixes a class of issues across all dialogs.

**One thing to flag:** The dialog close button fix says `min-h-11 min-w-11 sm:min-h-auto sm:min-w-auto`. The `sm:min-h-auto` will reset to `auto` which is essentially removing the constraint — check that the close button doesn't shrink too small on tablets. `sm:min-h-9 sm:min-w-9` is safer.

**QuickCreatePopover skip is correct** — desktop-only popovers don't need mobile touch targets.

**MessageFiltersBar toggle items (4.1) skip is correct** — they're inside a grouped container that's already 36px tall.

Green light. Tell Lovable to proceed, then run the E2E suite after to check for regressions — touch target changes can accidentally shift layouts.

## Scope

App components only. Focus on touch targets, mobile button visibility, table responsiveness, dialog sizing, and safe area handling.

---

## 4.1 — Touch targets below 44px

Many `size="sm"` buttons use `h-7` (28px) or `h-8` (32px) without mobile-safe overrides. The pattern `min-h-11 sm:min-h-9` already exists in ~23 files but is missing from others.

**Files needing `min-h-11 sm:min-h-9` added to their buttons:**


| File                                    | Element                           | Current                                          |
| --------------------------------------- | --------------------------------- | ------------------------------------------------ |
| `CalendarMobileLayout.tsx` line 77      | "Today" button                    | `h-8` → add `min-h-11 sm:min-h-9`                |
| `CreateLeadModal.tsx` line 245          | "Add Child" button                | `h-7` → `min-h-11 sm:min-h-9`                    |
| `InvoiceSettingsTab.tsx` line 202       | Reminder day buttons              | `h-7` → `min-h-11 sm:min-h-9`                    |
| `LeadTimeline.tsx` lines 176, 186       | "Cancel"/"Submit" note buttons    | `h-7` → `min-h-11 sm:min-h-9`                    |
| `LessonDetailPanel.tsx` line 599        | Zoom sync button                  | `h-7` → `min-h-11 sm:min-h-9`                    |
| `MusicSettingsTab.tsx` lines 254, 257   | Save/Cancel edit buttons          | `h-8` → `min-h-11 sm:min-h-9`                    |
| `MessageFiltersBar.tsx` lines 229, 232  | Email/In-App toggle items         | `h-7` → already inside a `h-9` group, acceptable |
| `ParentLoopAssist.tsx` line 176         | Retry button                      | `h-7` → `min-h-11 sm:min-h-9`                    |
| `QuickCreatePopover.tsx` lines 206, 285 | "More details" and duration pills | `h-6`/`h-7` — desktop-only popover, skip         |
| `AbsenceReasonPicker.tsx` line 136      | Date picker button                | `h-8` → `min-h-11 sm:min-h-9`                    |
| `TeacherAvailabilityTab.tsx` line 279   | Delete availability button        | `h-7 w-7` → `h-11 w-11 sm:h-7 sm:w-7`            |
| `MessageFiltersBar.tsx` line 283        | "Clear all" button                | `h-8` → `min-h-11 sm:min-h-9`                    |
| `RecurringBillingTab.tsx` line 199      | "New Template" button             | no height override, needs `min-h-11 sm:min-h-9`  |


**Dialog close button**: The `X` close button in `dialog.tsx` line 45 has no size constraint — it's an inline element. Add `min-h-11 min-w-11 sm:min-h-auto sm:min-w-auto flex items-center justify-center` to ensure the touch target is adequate on mobile.

~15 files, ~20 individual button fixes.

## 4.2 — Button text hidden on mobile with no icon fallback


| File                                   | Issue                                                           | Fix                                                                               |
| -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `PortalMessages.tsx` line 288          | `hidden sm:inline-flex` — entire button disappears on mobile    | Change to icon-only on mobile: show `<Plus>` icon always, text `hidden sm:inline` |
| `RecurringBillingTab.tsx` line 201     | `hidden sm:inline` on "New Template" — `<Plus>` icon is visible | Already correct, no fix needed                                                    |
| All other `hidden sm:inline` instances | Verified — all have visible icons                               | No fixes needed                                                                   |


Only 1 fix: `PortalMessages.tsx` — change the button from `hidden sm:inline-flex` to always show the icon, with text hidden on mobile.

## 4.3 — Mobile bottom nav for web users

Current: `showBottomNav = isMobile && platform.isNative` — web mobile users rely on hamburger sidebar.

**Decision**: Keep current behavior (hamburger sidebar for web). The hamburger button is in the Header and is always visible. No breadcrumb overflow issue — `AutoBreadcrumbs` truncates gracefully. Mark as "no change needed" for MVP.

## 4.4 — Table layouts at mobile viewport

- **Invoice list**: Already uses card layout on mobile (verified — `MobileInvoiceCard` renders below `sm`). Desktop table only renders at `sm+`. Correct.
- **Teacher list**: Need to verify.
- **Leads list**: Kanban view on all viewports, cards are responsive. Correct.

Check teacher list for table usage.

## 4.5 — Calendar mobile view

Already handled well:

- Day view renders correctly (verified `CalendarMobileLayout`)
- Nav arrows are 44px (`h-11 w-11`)
- FAB button positioned with safe-area offset
- Mobile forces day view (no week grid at mobile)

**One fix**: The "Today" button at line 77 needs touch-target upgrade (covered in 4.1).

## 4.6 — Dialog/sheet sizing on mobile

The `DialogContent` in `dialog.tsx` already uses `left-4 right-4` positioning on mobile, which gives 16px margins. At `sm+` it centers with `left-[50%] translate-x-[-50%]`.

**Fixes needed:**

1. Add `max-h-[85vh] overflow-y-auto` to `DialogContent` to prevent content from pushing below the fold on small screens
2. The close button `X` needs a larger touch target (covered in 4.1)

## 4.7 — Safe area handling

Already well-handled:

- `StaffBottomNav`: `pb-[env(safe-area-inset-bottom)]` ✓
- `PortalBottomNav`: `pb-[env(safe-area-inset-bottom)]` ✓
- `OnboardingLayout`: `pb-[env(safe-area-inset-bottom,24px)]` ✓
- Calendar FAB: `calc(5rem + env(safe-area-inset-bottom, 0px))` ✓
- Teacher FAB: same pattern ✓
- CSS variables defined in `index.css` ✓

**No changes needed.**

---

## Summary of changes


| File                                                 | Change                                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/components/ui/dialog.tsx`                       | Add `max-h-[85vh] overflow-y-auto` to content; enlarge close button touch target on mobile |
| `src/components/calendar/CalendarMobileLayout.tsx`   | "Today" button: add `min-h-11 sm:min-h-9`                                                  |
| `src/components/leads/CreateLeadModal.tsx`           | "Add Child" button: `h-7` → `min-h-11 sm:min-h-9`                                          |
| `src/components/settings/InvoiceSettingsTab.tsx`     | Reminder buttons: `h-7` → `min-h-11 sm:min-h-9`                                            |
| `src/components/leads/LeadTimeline.tsx`              | Note buttons: `h-7` → `min-h-11 sm:min-h-9`                                                |
| `src/components/calendar/LessonDetailPanel.tsx`      | Zoom button: `h-7` → `min-h-11 sm:min-h-9`                                                 |
| `src/components/settings/MusicSettingsTab.tsx`       | Save/Cancel buttons: `h-8` → `min-h-11 sm:min-h-9`                                         |
| `src/components/parent-portal/ParentLoopAssist.tsx`  | Retry button: `h-7` → `min-h-11 sm:min-h-9`                                                |
| `src/components/register/AbsenceReasonPicker.tsx`    | Date button: `h-8` → `min-h-11 sm:min-h-9`                                                 |
| `src/components/settings/TeacherAvailabilityTab.tsx` | Delete button: add mobile size override                                                    |
| `src/components/messages/MessageFiltersBar.tsx`      | "Clear all": `h-8` → `min-h-11 sm:min-h-9`                                                 |
| `src/components/settings/RecurringBillingTab.tsx`    | "New Template": add `min-h-11 sm:min-h-9`                                                  |
| `src/pages/portal/PortalMessages.tsx`                | Fix disappearing "New Message" button on mobile                                            |


14 files, ~20 touch target fixes + 1 dialog enhancement + 1 button visibility fix.