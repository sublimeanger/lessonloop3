
# Systematic iOS/Mobile Polish — Complete Overlay Audit & Fix

## Inventory Summary

**53 files** import Dialog, **38 files** import AlertDialog, **11 files** import Sheet, **10 files** import Drawer, **19 files** import Popover, **9 files** import DropdownMenu. Rather than patching 80+ individual components, the most impactful and maintainable approach is to fix the **6 base UI primitives** so every consumer inherits the improvements automatically, then do a targeted pass on the ~28 high-traffic components.

---

## Phase 1: Base Component Global Fixes

### 1A. `dialog.tsx` — DialogContent
**Current issues:**
- No `pb-safe` for iOS home indicator
- Close button uses `DialogPrimitive.Close` which can fail on iOS Capacitor
- `AlertDialogAction` / `AlertDialogCancel` have no min-height for touch targets

**Fixes:**
- Add `pb-safe` to DialogContent base class
- Keep close button as `DialogPrimitive.Close` (works fine — it's Sheet that has the bug), but ensure min-h-11 min-w-11 is present (already is ✓)
- Already has `max-h-[85vh] overflow-y-auto` ✓
- Already has `left-4 right-4` mobile insets ✓
- Already has `rounded-xl` ✓

### 1B. `alert-dialog.tsx` — AlertDialogContent
**Current issues:**
- No `pb-safe` padding
- No `max-h` or `overflow-y-auto` — long content could extend off-screen
- No `rounded-xl` on mobile (only `sm:rounded-xl`)
- `AlertDialogAction` and `AlertDialogCancel` have no mobile min-height
- Uses `left-[50%]` centering which can clip on very small screens

**Fixes:**
- Add `rounded-xl max-h-[85vh] overflow-y-auto pb-safe mx-4 sm:mx-0` to AlertDialogContent
- Change positioning to `left-4 right-4 sm:left-[50%] sm:right-auto sm:w-full` (match Dialog approach)
- Add `min-h-11 sm:min-h-9` to both AlertDialogAction and AlertDialogCancel

### 1C. `sheet.tsx` — SheetContent
**Current issues:**
- Right-side sheets have no `pb-safe` — footer content hidden behind home indicator
- No `max-h` on right-side sheets — content can extend behind keyboard
- Close button: already supports `onClose` prop for direct onClick ✓, min-h-11 ✓

**Fixes:**
- Add `pb-safe` to the base `sheetVariants` class
- Add `max-h-screen overflow-y-auto` to right/left variants
- Add `-webkit-overflow-scrolling: touch` via utility class

### 1D. `drawer.tsx` — DrawerContent
**Current issues:**
- No `pb-safe` — content behind home indicator on iOS
- No `max-h` constraint — drawer can grow too tall

**Fixes:**
- Add `pb-safe max-h-[92vh]` to DrawerContent base class
- DrawerFooter: add `pb-safe` as well (for sticky footers)

### 1E. `dropdown-menu.tsx` — DropdownMenuItem
**Current issues:**
- `py-1.5` = ~24px height, well below 44px touch target on mobile
- Same for CheckboxItem, RadioItem, SubTrigger

**Fixes:**
- Change DropdownMenuItem to `min-h-11 sm:min-h-auto py-2 sm:py-1.5` (44px on mobile, compact on desktop)
- Same for CheckboxItem, RadioItem, SubTrigger

### 1F. `select.tsx` — SelectItem
**Current issues:**
- `py-1.5` = ~24px, below 44px touch target

**Fixes:**
- Add `min-h-11 sm:min-h-auto py-2 sm:py-1.5` to SelectItem

### 1G. `popover.tsx` — PopoverContent
- Already portals correctly ✓
- No safe-area issues (popovers are floating, not bottom-anchored) ✓
- No changes needed

### 1H. `toast.tsx` — Already correct
- z-[9000] ✓
- Safe area insets on viewport ✓
- Swipe dismiss built into Radix ✓
- Close button min-h-11 on mobile ✓
- No changes needed

### 1I. `command.tsx` — CommandItem
- Check if items have sufficient touch target height (currently `py-3` in CommandDialog which is decent)
- CommandInput `h-11` ✓
- No critical changes needed

---

## Phase 2: High-Traffic Component Pass

For each of the 28 listed components, fix only what the base fixes don't cover:

### Group A: Dialog/Drawer hybrid components (use isMobile pattern)
These already have drawer on mobile, dialog on desktop. Main fixes needed:
- **DrawerFooter**: ensure `pb-safe` (handled by Phase 1D base fix)
- **Button min-h**: ensure all footer buttons have `min-h-[44px]`

Components: LessonModal, BookTrialModal, CreateLeadModal, ConvertLeadWizard, OfferSlotDialog, AddToWaitlistDialog, WaitlistEntryDetail, RefundDialog, PaymentDrawer

### Group B: Dialog-only components (no mobile drawer)
These need mobile safe-area from base fix. Specific checks:
- Form layouts: ensure `grid-cols-1` on mobile
- Submit buttons: `min-h-[44px]` and full-width on mobile

Components: CreateInvoiceModal (already fixed ✓), RecordPaymentModal, BulkEditDialog, SlotGeneratorWizard, TermAdjustmentWizard, InviteMemberDialog, ComposeMessageModal, InternalComposeModal, UploadResourceModal, ResourcePreviewModal, IssueCreditModal, ManageCategoriesModal, SendInvoiceModal, RecurringActionDialog

### Group C: Sheet components
Base fix adds pb-safe. Specific checks:
- LessonDetailPanel: long content scrollable ✓
- TeacherQuickView: scroll, close button
- LoopAssistDrawer: already fixed with pb-safe ✓
- ParentLoopAssist: same pattern ✓
- PaymentPlanSetup: check footer
- StudentSelector: check nested scroll
- ContinuationResponseDetail: check footer

### Group D: AlertDialog components (confirmation dialogs)
Base fix adds rounded-xl, max-h, overflow, mobile-safe positioning, button min-height.
Components across: DeleteValidationDialog, void/archive confirms in Students, Teachers, Invoices, InvoiceDetail, Continuation, Settings tabs

### Group E: Popovers / Datepickers
- All Calendar popovers use Radix Portal ✓
- Filter popovers (MessageFiltersBar, BatchAttendance): check touch targets on filter buttons
- EntityLink popovers: check z-index
- StudentNotesPopover: already uses Sheet on mobile ✓
- AbsenceReasonPicker: already uses Sheet on mobile ✓

### Group F: Dropdown menus
- Base fix handles touch targets on items
- 9 files use DropdownMenu — all inherit from base

---

## Phase 3: Specific Component Fixes

Beyond the base fixes, these components need individual attention:

1. **RecordPaymentModal** — Dialog-only, no drawer for mobile. Add `min-h-[44px]` to submit button.

2. **BulkEditDialog** — Dialog-only. Ensure selects stack `grid-cols-1` on mobile (currently uses `space-y-4` which is fine).

3. **SlotGeneratorWizard** — Multi-step dialog. Ensure step navigation buttons have `min-h-[44px]`, date pickers work inside dialog on iOS.

4. **DeleteValidationDialog** — Uses AlertDialog. `p-0` on content means base padding won't apply. Add explicit `p-4 sm:p-6` and ensure footer buttons have `min-h-[44px]`.

5. **LoopAssistDrawer / ParentLoopAssist** — Sheets with input at bottom. Already handle keyboard via ref scrolling. Verify `pb-safe` on input container.

6. **LessonDetailPanel** — Sheet with lots of content. Ensure scroll container has `-webkit-overflow-scrolling: touch`.

---

## Technical Details

### Files to edit:

| File | Changes |
|------|---------|
| `src/components/ui/alert-dialog.tsx` | Mobile positioning, max-h, overflow, rounded-xl, pb-safe, button min-h |
| `src/components/ui/sheet.tsx` | Add pb-safe to base, max-h + overflow on side sheets |
| `src/components/ui/drawer.tsx` | Add pb-safe + max-h to DrawerContent, pb-safe to DrawerFooter |
| `src/components/ui/dropdown-menu.tsx` | min-h-11 on mobile for MenuItem, CheckboxItem, RadioItem, SubTrigger |
| `src/components/ui/select.tsx` | min-h-11 on mobile for SelectItem |
| `src/components/ui/dialog.tsx` | Add pb-safe to DialogContent |
| `src/components/shared/DeleteValidationDialog.tsx` | Fix p-0 override, add explicit padding, button sizing |
| `src/components/invoices/RecordPaymentModal.tsx` | Button min-h |
| `src/components/invoices/BulkEditDialog.tsx` | Button min-h |
| `src/components/calendar/SlotGeneratorWizard.tsx` | Button min-h |
| `src/components/settings/InviteMemberDialog.tsx` | Button min-h |
| `src/components/messages/ComposeMessageModal.tsx` | Button min-h |
| `src/components/messages/InternalComposeModal.tsx` | Button min-h |
| `src/components/students/IssueCreditModal.tsx` | Button min-h |
| `src/components/resources/ManageCategoriesModal.tsx` | Button min-h |
| `src/components/invoices/SendInvoiceModal.tsx` | Button min-h |
| `src/components/calendar/RecurringActionDialog.tsx` | Button min-h |
| Any other dialog with footer buttons missing min-h-[44px] |

### What's already correct (no changes needed):
- Toast system (z-index, safe areas, swipe dismiss)
- Popover component (portals correctly, floating)
- Command/Combobox (adequate touch targets)
- Dialog close button (min-h-11 ✓)
- Sheet close button (min-h-11 ✓)
- LessonModal footer buttons (min-h-[44px] ✓)
- CreateInvoiceModal (already patched with pt-safe pb-safe ✓)
- LoopAssistDrawer (already has pb-safe ✓)
- StudentNotesPopover (Sheet on mobile ✓)
- AbsenceReasonPicker (Sheet on mobile ✓)

### Approach:
1. Fix the 6 base UI components first — this instantly improves ~80+ consumers
2. Targeted pass on the ~15 components that need individual button/layout fixes
3. No new files needed — all edits to existing files
