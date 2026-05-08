# LessonLoop Cohesion Audit — World-Class Standard

> The difference between "good app" and "world-class product" is cohesion. Every page must feel like it belongs to the same product. This document defines what "consistent" means and how to find and fix every inconsistency.

---

## How to Use This File

1. **Audit FIRST.** Go through every section, run the search commands, list every inconsistency.
2. **Fix at the component level.** Never patch page-by-page. Fix the shared component once.
3. **Fix shared components first**, then cascade through pages.
4. **Do a final cross-app sweep** after all page work to catch drift.
5. **Check at BOTH 375px and 1280px** for every fix.

---

## 1. Visual Consistency

### Page Layout Structure
Every admin page MUST follow:
```tsx
<AppLayout>
  <PageHeader title="..." description="..." actions={<Button>...</Button>} />
  {/* Filters bar (if applicable) */}
  {/* Stats/summary (if applicable) */}
  {/* Main content */}
</AppLayout>
```
Every portal page MUST follow:
```tsx
<PortalLayout>  {/* auto-handles ChildSwitcher, bottom nav, sidebar */}
  <PageHeader title="..." actions={...} />
  {/* Main content */}
</PortalLayout>
```

**Search for violations:**
```bash
# Pages not using AppLayout or PortalLayout
grep -rL "AppLayout\|PortalLayout\|MarketingLayout" --include="*.tsx" src/pages/ | grep -v marketing | grep -v Index | grep -v NotFound

# Pages not using PageHeader
grep -rL "PageHeader\|DashboardHero" --include="*.tsx" src/pages/ | grep -v marketing | grep -v Index | grep -v NotFound | grep -v Login | grep -v Signup | grep -v Forgot | grep -v Reset | grep -v Verify | grep -v Accept | grep -v Onboarding
```

**Check:**
- Does every admin page use `AppLayout` + `PageHeader`?
- Does every portal page use `PortalLayout` + `PageHeader`?
- Does Dashboard use `DashboardHero` instead of `PageHeader` (this is correct)?
- Are descriptions present on PageHeader where they add value?

### Card Styling
Standard: `rounded-xl border bg-card` with `p-4` or `p-5`
Interactive: add `hover:shadow-card-hover transition-shadow cursor-pointer`

**Search for inconsistencies:**
```bash
# Cards with wrong border radius
grep -rn "rounded-lg" --include="*.tsx" src/components/ src/pages/ | grep -i "card\|Card" | grep -v "ui/card\|rounded-lg sm:rounded-xl"

# Cards with inconsistent padding
grep -rn "CardContent" --include="*.tsx" src/ | grep -v "ui/" | grep -oP 'className="[^"]*p-\d[^"]*"' | sort | uniq -c | sort -rn

# Cards missing hover state when they should be interactive
grep -rn "cursor-pointer" --include="*.tsx" src/ | grep -v "hover:shadow"
```

### Button Variants — Expected Mapping
| Action Type | Expected Variant |
|-------------|-----------------|
| Primary page CTA | default (filled) |
| Save/Confirm in modal | default (filled) |
| Cancel in modal | `outline` |
| Delete/Destructive | `destructive` |
| Secondary action | `outline` |
| Inline row action | `ghost` size `sm` |
| Icon-only | `ghost` size `icon` |
| Link-style | `link` |

**Search for misuse:**
```bash
# Destructive actions not using destructive variant
grep -rn "Delete\|Remove\|delete\|remove" --include="*.tsx" src/ | grep "Button" | grep -v "destructive\|variant" | head -20

# Cancel buttons that aren't outline
grep -rn "Cancel" --include="*.tsx" src/ | grep "Button" | grep -v "outline\|variant" | head -20
```

### Badge / Status Colour Mapping
Must be identical everywhere in the app:

| Concept | Colour |
|---------|--------|
| Active / Paid / Complete / Present | `success` (green) |
| Pending / Draft / Scheduled / Upcoming | `secondary` (muted) |
| Overdue / Failed / Cancelled / Absent | `destructive` (red) |
| Warning / Partial / Late | `warning` (amber) |
| Info / New / Synced | `info` (blue) |
| Inactive / Archived | `outline` or `secondary` |

