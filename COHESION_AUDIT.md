# LessonLoop Cohesion Audit

> This document defines what "consistent" means across LessonLoop. Use it to find and fix inconsistencies that make the app feel like a collection of pages instead of one product.

## How to Use This File

1. **Audit first.** Go through each section and list every inconsistency you find across the app.
2. **Fix at the component level.** If buttons are inconsistent, fix the pattern in the shared component, not on each page individually.
3. **Fix shared components first**, then cascade through pages.
4. **Do a final pass** after all page-level work to catch drift.

---

## Visual Consistency

### Page Layout Structure
Every admin page should follow this exact structure:
```
<AppLayout>
  <PageHeader title="..." description="..." actions={...} />
  {/* Optional: filters bar */}
  {/* Optional: stats/summary section */}
  {/* Main content */}
</AppLayout>
```
Every portal page should follow:
```
<PortalLayout>
  <PageHeader title="..." actions={...} />
  {/* Main content */}
</PortalLayout>
```

**Check:** Do ALL pages follow this? Or do some have custom headers, missing descriptions, or different padding?

### Card Styling
The standard card pattern is: `rounded-xl border bg-card p-4` (or `p-5` for more spacious cards).

**Check across every page:**
- Are any cards using `rounded-lg` instead of `rounded-xl`?
- Are any cards missing the `border`?
- Are any cards using `p-3` or `p-6` inconsistently?
- Do interactive cards all have `hover:shadow-card-hover transition-shadow`?
- Are stat cards all using the same `StatCard` component or are some hand-rolled?

### Button Patterns
| Action Type | Expected Pattern |
|-------------|-----------------|
| Primary page action (top right of PageHeader) | `<Button>` with icon + text |
| Save / Confirm in modal | `<Button>` (primary, right-aligned) |
| Cancel in modal | `<Button variant="outline">` (left of primary) |
| Delete / Destructive | `<Button variant="destructive">` |
| Secondary page action | `<Button variant="outline">` |
| Inline row action | `<Button variant="ghost" size="sm">` or DropdownMenu |
| Icon-only action | `<Button variant="ghost" size="icon">` |

**Check:** Are these patterns consistent on every page? Or are some pages using different variants for the same action type?

### Badge / Status Indicators
Badges should use consistent colour mapping across the entire app:

| Status Concept | Badge Variant / Colour |
|---------------|----------------------|
| Active / Paid / Complete / Online | `success` / green |
| Pending / Draft / Scheduled | `secondary` / muted |
| Overdue / Failed / Cancelled | `destructive` / red |
| Warning / Partial / Approaching | `warning` / amber |
| Info / New / Synced | `info` / blue |

**Check:** Are invoice status badges, attendance status badges, student status badges, and lesson status badges ALL using the same colour mapping? Or does "pending" mean green on one page and grey on another?

### Icon Usage
- Icons should always be from `lucide-react`
- Icons inline with text: `h-4 w-4`
- Icons in buttons: `h-4 w-4` with `mr-2` or `ml-2` spacing
- Icons in empty states: `h-12 w-12 text-muted-foreground/30`
- Standalone decorative icons: `h-5 w-5 text-muted-foreground`

**Check:** Are icon sizes consistent? Are any pages using `h-3 w-3` or `h-6 w-6` where others use `h-4 w-4`?

---

## Interaction Consistency

### "Add New" Pattern
How does "Add New [Thing]" work across the app?

| Page | Current Pattern | Should Be |
|------|----------------|-----------|
| Students | `StudentWizard` (multi-step dialog) | Dialog/wizard ✓ |
| Calendar | `LessonModal` / `QuickCreatePopover` | Modal ✓ |
| Invoices | `CreateInvoiceModal` | Modal ✓ |
| Resources | `UploadResourceModal` | Modal ✓ |
| Locations | Inline dialog | Should match the modal pattern |
| Teachers | ? | Should match |
| Messages | `ComposeMessageModal` | Modal ✓ |

**Check:** Is the "add new" pattern (modal vs inline vs page navigation) consistent? Users should always know what happens when they click an "Add" button.

### Delete Confirmation Pattern
Every destructive action should use `DeleteValidationDialog` which:
1. Checks dependencies via `useDeleteValidation`
2. Shows blocks if deletion is unsafe
3. Shows warnings if deletion has side effects
4. Requires explicit confirmation

**Check:** Are ALL delete actions across the app using this pattern? Or are some using basic `AlertDialog` without dependency checking?

### Search & Filter Pattern
Pages with search/filter should follow a consistent layout:
- Filters bar below `PageHeader`, above content
- Search input on the left
- Filter dropdowns / pills to the right
- Active filter count visible
- "Clear all" available when filters are active

**Check against:** Students (has `StatusPills`), Invoices (has `InvoiceFiltersBar`), Calendar (has `CalendarFiltersBar`), Messages (has `MessageFiltersBar`), Resources. Are these all structured the same way?

### Table / List Pattern
Data lists should be consistent:
- Table on desktop, card list on mobile (or horizontal scroll)
- Sortable columns use `SortableTableHead` component
- Pagination uses `ReportPagination` component (or React Query infinite scroll)
- Row actions in a `DropdownMenu` with `MoreHorizontal` trigger
- Bulk selection with checkboxes where applicable

**Check:** Do all list views (students, invoices, messages, resources, reports) follow the same pattern?

### Modal / Dialog Pattern
- **Content forms** → `Dialog` (shadcn)
- **Confirmations** → `AlertDialog` (shadcn)
- **Mobile side panels** → `Sheet` (only where specifically needed)
- **LoopAssist** → `Drawer` (unique pattern, only for AI assistant)

**Check:** Are any pages using `Dialog` where `AlertDialog` should be used (for confirmations), or vice versa?

---

## Language Consistency

