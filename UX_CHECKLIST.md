# LessonLoop UX Checklist

> Run this checklist against every page and component. If any item fails, fix it before moving on.

## Visual Hierarchy

- [ ] Page title uses `PageHeader` component (or `DashboardHero` on the dashboard)
- [ ] The most important content/action is visually dominant — users know where to look first
- [ ] Secondary information uses `text-muted-foreground` or `text-caption`
- [ ] No two elements compete for attention at the same visual weight
- [ ] CTAs are clearly distinguishable from surrounding content
- [ ] Status indicators (badges, dots, icons) are immediately scannable

## Spacing & Alignment

- [ ] Page uses consistent padding: `p-4 md:p-6`
- [ ] Major sections separated by `space-y-6`
- [ ] Cards use `p-4` or `p-5` internal padding — consistent within the page
- [ ] Grid gaps are `gap-4` throughout
- [ ] No orphaned elements floating with inconsistent margins
- [ ] Content doesn't touch edges — everything has breathing room
- [ ] On mobile, nothing overflows the viewport horizontally

## Loading States

- [ ] Uses appropriate skeleton from `LoadingState.tsx`:
  - `DashboardSkeleton` for dashboard
  - `CalendarSkeleton` for calendar views
  - `ListSkeleton` for list pages (students, invoices, etc.)
  - `DetailSkeleton` for detail pages (student detail, invoice detail)
  - `FormSkeleton` for form-heavy dialogs
  - `PortalHomeSkeleton` for portal home
  - `GridSkeleton` for stat card grids
- [ ] Skeletons match the actual layout shape (not generic spinners for content areas)
- [ ] Spinner (`LoadingState`) only used for full-page initial loads
- [ ] Buttons show `Loader2` spinner + disabled state during async actions
- [ ] No layout shift when content loads in (skeleton matches content dimensions)

## Empty States

- [ ] Uses `EmptyState` component from `shared/EmptyState.tsx`
- [ ] Has a relevant icon (from lucide-react)
- [ ] Has a clear, helpful title (not just "No data")
- [ ] Has a description explaining what this area is for
- [ ] Has a primary CTA to create/add the first item (where applicable)
- [ ] Inline lists use `InlineEmptyState` for lighter treatment
- [ ] Empty states feel encouraging, not like errors

## Error States

- [ ] API errors show a toast via `useToast` hook
- [ ] Success toasts have a clear `title` (and optional `description`)
- [ ] Error toasts use `variant: 'destructive'`
- [ ] Form validation errors appear inline below the relevant field
- [ ] Network failures show the `OfflineBanner` component
- [ ] Component-level errors caught by `SectionErrorBoundary`
- [ ] Full page errors caught by `ErrorBoundary`
- [ ] No silent failures — every error is communicated to the user

## Hover & Focus States

- [ ] All clickable elements have a visible hover state
- [ ] Buttons use built-in shadcn hover states (no custom overrides needed)
- [ ] Interactive cards have `hover:shadow-card-hover transition-shadow`
- [ ] Links have `hover:underline` or a colour change
- [ ] Focus rings visible for keyboard navigation (`ring` token from design system)
- [ ] Dropdown triggers have clear hover/active states
- [ ] Table rows have `hover:bg-muted/50` if clickable

## Transitions & Animations

- [ ] Page wraps content in a `motion.div` with `animate-page-enter` or equivalent
- [ ] Modals/dialogs use `animate-scale-fade` (built into shadcn)
- [ ] Lists animate in with staggered `itemVariants` (opacity + translateY)
- [ ] No content pops in without any transition
- [ ] No animation longer than 400ms (keep things snappy)
- [ ] Transitions don't block interaction

## Responsiveness

- [ ] Tested at mobile width (375px) — nothing overflows
- [ ] Tested at tablet width (768px) — layout adapts sensibly
- [ ] Tables either scroll horizontally or convert to card layout on mobile
- [ ] Modals are full-screen or bottom-sheet on mobile
- [ ] Touch targets are minimum 44×44px on mobile
- [ ] Sidebar collapses to bottom nav or hamburger on mobile
- [ ] Text doesn't truncate in a way that hides critical info

## Accessibility

- [ ] All images have `alt` text (or `aria-hidden="true"` if decorative)
- [ ] Loading states have `role="status"` and `aria-live="polite"` (already in `LoadingState`)
- [ ] Empty states have `role="status"` (already in `EmptyState`)
- [ ] Form inputs have associated `<label>` elements
- [ ] Modals trap focus and can be closed with Escape
- [ ] Icon-only buttons have `aria-label`
- [ ] Colour is not the only indicator of state (pair with icons or text)
- [ ] Skip to main content link present in layout

## Typography

- [ ] Page titles use `text-page-title` or equivalent semantic class
- [ ] Section headers use `text-section-title`
- [ ] Body text uses `text-body` (0.875rem)
- [ ] Metadata/captions use `text-caption` or `text-micro`
- [ ] No arbitrary `text-[13px]` or similar — use the defined scale
- [ ] Line heights are comfortable — text never feels cramped
- [ ] Long text truncates with `truncate` class or has proper overflow handling

## Page-Specific Quick Checks

### Dashboard
- [ ] `DashboardHero` greeting is personalised with first name
- [ ] Stat cards load with `GridSkeleton` then animate in
- [ ] `TodayTimeline` shows relevant lessons or encouraging empty state
- [ ] `UrgentActionsBar` only shows when there are actual urgent items
- [ ] `LoopAssistWidget` is present and functional

### Calendar
- [ ] Day/Week/Stacked/Agenda views all work
- [ ] Lesson cards show teacher colour coding via `teacherColours.ts`
- [ ] Drag to reschedule works (desktop)
- [ ] Quick create popover works
- [ ] Filters bar collapses gracefully on mobile

### Students
- [ ] Search and filter (status pills) work together
- [ ] Student cards/rows show avatar, name, instrument, status
- [ ] Add Student wizard opens cleanly
- [ ] Student detail page loads all tabs without errors

### Invoices
- [ ] Stats widget shows key financial summary
- [ ] Filters bar works with all filter combinations
- [ ] Bulk actions bar appears when items selected
- [ ] Invoice status badges use consistent colours

### Portal (Parent)
- [ ] `PortalLayout` with `PortalSidebar` / `PortalBottomNav` works
- [ ] Child switcher (`ChildSwitcher`) works when multiple children
- [ ] All portal pages use `PortalLayout`, not `AppLayout`
- [ ] Feature disabled states use `PortalFeatureDisabled`
- [ ] Error states use `PortalErrorState`