**Search for inconsistencies:**
```bash
# Find all Badge usage and check variants
grep -rn "<Badge" --include="*.tsx" src/ | grep -v "ui/badge" | grep -oP 'variant="[^"]*"' | sort | uniq -c | sort -rn

# Find status-related strings to verify colour mapping
grep -rn "paid\|overdue\|pending\|draft\|active\|inactive\|cancelled\|completed" --include="*.tsx" src/ | grep -i "badge\|variant\|color\|colour" | head -40
```

### Icon Size Consistency
| Context | Expected Size |
|---------|--------------|
| Inline with body text | `h-3.5 w-3.5` or `h-4 w-4` |
| In buttons | `h-4 w-4` |
| In stat cards | `h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6` |
| Empty states | `h-12 w-12` |
| Navigation | `h-5 w-5` |

**Search for outliers:**
```bash
# Find unusual icon sizes
grep -rn "h-3 w-3\|h-6 w-6\|h-7 w-7\|h-8 w-8\|h-10 w-10" --include="*.tsx" src/ | grep -v "ui/\|LoadingState\|EmptyState\|ErrorBound\|skeleton\|Skeleton" | head -30
```

---

## 2. Interaction Consistency

### "Add New" Pattern
| Page | Expected Pattern |
|------|-----------------|
| Students | Multi-step wizard dialog (`StudentWizard`) |
| Calendar | Modal (`LessonModal`) or `QuickCreatePopover` |
| Invoices | Modal (`CreateInvoiceModal`) |
| Resources | Modal (`UploadResourceModal`) |
| Locations | Dialog |
| Teachers | Dialog |
| Messages | Modal (`ComposeMessageModal`) |
| Settings (members) | Dialog (`InviteMemberDialog`) |

**Check:** Is the "add new" trigger always a `<Button>` in the `PageHeader` actions slot? Does every "add" action use a modal/dialog (not page navigation)?

### Delete Confirmation Pattern
EVERY delete MUST use `DeleteValidationDialog`:
```tsx
const { checkResult, isChecking } = useDeleteValidation(entityType, entityId, open);
<DeleteValidationDialog
  open={open}
  onOpenChange={setOpen}
  entityName={name}
  entityType={type}
  checkResult={checkResult}
  isLoading={isChecking}
  onConfirmDelete={handleDelete}
  isDeleting={isDeleting}
/>
```

**Search for violations:**
```bash
# Delete actions that might bypass DeleteValidationDialog
grep -rn "\.delete(\|onDelete\|handleDelete\|confirmDelete" --include="*.tsx" src/ | grep -v "DeleteValidation\|test/" | head -30
```

### Search & Filter Pattern
Pages with search/filters should all follow:
- Filters bar below `PageHeader`, above content
- Search input on the left
- Filter controls to the right
- Active filter count or indicator
- "Clear" option when filters active

**Existing filter bars:**
- Students: `StatusPills` (custom)
- Invoices: `InvoiceFiltersBar` / `InvoiceFiltersBarWithHelp`
- Calendar: `CalendarFiltersBar` / `CalendarFiltersBarWithHelp`
- Messages: `MessageFiltersBar`

**Check:** Do these all have the same visual structure? Same spacing? Same clear/reset pattern?

### Modal Behaviour at Each Viewport
| Viewport | Dialog Behaviour | AlertDialog Behaviour |
|----------|-----------------|----------------------|
| Desktop | Centred, max-width constrained | Centred, compact |
| Mobile | Full-screen or near-full-screen | Large, easily tappable buttons |

**Check:** Are modals consistent in how they appear on mobile? Some using Sheet, some using Dialog?

---

## 3. Language Consistency

### Terminology — Correct Terms
| ✅ Correct | ❌ Never Use |
|-----------|-------------|
| Lesson | Class, Session (unless specifically group classes) |
| Student | Pupil, Learner |
| Guardian | Parent (in code/data — "Parent Portal" is the product name) |
| Organisation | Organization |
| Teacher | Tutor, Instructor |
| Invoice | Bill |
| Make-up | Makeup, Make up |
| Attendance | The action is "mark attendance"; the page is "Register" |

