
# World-Class Parent Portal UX Upgrade

## Current Problems

The parent portal looks like a basic wireframe compared to the polished main dashboard. Key issues:

- **Sidebar**: Plain white background with unstyled nav links -- completely different from the dark, premium `AppSidebar` used by staff
- **Home/Dashboard**: No hero section, no time-based greeting, plain text greeting instead of the cinematic `DashboardHero` that staff get
- **Bottom Nav (mobile)**: Functional but bland -- no active indicator beyond colour change
- **All page headers**: Plain `PageHeader` text with no visual distinction
- **Cards everywhere**: Generic white cards with no elevation hierarchy, no hover effects, no branded accents
- **Tabs (Messages)**: Default unstyled `TabsList` -- boring and generic
- **Schedule lesson cards**: Dense, unstructured information dump
- **Profile page**: Plain form with no visual personality

## Design Vision

Match the staff dashboard's premium "The Guide" identity: dark sidebar, cinematic hero, branded cards with hover elevation, tactile interactions, and polished micro-animations.

## Changes (Visual/UX Only -- Zero Functionality Changes)

### 1. Portal Sidebar (`src/components/layout/PortalSidebar.tsx`)
- Switch from `bg-white` to dark ink sidebar matching `AppSidebar` (uses `--sidebar-background` tokens)
- Add org logo/branding area at top with `Logo` + `LogoWordmark` components
- Style nav items with `text-sidebar-foreground`, active state `bg-sidebar-primary text-sidebar-primary-foreground`
- Add grouped section label (e.g. "PORTAL") in `10px` uppercase tracking
- Add separator between nav and footer
- Style footer avatar with `bg-sidebar-primary` matching staff sidebar
- Icon stroke width to 1.5 for consistency

### 2. Portal Layout (`src/components/layout/PortalLayout.tsx`)
- No structural changes, just ensure the sidebar/content split inherits the new sidebar styling

### 3. Portal Home / Dashboard (`src/pages/portal/PortalHome.tsx`)
- Replace plain text greeting with a `DashboardHero`-style component (time-based gradient, animated sky scene, wave emoji)
- Add stat pills for: next lesson countdown, outstanding balance, unread messages
- Restyle "Your Children" cards with `shadow-card` base, `hover:shadow-elevated` on hover, `active:scale-[0.995]` tactile effect
- Add subtle gradient accent stripe on the left edge of children cards
- Restyle "Next Lesson" hero card with a more vibrant gradient and rounded-2xl
- Restyle outstanding balance and messages cards with branded icon backgrounds
- Add `rounded-2xl` to all cards for consistency
- Make-up credits card: refine with softer gradient, cleaner typography
- Quick actions at bottom: style as a row of rounded pill buttons similar to `QuickActionsGrid`

### 4. Bottom Nav (`src/components/layout/PortalBottomNav.tsx`)
- Add an active indicator dot or bar below the active icon (small 4px rounded bar, bg-primary)
- Increase tap target to `h-16`
- Add subtle `backdrop-blur-lg` glass effect background
- Add top shadow instead of hard border for depth

### 5. Schedule Page (`src/pages/portal/PortalSchedule.tsx`)
- Restyle lesson cards: add left colour accent bar (green=upcoming, grey=past, red=cancelled)
- Add `rounded-2xl` and `shadow-card hover:shadow-elevated` to lesson cards
- Restyle week group headers with a subtle divider line and bolder typography
- Calendar subscribe card: make it more compact and visually integrated

### 6. Invoices Page (`src/pages/portal/PortalInvoices.tsx`)
- Restyle invoice cards with left accent bar (amber=outstanding, green=paid, grey=void)
- Add `rounded-2xl` consistency
- Restyle the outstanding summary banner with a gradient background instead of flat colour
- Status badges: use pill-shaped badges with softer colours

### 7. Messages Page (`src/pages/portal/PortalMessages.tsx`)
- Restyle `TabsList` with pill-shaped tabs, teal active indicator, and subtle background
- Conversation cards: add `rounded-2xl`, cleaner spacing, hover elevation
- Message bubbles: slightly larger border radius, softer shadow on staff messages
- Empty state: warmer illustration style

### 8. Profile Page (`src/pages/portal/PortalProfile.tsx`)
- Add a profile header card with user avatar, name, and org context
- Style form cards with `rounded-2xl` and section icons
- Notification toggles: add card-like rows with subtle separator

### 9. Page Headers (all portal pages)
- For portal pages, use slightly larger heading (text-2xl on mobile, text-3xl on desktop)
- Add a subtle bottom gradient line beneath the title for branding

### 10. Global Card Styling
- All portal cards get `rounded-2xl shadow-card` base
- Hover cards get `hover:shadow-elevated transition-all duration-150`
- Clickable cards get `active:scale-[0.995] cursor-pointer`

## Files to Edit

| File | Scope |
|------|-------|
| `src/components/layout/PortalSidebar.tsx` | Dark sidebar, branded nav, styled footer |
| `src/components/layout/PortalLayout.tsx` | Minor: ensure sidebar class pass-through |
| `src/components/layout/PortalBottomNav.tsx` | Glass effect, active indicator, larger targets |
| `src/pages/portal/PortalHome.tsx` | Hero section, card styling, stat pills, quick actions |
| `src/pages/portal/PortalSchedule.tsx` | Lesson card accent bars, rounded cards, week headers |
| `src/pages/portal/PortalInvoices.tsx` | Invoice card accents, outstanding banner, rounded cards |
| `src/pages/portal/PortalMessages.tsx` | Pill tabs, conversation card styling, bubble polish |
| `src/pages/portal/PortalProfile.tsx` | Profile header, card styling, form refinement |
| `src/pages/portal/PortalPractice.tsx` | Card consistency (rounded-2xl, shadows) |
| `src/pages/portal/PortalResources.tsx` | Card consistency (rounded-2xl, shadows) |

## What Does NOT Change

- Zero functionality, data fetching, or business logic changes
- No new dependencies
- No database or edge function changes
- All existing features (make-up stepper, calendar sync, payment flow, etc.) remain identical
- Mobile responsiveness maintained
