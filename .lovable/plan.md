
# Complete UI/UX Polish Audit - Desktop & Mobile

## Executive Summary

This audit covers the marketing site (Home, Features, Pricing, About, Contact, legal pages), and the application (Dashboard, Calendar, Students, Invoices, Reports, Settings, Portal). The codebase has a strong design foundation with consistent use of Tailwind CSS and shadcn/ui, but several polish issues need addressing to achieve a "flawless" standard.

---

## Issue Categories

### Category 1: Dark Mode & Colour Consistency

| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| DM-1 | `src/components/calendar/CalendarGrid.tsx:185-196` | Hardcoded `bg-amber-50`, `bg-amber-100` for closures. No dark mode equivalents fully integrated | Replace with semantic status colour variables or ensure consistent dark variants |
| DM-2 | `src/pages/portal/PortalInvoices.tsx:95-121` | Hardcoded `bg-green-100`, `bg-amber-50` for status badges | Use semantic `bg-success/10`, `bg-warning/10` tokens |
| DM-3 | `src/components/tours/TourProvider.tsx:144-152` | Joyride uses `#ffffff` and `rgba()` hardcoded colours | Convert to HSL CSS variables for theme awareness |
| DM-4 | `src/index.css:244-247` | `.glass-dark` uses hardcoded `rgba(10, 22, 40, 0.85)` | Use `hsl(var(--ink) / 0.85)` instead |
| DM-5 | `supabase/functions/invoice-pdf/index.ts:145-148` | PDF colours hardcoded as RGB | Acceptable for PDF (static output) - document as intentional |

**Implementation approach:**
1. Create semantic status colour variants in tailwind.config.ts
2. Update all status badges to use `bg-success/10 text-success`, `bg-warning/10 text-warning` pattern
3. Update TourProvider to read from CSS variables

---

### Category 2: Z-Index Stacking Order

| ID | Location | Current | Recommended |
|----|----------|---------|-------------|
| ZI-1 | `Header.tsx:22` | `z-50` | Keep as-is |
| ZI-2 | `MarketingNavbar.tsx:40` | `z-50` | Keep as-is |
| ZI-3 | `toast.tsx:17` | `z-[100]` | Change to `z-[9000]` (below modals, above content) |
| ZI-4 | `TourProvider.tsx:151` | `z-[10000]` | Keep as-is (tours should be topmost) |
| ZI-5 | `navigation-menu.tsx:100` | `z-[1]` | Change to `z-10` (above content, below headers) |

**Recommended Z-Index Scale:**
- Content: 0-10
- Dropdowns/Popovers: 50
- Headers: 50
- Modals: 100
- Sheets/Drawers: 100
- Toasts: 9000
- Tours: 10000

---

### Category 3: Mobile Responsiveness

| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| MR-1 | `StudentWizard.tsx:318-320` | Step connector width `w-16 sm:w-24` may overflow on iPhone SE (320px) | Add `hidden xs:block` to hide connectors on tiny screens, or use `w-8 sm:w-16 md:w-24` |
| MR-2 | `LessonModal.tsx` | Dialog max-width `max-w-2xl` may leave little margin on small tablets | Add `mx-4` or use `max-w-full sm:max-w-2xl` |
| MR-3 | `CalendarGrid.tsx` | Week view time column fixed at 56px - could use more space on mobile | Already mobile-adaptive; verify agenda view is primary on mobile |
| MR-4 | `FeatureComparison.tsx` | Table requires horizontal scroll on mobile | Add sticky first column for plan names |
| MR-5 | `About.tsx:204` | Decorative grid uses fixed `24px_24px` | Use `bg-[size:16px_16px] sm:bg-[size:24px_24px]` |
| MR-6 | Marketing hero floating notifications | `hidden lg:block` - good practice | No change needed |

**Implementation approach:**
1. Audit all modals/dialogs for mobile edge margins
2. Add responsive breakpoints to fixed-width decorative elements
3. Ensure all data tables have sticky first columns on mobile

---

### Category 4: Accessibility (A11y)

| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| A11Y-1 | `CalendarGrid.tsx:251-263` | Lesson cards lack keyboard navigation | Add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space |
| A11Y-2 | `LogoWordmark` | Text logo lacks `aria-label` | Add `aria-label="LessonLoop"` to the span |
| A11Y-3 | `UploadResourceModal.tsx:168-178` | Hidden file input pattern - ensure label association | Add `aria-describedby` linking to format instructions |
| A11Y-4 | `OnboardingChecklist.tsx:268` | Completed items have `tabIndex={-1}` which is correct | No change needed |
| A11Y-5 | `Students.tsx:234-241` | Toggle button has good `aria-label` | No change needed |
| A11Y-6 | Form inputs | Generally well-labelled with `sr-only` patterns | No change needed |

**Implementation approach:**
1. Add keyboard handlers to all clickable non-button elements
2. Audit all custom interactive components for focus states
3. Add `aria-live` regions for dynamic content updates