**Search for violations:**
```bash
# Check for wrong terminology in user-facing strings
grep -rni '"pupil\|"session\|"class\b\|"tutor\|"bill"\|"organization' --include="*.tsx" src/ | grep -v "className\|classList\|classN\|classpath" | head -20

# Check for inconsistent make-up spelling
grep -rni "makeup\|make up" --include="*.tsx" src/ | grep -v "Make-Up\|make-up\|MakeUp\|makeUp" | head -20
```

### Button Labels — Must Be Consistent
| Action | ✅ Label | ❌ Never |
|--------|---------|---------|
| Save changes | "Save" or "Save changes" | "Submit", "Confirm", "Done" |
| Create new | "Create [Thing]" or "Add [Thing]" | "Submit", "Save" |
| Close without saving | "Cancel" | "Close", "Never mind", "Back" |
| Wizard final step | "Done" or "Finish" | "Save", "Submit" |
| Destructive confirm | "Delete [Thing]" | "Remove", "Confirm" |

**Search:**
```bash
# Find all button text
grep -rn ">Submit<\|>Confirm<\|>Done<\|>Close<\|>Never mind<" --include="*.tsx" src/ | grep -v "ui/" | head -20
```

### Toast Messages — Must Follow Pattern
| Event | Title Pattern | Example |
|-------|--------------|---------|
| Success | Past tense | "Student created", "Invoice sent" |
| Error | "Failed to [action]" | "Failed to create student" |
| Validation | Specific issue | "Name is required" |

**Search:**
```bash
# Audit all toast messages for consistency
grep -rn "toast({" --include="*.tsx" --include="*.ts" src/ | grep -v "node_modules\|use-toast" | head -50
```

### Empty State Copy — Must Be Warm & Helpful
- Title: what this section IS (not "No data found")
- Description: how to get started (encouraging)
- CTA: action to create first item

**Search:**
```bash
# Find all EmptyState usage and check copy quality
grep -rn "EmptyState\|InlineEmptyState" --include="*.tsx" src/ | grep -v "shared/EmptyState" | head -30
```

---

## 4. State Consistency

### Loading Skeleton Selection
| Page Type | Required Skeleton |
|-----------|------------------|
| Dashboard | `DashboardSkeleton` |
| Calendar | `CalendarSkeleton` |
| List pages | `ListSkeleton` |
| Detail pages | `DetailSkeleton` |
| Form dialogs | `FormSkeleton` |
| Portal home | `PortalHomeSkeleton` |
| Stat grids | `GridSkeleton` |

**Search for wrong skeleton usage:**
```bash
# Pages using generic LoadingState where a specific skeleton should be used
grep -rn "LoadingState\b" --include="*.tsx" src/pages/ | grep -v "import" | head -20

# Check which pages use which skeleton
grep -rn "Skeleton\|isLoading" --include="*.tsx" src/pages/ | grep -v "import" | head -40
```

### Error Boundary Coverage
- Component-level: `SectionErrorBoundary`
- Portal: `PortalErrorState`
- Full page: `ErrorBoundary`

**Search:**
```bash
# Portal pages that should use PortalErrorState
grep -rL "PortalErrorState" --include="*.tsx" src/pages/portal/

# Pages missing SectionErrorBoundary
grep -rL "SectionErrorBoundary\|ErrorBoundary" --include="*.tsx" src/pages/ | grep -v marketing | head -20
```

### Success Feedback Completeness
After every mutation:
1. ✅ Success toast (brief, past-tense)
2. ✅ UI updates immediately (optimistic or invalidation)
3. ✅ Modal closes (if applicable)

**Search for silent saves:**
```bash
# Mutations without toast on success
grep -rn "mutateAsync\|mutation.mutate" --include="*.tsx" src/ | head -30
# Cross-reference: do those files also call toast?
```

---

## 5. Navigation Consistency

