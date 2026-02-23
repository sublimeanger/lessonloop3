# LessonLoop Design Brief

> Read this before making any visual changes. This is the single source of truth for how LessonLoop should look and feel.

## Brand Identity: "The Guide"

LessonLoop is a calm, capable, professional music lesson management platform. It should feel like a trusted colleague — organised, warm, never overwhelming. Think **Linear meets Notion** — clean, spacious, purposeful. Never cluttered, never flashy.

**UK audience.** British English throughout. £ not $. dd/MM/yyyy date format. "Organisation" not "Organization." "Colour" not "Color" in UI copy (code variables can use US spelling).

## Design Benchmarks

When in doubt, reference these products for feel:
- **Linear** — information density done right, everything breathes
- **Notion** — warm neutrals, clear hierarchy, satisfying interactions
- **Stripe Dashboard** — professional data display, clean tables, clear status indicators
- **Raycast** — polished micro-interactions, keyboard-friendly

## Typography

- **Font:** DM Sans (already configured in `tailwind.config.ts`)
- **Hierarchy** (use the semantic classes defined in tailwind config):
  - `text-page-title` — page headings (1.75rem/700)
  - `text-section-title` — section headings (1.125rem/600)
  - `text-body-strong` — labels, emphasized body (0.875rem/600)
  - `text-body` — default body text (0.875rem/400)
  - `text-caption` — secondary info, metadata (0.75rem/500)
  - `text-micro` — badges, tiny labels (0.6875rem/500)
- **Never** use arbitrary font sizes when a semantic class exists
- Headings always use `tracking-tight`

## Colour System

All colours are defined as CSS custom properties in `src/index.css` and mapped in `tailwind.config.ts`.

### Brand Palette
| Token | Usage |
|-------|-------|
| `ink` / `ink-light` / `ink-dark` | Primary text, dark surfaces (sidebar) |
| `teal` / `teal-light` / `teal-dark` | Primary brand, CTAs, active states, links |
| `coral` / `coral-light` / `coral-dark` | Accent highlights, urgent indicators, warmth |

### Semantic Colours
| Token | Usage |
|-------|-------|
| `primary` | Primary buttons, links, active indicators — always teal |
| `destructive` | Delete actions, error states, overdue badges |
| `success` | Paid, completed, online, positive indicators |
| `warning` | Approaching deadline, partial states |
| `info` | Informational banners, neutral highlights |
| `muted` | Backgrounds, disabled states, secondary surfaces |

### Rules
- **Never** use raw hex/rgb values. Always use the design tokens.
- Primary actions (save, create, confirm) → `bg-primary text-primary-foreground`
- Destructive actions (delete, cancel subscription) → `variant="destructive"`
- Secondary actions (cancel, close, back) → `variant="outline"` or `variant="ghost"`
- Backgrounds alternate between `bg-background` and `bg-muted/50` for visual rhythm

## Spacing

- **Page padding:** `p-4 md:p-6` (mobile-first)
- **Section gaps:** `space-y-6` between major sections
- **Card internal padding:** `p-4` or `p-5` — never `p-3`, never `p-8`
- **Between cards in a grid:** `gap-4`
- **Between form fields:** `space-y-4`
- **PageHeader bottom margin:** `mb-4` (already in `PageHeader` component)
- **General rule:** When something feels cramped, add space. When something feels lost, tighten. LessonLoop should always breathe.

## Shadows & Borders

Use the custom shadows defined in `tailwind.config.ts`:
- `shadow-card` — default card appearance (subtle border + minimal shadow)
- `shadow-card-hover` — cards on hover
- `shadow-md` — elevated elements like dropdowns
- `shadow-lg` — modals, popovers
- `shadow-float` — floating action buttons, drawers

Cards use `rounded-xl border bg-card` as the base pattern. Interactive cards add `hover:shadow-card-hover transition-shadow`.

## Animations

Use the animations defined in `tailwind.config.ts`. The global easing is `cubic-bezier(0.22, 1, 0.36, 1)` — smooth and responsive.

- **Page enter:** `animate-page-enter` (fade up, 0.2s)
- **Elements appearing:** `animate-fade-up` (0.4s) or `animate-slide-up` (0.25s)
- **Modals/dialogs:** `animate-scale-fade` (0.2s)
- **Side panels:** `animate-slide-in-right` (0.3s)
- **Interactive feedback:** 150ms transitions on buttons, links, and interactive elements (set globally in `index.css`)

**Rules:**
- Every page transition should use `animate-page-enter` or a framer-motion equivalent
- Never use jarring instant-appears. Everything fades or slides in.
- Don't overdo it — animations should be felt, not noticed
- Loading spinners use `animate-spin` on the `Loader2` icon from lucide-react

## Iconography

- **Icon library:** lucide-react (already used throughout)
- **Sizes:** `h-4 w-4` inline with text, `h-5 w-5` in buttons, `h-8 w-8` or `h-12 w-12` for empty states
- **Colour:** Icons in buttons inherit. Standalone icons use `text-muted-foreground` or a semantic colour
- **Never** mix icon libraries. lucide-react only.

## Responsive Behaviour

- **Mobile-first.** Every layout starts at mobile and scales up.
- **Breakpoints:** `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)
- **Sidebar:** Dark ink sidebar on desktop, collapsed or bottom nav on mobile
- **Tables:** Should scroll horizontally on mobile or switch to card layouts
- **Touch targets:** Minimum 44×44px on mobile for all interactive elements

## Component Patterns

### Buttons
- Primary action: `<Button>` (filled teal)
- Secondary action: `<Button variant="outline">`
- Tertiary/subtle: `<Button variant="ghost">`
- Danger: `<Button variant="destructive">`
- Small context actions: `<Button variant="ghost" size="sm">`
- Icon-only: `<Button variant="ghost" size="icon">`

### Cards
- Standard: `rounded-xl border bg-card p-4`
- Interactive: Add `hover:shadow-card-hover transition-shadow cursor-pointer`
- Stat cards: Use the `StatCard` component from dashboard

### Modals & Dialogs
- Use shadcn `Dialog` for forms and content
- Use shadcn `AlertDialog` for confirmations and destructive actions
- Use `Sheet` for mobile-friendly side panels only when needed
- The `LoopAssistDrawer` is the only Drawer pattern

### Forms
- Labels above inputs
- Validation messages below inputs in `text-destructive text-sm`
- Submit button right-aligned, with Cancel on the left
- Loading state on submit: disable button + show `Loader2` spinner

### Tables
- Use consistent column alignment
- Status badges use the `Badge` component
- Actions in a `DropdownMenu` triggered by a `MoreHorizontal` icon

## What "World-Class" Means for LessonLoop

1. **No dead ends.** Every screen has a clear next action.
2. **No mystery meat.** Every element's purpose is obvious.
3. **No janky transitions.** Everything animates smoothly.
4. **No broken states.** Loading, empty, error, and success all handled.
5. **No inconsistency.** The same action looks and works the same everywhere.
6. **No accessibility gaps.** Keyboard navigable, screen reader friendly, proper ARIA.
7. **No clutter.** If it doesn't help the user, remove it.