### Terminology
The following terms must be used consistently everywhere:

| Correct Term | Never Use |
|-------------|-----------|
| Lesson | Class, Session (unless specifically referring to group classes) |
| Student | Pupil, Learner |
| Guardian | Parent (in code/data — "Parent Portal" is the product name) |
| Organisation | Organization (British English) |
| Teacher | Tutor, Instructor |
| Invoice | Bill |
| Make-up | Makeup, Make up |
| Attendance | Register (the page is "Register" but the action is "mark attendance") |

**Check:** Search the entire codebase for incorrect terminology in user-facing strings (toast messages, labels, headings, descriptions, empty states, error messages).

### Button Labels
| Action | Correct Label | Never Use |
|--------|--------------|-----------|
| Save changes | "Save" or "Save changes" | "Submit", "Confirm", "Done" (unless in a wizard) |
| Create new | "Create [Thing]" or "Add [Thing]" | "Submit", "Save" |
| Close without saving | "Cancel" | "Close", "Never mind", "Back" (unless in a wizard) |
| Final wizard step | "Done" or "Finish" | "Save", "Submit" |
| Destructive confirm | "Delete [Thing]" | "Remove", "Confirm" |

**Check:** Are button labels consistent across every modal and form in the app?

### Toast Messages
| Event | Title Pattern | Example |
|-------|--------------|---------|
| Success | Past tense statement | "Student created", "Invoice sent", "Settings saved" |
| Error | "Failed to [action]" | "Failed to create student", "Failed to send invoice" |
| Validation | Specific issue | "Name is required", "Invalid email format" |
| Warning | Present tense | "Some invoices could not be sent" |

**Check:** Do all toast messages follow these patterns? Search for `toast({` across the codebase.

### Empty State Copy
All empty states should follow this tone:
- **Title:** What this section is for (not "No data found")
- **Description:** How to get started (encouraging, not technical)
- **CTA:** Action to create the first item

Good: "No students yet" / "Add your first student to start managing lessons" / [Add Student]
Bad: "No data" / "Nothing to show" / "Empty"

**Check:** Review every `EmptyState` usage for tone and helpfulness.

---

## State Consistency

### Loading States
Every page must use the correct skeleton variant:

| Page Type | Skeleton Component |
|-----------|-------------------|
| Dashboard | `DashboardSkeleton` |
| Calendar | `CalendarSkeleton` |
| List pages (students, invoices, etc.) | `ListSkeleton` |
| Detail pages (student detail, invoice detail) | `DetailSkeleton` |
| Form dialogs | `FormSkeleton` |
| Portal home | `PortalHomeSkeleton` |
| Stat card grids | `GridSkeleton` |

**Check:** Are any pages using `LoadingState` (spinner) where a skeleton would be more appropriate? Are any pages using a generic skeleton where a specific one exists?

### Error States
- Component-level errors → `SectionErrorBoundary` (prevents whole page crash)
- Portal errors → `PortalErrorState` component
- Full-page errors → `ErrorBoundary` component
- API errors → Toast notification

**Check:** Are all pages wrapped in error boundaries? Are portal pages using `PortalErrorState` consistently?

### Success Feedback
After every successful mutation, the user should receive:
1. A success toast (brief, past-tense)
2. The UI updates immediately (optimistic or query invalidation)
3. The modal closes (if applicable)

**Check:** Are there any "save" actions that succeed silently with no feedback?

---

## Navigation Consistency

### Sidebar Highlighting
The sidebar should highlight the current page accurately.

**Check:** Navigate to every page and verify the correct sidebar item is highlighted. Watch for:
- Sub-pages (e.g., Student Detail) — should "Students" still be highlighted?
- Report sub-pages — should "Reports" be highlighted?
- Settings tabs — should "Settings" be highlighted regardless of tab?

### Page Titles
Every page should set its document title via `usePageMeta`:
- Format: `[Page Name] | LessonLoop`
- Portal pages: `[Page Name] | Parent Portal`

**Check:** Navigate to every page and verify the browser tab title is correct.

### Back Navigation
- Detail pages should have a clear way to go back to the list
- Wizard steps should have a "Back" button
- Modal close should return to the previous state
- Browser back button should never trap the user or cause errors

**Check:** On every detail/sub-page, is there a clear path back?

---

## Cross-App Patterns to Audit

Run these searches across the codebase to find inconsistencies:

```bash
# Find all toast messages and check consistency
grep -rn 'toast({' --include="*.tsx" --include="*.ts" src/

# Find all empty states and check copy quality  
grep -rn 'EmptyState\|InlineEmptyState' --include="*.tsx" src/

# Find all loading patterns
grep -rn 'isLoading\|isPending\|LoadingState\|Skeleton' --include="*.tsx" src/pages/

# Find all delete actions and check they use DeleteValidationDialog
grep -rn 'delete\|Delete\|remove\|Remove' --include="*.tsx" src/pages/ src/components/

# Find all button labels
grep -rn '<Button' --include="*.tsx" src/ | grep -v 'ui/button'

# Find inconsistent terminology
grep -rni 'pupil\|session\|class\b' --include="*.tsx" src/ | grep -v 'className\|classList'
```

---

## The Cohesion Sprint Order

1. **Shared components** — Fix buttons, cards, badges, empty states, loading states at the component level
2. **Layout consistency** — Ensure every page uses the correct layout wrapper and PageHeader
3. **Interaction patterns** — Standardise add/edit/delete flows across all pages
4. **Language pass** — Fix all terminology, button labels, toast messages, empty state copy
5. **State handling pass** — Ensure correct skeletons, error boundaries, and success feedback everywhere
6. **Navigation pass** — Verify sidebar, titles, back navigation, deep links
7. **Final sweep** — One more look at every page to catch anything that drifted