---

### Category 5: Visual Polish & Micro-Interactions

| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| VP-1 | `Messages.tsx` | HTML preview in message list shows raw tags | Strip HTML tags in list view, or truncate content with ellipsis |
| VP-2 | `DashboardHero.tsx` | Emoji in greeting may render inconsistently | Consider replacing with Lucide icons or keeping as-is (stylistic choice) |
| VP-3 | `StatCard` hover states | Good implementation with scale transitions | No change needed |
| VP-4 | `BentoFeatures` gradient hover | Excellent radial gradient follow effect | No change needed |
| VP-5 | Marketing page animations | Consistent framer-motion patterns | No change needed |
| VP-6 | Form validation | Uses toast notifications consistently | No change needed |

---

### Category 6: Typography & Spacing

| ID | Location | Issue | Fix |
|----|----------|-------|-----|
| TS-1 | Global | Inter font properly loaded with multiple weights | No change needed |
| TS-2 | `prose` classes on legal pages | Using default prose styles | Add `dark:prose-invert` for dark mode support |
| TS-3 | Card padding | Consistent `p-4` / `p-6` pattern | No change needed |
| TS-4 | Section spacing | Consistent `py-24 lg:py-32` on marketing | No change needed |

---

## Implementation Plan

### Phase 1: Critical Fixes (High Impact)

1. **Dark Mode Colour Tokens**
   - Update `src/index.css` to add semantic status colours
   - Update all hardcoded amber/green badges
   - Files: `CalendarGrid.tsx`, `PortalInvoices.tsx`, `TourProvider.tsx`

2. **Z-Index Normalisation**
   - Update toast z-index to `z-[9000]`
   - Update navigation-menu indicator to `z-10`
   - Files: `toast.tsx`, `navigation-menu.tsx`

3. **Keyboard Navigation for Calendar**
   - Add keyboard handlers to lesson cards
   - Files: `CalendarGrid.tsx`, `LessonCard.tsx`

### Phase 2: Mobile Polish (Medium Impact)

4. **Wizard Step Connectors**
   - Make step connectors responsive
   - Files: `StudentWizard.tsx`

5. **Modal Mobile Margins**
   - Ensure all dialogs have proper mobile spacing
   - Files: `LessonModal.tsx`, `CreateInvoiceModal.tsx`, `BillingRunWizard.tsx`

6. **Table Sticky Columns**
   - Add sticky first column to comparison tables
   - Files: `FeatureComparison.tsx`

### Phase 3: Accessibility Improvements (Medium Impact)

7. **Logo Accessibility**
   - Add `aria-label` to `LogoWordmark`
   - Files: `Logo.tsx`

8. **File Upload Pattern**
   - Improve screen reader experience for file uploads
   - Files: `UploadResourceModal.tsx`

9. **Prose Dark Mode**
   - Add `dark:prose-invert` to legal pages
   - Files: `Privacy.tsx`, `Terms.tsx`, `Cookies.tsx`, `GDPR.tsx`

### Phase 4: Minor Polish (Low Impact)

10. **Message List HTML Stripping**
    - Strip HTML from message previews
    - Files: `MessageList.tsx`

11. **Decorative Grid Responsiveness**
    - Make grid pattern size responsive
    - Files: `About.tsx`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/index.css` | Add semantic status colour variables |
| `src/components/calendar/CalendarGrid.tsx` | Update status colours, add keyboard handlers |
| `src/components/calendar/LessonCard.tsx` | Add keyboard accessibility |
| `src/pages/portal/PortalInvoices.tsx` | Update hardcoded status colours |
| `src/components/tours/TourProvider.tsx` | Use CSS variables for theme colours |
| `src/components/ui/toast.tsx` | Update z-index |
| `src/components/ui/navigation-menu.tsx` | Update z-index |
| `src/components/students/StudentWizard.tsx` | Responsive step connectors |
| `src/components/calendar/LessonModal.tsx` | Mobile margin improvements |
| `src/components/brand/Logo.tsx` | Add aria-label to LogoWordmark |
| `src/components/resources/UploadResourceModal.tsx` | Improve a11y for file input |
| `src/pages/marketing/Privacy.tsx` | Add dark:prose-invert |
| `src/pages/marketing/Terms.tsx` | Add dark:prose-invert |
| `src/pages/marketing/Cookies.tsx` | Add dark:prose-invert |
| `src/pages/marketing/About.tsx` | Responsive grid pattern |
| `src/components/messages/MessageList.tsx` | Strip HTML from previews |
| `src/components/marketing/features/FeatureComparison.tsx` | Sticky column on mobile |

---

## Summary

**Total Issues Identified:** 27  
**Critical:** 3 (dark mode, z-index, keyboard nav)  
**Medium:** 10 (mobile responsiveness, a11y)  
**Low:** 14 (visual polish, minor improvements)

The codebase is already well-structured with good design patterns. These fixes will elevate the experience from "good" to "flawless" across all devices and accessibility requirements.