### Sidebar Highlighting
- [ ] Navigate to EVERY page → correct sidebar item highlighted
- [ ] Sub-pages (Student Detail) → "Students" still highlighted
- [ ] Report sub-pages → "Reports" highlighted
- [ ] Settings tabs → "Settings" highlighted
- [ ] Portal: bottom nav highlights correct item on every portal page

### Page Titles
Format: `[Page Name] | LessonLoop` (portal: `[Page] | Parent Portal`)

**Search:**
```bash
# Check usePageMeta usage
grep -rn "usePageMeta" --include="*.tsx" src/pages/ | head -30

# Pages that might be missing it
grep -rL "usePageMeta" --include="*.tsx" src/pages/ | grep -v marketing | grep -v Index | head -20
```

### Back Navigation
- [ ] Every detail/sub-page has clear path back to list
- [ ] Wizard steps have "Back" button
- [ ] Modal close returns to previous state
- [ ] Browser back never traps user
- [ ] No broken history stack

---

## 6. Animation Consistency

### Page Transitions
- Admin pages: `animate-page-enter` via `AppLayout` wrapper
- Portal pages: framer-motion `opacity: 0→1` via `PortalLayout`

**Check:** Are any pages missing the transition? Do any have a DIFFERENT transition?

### Dashboard Uses Framer Motion Stagger
```tsx
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
```

**Check:** Is Dashboard the only page using framer-motion stagger? Should other data-heavy pages match this pattern?

**Inconsistency alert:** `AppLayout` uses CSS `animate-page-enter`, `PortalLayout` uses framer-motion. This is a known intentional difference but verify both work smoothly.

---

## 7. Mobile-Specific Cohesion

### Modal Behaviour on Mobile
- [ ] ALL modals are either full-screen or large bottom-sheet on mobile — no tiny centred dialogs
- [ ] Confirm/Cancel buttons are always reachable
- [ ] Close button (X) is in top-right, large enough to tap

### Touch Targets
```bash
# Find potentially small interactive elements
grep -rn "size=\"sm\"\|size=\"xs\"\|h-6 w-6\|h-5 w-5" --include="*.tsx" src/ | grep "Button\|button\|click\|Click" | head -30
```

### Bottom Nav (Portal)
- [ ] Correct item highlighted on ALL portal pages
- [ ] Badge count shows on Messages tab when unread
- [ ] Safe area inset respected on iOS
- [ ] Active indicator bar visible under current tab

---

## 8. Cross-App Audit Commands

Run these to find inconsistencies system-wide:

```bash
# === VISUAL ===
# Find all card patterns
grep -rn "rounded-xl border\|rounded-lg border\|shadow-card" --include="*.tsx" src/ | grep -v "ui/" | head -40

# Find all font size usage
grep -rn "text-\[" --include="*.tsx" src/ | grep -v "ui/" | head -20

# === INTERACTION ===
# Find all confirmation dialogs
grep -rn "AlertDialog\b" --include="*.tsx" src/ | grep -v "ui/\|import" | head -30

# === LANGUAGE ===
# Find all user-facing text that might be inconsistent
grep -rn "toast({ title:" --include="*.tsx" --include="*.ts" src/ | head -50

# === STATE ===
# Find pages with different loading patterns
grep -rn "isLoading\|isPending" --include="*.tsx" src/pages/ | head -40
```

---

## 9. Cohesion Sprint Order

1. **Shared components** — Fix buttons, cards, badges, empty states, loading states at component level
2. **Layout consistency** — Verify AppLayout/PortalLayout on every page, PageHeader usage
3. **Interaction patterns** — Standardise add/edit/delete flows
4. **Language pass** — Fix terminology, button labels, toast messages, empty state copy
5. **State handling** — Correct skeletons, error boundaries, success feedback everywhere
6. **Animation pass** — Verify transitions, entrance animations, hover effects
7. **Navigation** — Sidebar highlighting, page titles, back navigation, deep links
8. **Mobile cohesion** — Modal behaviour, touch targets, bottom nav, scroll behaviour
9. **Final sweep** — One complete walkthrough of every page at both viewports
