# LessonLoop UX Checklist — World-Class Standard

> Run EVERY item on EVERY page. Check at both **375px mobile** AND **1280px desktop**. If any item fails at either viewport, fix it before moving on. No exceptions.

---

## Visual Hierarchy

### Desktop (1280px+)
- [ ] Page title uses `PageHeader` component (or `DashboardHero` on dashboard)
- [ ] Primary CTA is top-right of PageHeader and visually dominant
- [ ] Content follows Z-pattern reading flow: header → stats → main content → secondary
- [ ] No two elements compete at the same visual weight
- [ ] Stat cards use 4-column grid (`sm:grid-cols-2 lg:grid-cols-4`)
- [ ] Secondary info uses `text-muted-foreground` or `text-caption`
- [ ] Status badges are immediately scannable without reading surrounding text

### Mobile (375px)
- [ ] Page title is legible and doesn't wrap awkwardly
- [ ] Primary CTA is either: in PageHeader (icon-only with `aria-label`), or prominent full-width button below header
- [ ] Stat cards stack to 2-col (`sm:grid-cols-2`) then 1-col on smallest screens
- [ ] No content is hidden that's essential on mobile — only secondary details collapse
- [ ] Touch targets are minimum 44×44px — verify with browser dev tools

---

## Spacing & Alignment

### Desktop
- [ ] Page uses `p-4 md:p-6 lg:p-8` (from AppLayout) — no custom overrides
- [ ] Major sections: `space-y-6`
- [ ] Cards: `p-4` or `p-5` internal padding, `gap-4` between cards
- [ ] No orphaned elements with inconsistent margins
- [ ] Content columns align to the same grid

### Mobile
- [ ] Portal pages: `p-6 pb-24` (bottom padding for nav bar)
- [ ] Nothing overflows viewport horizontally — check with `overflow: hidden` test
- [ ] Cards are full-width with comfortable side padding
- [ ] Spacing between elements doesn't feel cramped OR excessive
- [ ] Form buttons are reachable without scrolling past all content

---

## Loading States

### Skeleton Selection (MUST use the correct variant)
| Page Type | Component | File |
|-----------|-----------|------|
| Dashboard | `DashboardSkeleton` | `shared/LoadingState.tsx` |
| Calendar | `CalendarSkeleton` | `shared/LoadingState.tsx` |
| List pages | `ListSkeleton` | `shared/LoadingState.tsx` |
| Detail pages | `DetailSkeleton` | `shared/LoadingState.tsx` |
| Form dialogs | `FormSkeleton` | `shared/LoadingState.tsx` |
| Portal home | `PortalHomeSkeleton` | `shared/LoadingState.tsx` |
| Stat grids | `GridSkeleton` | `shared/LoadingState.tsx` |

### Desktop Checks
- [ ] Skeletons match actual layout shape (not generic spinners for content)
- [ ] No layout shift when real content loads (skeleton dimensions match content)
- [ ] Shimmer blocks use `animate-pulse rounded-xl bg-muted`
- [ ] Multiple skeletons load simultaneously (no sequential loading appearance)

### Mobile Checks
- [ ] Skeletons are adapted for mobile layout (single column, not desktop grid at mobile width)
- [ ] Loading state doesn't push content below the fold unnecessarily
- [ ] Full-page spinner (`LoadingState`) only for initial app shell load

### Action Loading
- [ ] Every async button shows `Loader2` spinner + disabled state during action
- [ ] Save/Submit buttons: `<Button disabled><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</Button>`
- [ ] No double-submit possible (button disabled during async)

---

## Empty States

### Content Checks
- [ ] Uses `EmptyState` component (full page) or `InlineEmptyState` (within lists)
- [ ] Has relevant lucide-react icon (not generic)
- [ ] Title tells user what this area IS, not just "No data"
- [ ] Description tells user HOW to get started (encouraging tone)
- [ ] Primary CTA to create/add the first item where applicable
- [ ] Tone is warm and helpful: "No students yet" → "Add your first student to start building your schedule"

### Desktop Checks
- [ ] Empty state is vertically centred in the available space
- [ ] Icon is `h-12 w-12 text-muted-foreground/30`
- [ ] Max width of description is constrained (`max-w-sm mx-auto`)

### Mobile Checks
- [ ] Empty state fits on screen without scrolling
- [ ] CTA button is full-width or at least prominently tappable
- [ ] Icon scales down appropriately (not oversized on small screen)

---

## Error Handling

- [ ] API errors → toast with `variant: 'destructive'` and friendly message
- [ ] Success → toast with clear past-tense title ("Student created", "Invoice sent")
- [ ] Form validation → inline below the specific field in `text-sm text-destructive`
- [ ] Network loss → `OfflineBanner` component appears
- [ ] Component crash → `SectionErrorBoundary` catches and shows recovery UI
- [ ] Full page crash → `ErrorBoundary` with "Try Again" and "Go to Dashboard" buttons
- [ ] Portal errors → `PortalErrorState` component (not generic ErrorBoundary)
- [ ] No silent failures — every error communicates something to the user
- [ ] Error messages never expose raw database/API error strings

---

## Hover, Focus & Active States

