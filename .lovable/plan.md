

## Global Foundation — Layout, Typography, Spacing Polish

This is a cosmetic-only pass. No functional changes. The work touches ~20 files across pages and components.

### Already Correct (No Changes Needed)
- **AppLayout.tsx** main padding: already `px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6`
- **PageHeader.tsx**: already `mb-5 sm:mb-6` with `text-page-title tracking-tight`
- **PortalLayout.tsx**: already uses `max-w-4xl` on desktop, staff pages use full width
- **Selection highlight**: already in `index.css` with teal HSL
- **Typography tokens**: already defined in `tailwind.config.ts`

### 1. Replace `font-bold` with `font-semibold` in page stat values

**Files:** `src/pages/Practice.tsx`, `src/pages/DailyRegister.tsx`, `src/pages/Continuation.tsx`, `src/pages/InvoiceDetail.tsx`

Change `text-2xl font-bold` → `text-2xl font-semibold` on stat card values (e.g. active assignments count, lesson counts). Also change `text-3xl font-bold` → `text-3xl font-semibold` on invoice totals.

**Exceptions (keep `font-bold`):**
- Marketing pages (`src/components/marketing/**`) — hero headings are allowed per design brief
- `NotFound.tsx` — decorative "404" text
- `StaffBottomNav.tsx` — notification badge (9px decorative)
- `StreakBadge.tsx` — decorative gamification element
- `ResetPassword.tsx` — "Reset link expired" heading (uses font-bold but should be font-semibold)
- `Index.tsx` — placeholder page, change to font-semibold

### 2. Replace `shadow-sm` / `shadow-md` with brand tokens

**Mapping:**
- `shadow-sm` → `shadow-card` (static card/element resting state)
- `shadow-md` → `shadow-card-hover` (hover/elevated state)
- `hover:shadow-md` → `hover:shadow-card-hover`

**Files to update (~6 page files, ~4 component files):**
- `Students.tsx`: card `shadow-sm` → `shadow-card`, `hover:shadow-md` → `hover:shadow-card-hover`
- `Teachers.tsx`: same pattern on teacher cards
- `Locations.tsx`: location cards
- `Messages.tsx`: search input `shadow-sm` → `shadow-card`
- `StudentsImport.tsx`: step indicator shadows
- `BatchAttendance.tsx`: saving overlay
- `OnboardingLayout.tsx`: header `shadow-sm` → `shadow-card`
- `RecurringBillingTab.tsx`: template card
- `ResourceCard.tsx`: `hover:shadow-md` → `hover:shadow-card-hover`
- `FirstRunExperience.tsx`: CTA button `shadow-md` → `shadow-card-hover`

**Leave unchanged:** UI primitives (`popover.tsx`, `tooltip.tsx`) — these use shadow-md as part of the Radix pattern and shouldn't be overridden. Tab pill `shadow-sm` states (Students, Locations, Teachers, Messages, Invoices filter pills) — these are subtle active-state indicators, `shadow-card` works fine here.

### 3. Replace `rounded-lg` with `rounded-xl` (containers) or `rounded-md` (interactive)

**Containers → `rounded-xl`:**
- `Continuation.tsx`: past run items `rounded-lg` → `rounded-xl`
- `Teachers.tsx`: self-add banner, filter bar wrapper, radio label items
- `Leads.tsx`: view toggle wrapper
- `LeadDetail.tsx`: student cards, follow-up items
- `InvoiceDetail.tsx`: credit note banner
- `Reports.tsx`: icon containers `rounded-lg` → `rounded-xl`
- `NotesExplorer.tsx`: skeleton placeholders
- `BookingPageTab.tsx`: URL display, teacher/instrument labels, embed snippet
- `BillingTab.tsx`: plan display, usage stat boxes, billing toggle
- `WaitlistEntryDetail.tsx`: offer box
- `PaymentMethodsCard.tsx`: card wrapper
- `LeadTimeline.tsx`: note input wrapper

**Keep `rounded-lg`:** Tailwind config `borderRadius.lg` is set to `var(--radius)` = `0.625rem` which is the design system value. The actual `rounded-lg` in Tailwind maps to this already. However, the design brief says containers should be `rounded-xl`. So we update container uses but leave `sm:rounded-lg` on dialog content (Teachers.tsx dialogs) since those are modal containers that should become `sm:rounded-xl`.

### 4. Section spacing normalization

**Pages with `space-y-4` between major sections** → change to `space-y-6`:
- `Settings.tsx` line 48: availability wrapper `space-y-4` → `space-y-6`
- `Invoices.tsx`: tabs and content `space-y-4` → `space-y-6`
- `Practice.tsx`: progress sections

**Keep `space-y-4`:** Inside forms (`ForgotPassword`, `Login`, `AcceptInvite`, `Teachers` form fields, `Locations` dialogs) — these are form-internal spacing and `space-y-4` is correct for form fields.

**`space-y-8`** in Settings billing tab is already correct for separating major sections.

### 5. Card padding standardization

Stat cards should use `p-3 sm:p-4`. Check:
- `DailyRegister.tsx` stat cards — verify padding
- `MakeUpStatsCards.tsx` — already `p-3 sm:p-4` ✓
- `Continuation.tsx` stat cards — verify and standardize

### Summary of Files Changed

| File | Changes |
|------|---------|
| `Practice.tsx` | `font-bold` → `font-semibold`, section spacing |
| `DailyRegister.tsx` | `font-bold` → `font-semibold` |
| `Continuation.tsx` | `font-bold` → `font-semibold`, `rounded-lg` → `rounded-xl` |
| `InvoiceDetail.tsx` | `font-bold` → `font-semibold`, `rounded-lg` → `rounded-xl` |
| `Index.tsx` | `font-bold` → `font-semibold` |
| `ResetPassword.tsx` | `font-bold` → `font-semibold` |
| `Students.tsx` | `shadow-sm/md` → brand tokens |
| `Teachers.tsx` | shadows, `rounded-lg` → `rounded-xl` |
| `Locations.tsx` | shadows |
| `Messages.tsx` | shadows |
| `StudentsImport.tsx` | shadows |
| `BatchAttendance.tsx` | shadows |
| `Invoices.tsx` | section spacing |
| `Settings.tsx` | section spacing |
| `Leads.tsx` | `rounded-lg` → `rounded-xl` |
| `LeadDetail.tsx` | `rounded-lg` → `rounded-xl` |
| `Reports.tsx` | `rounded-lg` → `rounded-xl` |
| `NotesExplorer.tsx` | `rounded-lg` → `rounded-xl` |
| `OnboardingLayout.tsx` | shadow |
| `RecurringBillingTab.tsx` | shadow |
| `ResourceCard.tsx` | shadow |
| `FirstRunExperience.tsx` | shadow |
| `BookingPageTab.tsx` | `rounded-lg` → `rounded-xl` |
| `BillingTab.tsx` | `rounded-lg` → `rounded-xl` |
| `WaitlistEntryDetail.tsx` | `rounded-lg` → `rounded-xl` |
| `PaymentMethodsCard.tsx` | `rounded-lg` → `rounded-xl` |
| `LeadTimeline.tsx` | `rounded-lg` → `rounded-xl` |

~27 files, all CSS-class-only changes. Zero functional impact.