### Desktop
- [ ] All clickable elements have visible hover state
- [ ] Interactive cards: `hover:shadow-card-hover transition-shadow`
- [ ] Links: colour change or underline on hover
- [ ] Table rows (if clickable): `hover:bg-muted/50`
- [ ] Dropdown triggers: clear hover/active visual change
- [ ] StatCards: `whileHover={{ y: -2 }}` spring animation

### Keyboard / Accessibility
- [ ] Focus rings visible: `ring` token from design system
- [ ] Tab order is logical (top to bottom, left to right)
- [ ] Skip to main content link in layout
- [ ] Modals trap focus and close with Escape
- [ ] Dropdown menus navigable with arrow keys
- [ ] Icon-only buttons have `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Loading states have `role="status"` and `aria-live="polite"`
- [ ] Form inputs have associated `<label>` elements

### Mobile
- [ ] No hover-only interactions — everything works with tap
- [ ] Active/pressed states provide tactile feedback
- [ ] Touch targets: 44×44px minimum
- [ ] No tiny icon-only buttons without adequate tap area

---

## Transitions & Animations

### Desktop
- [ ] Page content wraps in `animate-page-enter` (via AppLayout) or framer-motion equivalent
- [ ] Portal pages use framer-motion `opacity: 0→1` with 0.15s
- [ ] Dashboard sections use staggered `itemVariants` entrance
- [ ] Modals/dialogs use `animate-scale-fade`
- [ ] Side panels slide in from right
- [ ] No content pops in without any transition
- [ ] No animation exceeds 400ms

### Mobile
- [ ] Same page transition animations as desktop (they're handled by layout)
- [ ] Bottom sheet / full-screen modals animate up from bottom
- [ ] No janky scroll-related animations
- [ ] Transitions don't block interaction or feel sluggish

---

## Responsiveness — Critical Checks

### At 375px (iPhone SE)
- [ ] Nothing overflows horizontally
- [ ] All text is readable without zooming
- [ ] No overlapping elements
- [ ] Bottom nav doesn't obscure content
- [ ] Modals are full-screen or near-full-screen
- [ ] Tables convert to cards or scroll horizontally with clear affordance

### At 768px (iPad)
- [ ] Layout uses 2-column where appropriate
- [ ] Sidebar may be collapsed but accessible
- [ ] Modals are appropriately sized (not full-screen like phone, not tiny)

### At 1280px (Desktop)
- [ ] Full sidebar visible
- [ ] Multi-column layouts utilised
- [ ] No content is stretched uncomfortably wide
- [ ] Modals are properly constrained in width

### At 1920px+ (Wide Desktop)
- [ ] Content doesn't stretch to fill the entire width
- [ ] Portal pages respect `max-w-4xl mx-auto`
- [ ] Admin pages have sensible max-widths on content areas

---

## Typography Checks

- [ ] Page titles: `text-page-title` or equivalent
- [ ] Section headers: `text-section-title`
- [ ] Body text: `text-body` (14px)
- [ ] Metadata: `text-caption` or `text-micro`
- [ ] No arbitrary `text-[13px]` — only the defined scale
- [ ] Line heights are comfortable on both viewports
- [ ] Long text truncates with `truncate` — never breaks layouts
- [ ] Numbers in tables use tabular-nums for alignment (`font-variant-numeric: tabular-nums` or `tabular-nums` Tailwind class)

---

## Page-Specific Checks

### Dashboard (Desktop + Mobile)
- [ ] `DashboardHero` greeting personalised with first name, time-appropriate scene
- [ ] Stat pills in hero link to relevant pages
- [ ] Stat cards animate in with staggered variants
- [ ] `TodayTimeline` shows lessons or encouraging empty state
- [ ] `UrgentActionsBar` only renders when items exist
- [ ] `LoopAssistWidget` accessible and functional
- [ ] Mobile: hero is compact, stat cards 2-col, timeline full-width

### Calendar (Desktop + Mobile)
- [ ] Desktop: Week grid, side panel, drag/resize, popover positioning all work
- [ ] Mobile: `CalendarMobileLayout` with `MobileWeekView`/`MobileDayView`, `MobileLessonSheet`
- [ ] Teacher colour coding via `teacherColours.ts` consistent across views
- [ ] Filters bar collapses or scrolls on mobile
- [ ] Quick create popover doesn't overflow on mobile
- [ ] Lesson cards readable at all viewport sizes

### Students (Desktop + Mobile)
- [ ] Desktop: table/grid with search + StatusPills filter
- [ ] Mobile: cards not cramped table, search prominent, filters accessible
- [ ] StudentWizard: desktop modal, mobile full-screen
- [ ] Import flow: each step works at both viewports

### Invoices (Desktop + Mobile)
- [ ] Desktop: table with bulk selection, stats widget grid
- [ ] Mobile: invoice cards, stats stack, filters collapse
- [ ] Modals full-screen on mobile
- [ ] Currency always via `formatCurrencyMinor()` — never raw numbers

### Portal — ALL Pages (Mobile Priority)
- [ ] `PortalLayout` with `PortalBottomNav` on mobile, `PortalSidebar` on desktop
- [ ] `ChildSwitcher` prominent on mobile (sits above content)
- [ ] Feature-disabled pages use `PortalFeatureDisabled` component
- [ ] Error states use `PortalErrorState` component
- [ ] Every page exceptional at 375px FIRST, then scale up
- [ ] Bottom nav: correct item highlighted, badge counts visible, safe-area respected
