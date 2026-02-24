# LessonLoop Design Brief — World-Class Standard

> **Read this entire file before making ANY visual change.** This is the single source of truth. Every decision must trace back to this document. If something isn't covered here, reference Linear, Notion, or Stripe Dashboard and match their quality.

---

## 1. Brand Identity: "The Guide"

LessonLoop is a calm, capable, professional music lesson management platform for UK music academies. It should feel like a trusted colleague — organised, warm, never overwhelming.

**Personality:** Composed. Trustworthy. Warm but professional. Effortlessly organised. Quietly delightful.

**NEVER:** Cluttered. Cheap. Generic SaaS. Overwhelming. Cold. Over-animated. Dashboard-hell.

**Target users and their primary devices:**
- **Academy owners/admins** — Desktop-first power users, live in the app daily
- **Teachers** — Mixed desktop/tablet, lighter usage, calendar-focused
- **Parents** — Mobile-first phone users, sporadic usage (paying invoices, checking schedules, logging practice)

---

## 2. Design Benchmarks

For every design decision, compare against:
- **Linear** — information density, keyboard shortcuts, snappy interactions, dark sidebar
- **Notion** — warm neutrals, clear hierarchy, satisfying micro-interactions, generous whitespace
- **Stripe Dashboard** — professional data display, clean tables, world-class typography
- **Apple Music** — mobile UI patterns, bottom navigation, fluid gestures

---

## 3. Typography

Font: **DM Sans** (configured in `tailwind.config.ts`, loaded from Google Fonts in `index.html`)

### Semantic Scale — ALWAYS use these, NEVER arbitrary sizes
| Class | Size/Weight | Use |
|-------|------------|-----|
| `text-page-title` | 28px / 700 / -0.025em | Page headings via `PageHeader` component |
| `text-section-title` | 18px / 600 / -0.015em | Section headings within pages |
| `text-body-strong` | 14px / 600 | Labels, card titles, emphasized body |
| `text-body` | 14px / 400 | Default body text, descriptions |
| `text-caption` | 12px / 500 | Metadata, timestamps, secondary info |
| `text-micro` | 11px / 500 | Badges, tiny labels, status indicators |

**Rules:** Never use `text-[13px]` or any arbitrary size. Headings always `tracking-tight`. Long text uses `max-w-prose`. Truncate with `truncate` class — never let text break layouts.

---

## 4. Colour System

All colours as HSL CSS custom properties in `src/index.css`, mapped in `tailwind.config.ts`. Light + dark mode tokens exist.

### Brand Palette
| Token | Usage |
|-------|-------|
| `ink` / `ink-light` / `ink-dark` | Primary text, dark surfaces (sidebar) |
| `teal` / `teal-light` / `teal-dark` | Primary brand, CTAs, active states, links |
| `coral` / `coral-light` / `coral-dark` | Accent highlights, urgency, warmth |

### Semantic Tokens
| Token | Usage Example |
|-------|--------------|
| `primary` (teal) | Save button, active nav, links |
| `destructive` | Delete button, error toast, overdue badge |
| `success` | Paid badge, attendance marked, connected status |
| `warning` | Due soon, partial payment, approaching deadline |
| `info` | Sync status, informational tips |
| `muted` | Backgrounds, disabled states, secondary surfaces |

### Hard Rules
- **NEVER** raw hex/rgb/hsl. Always design tokens.
- **NEVER** Tailwind default palette (`blue-500`, `red-600`). Use our semantic tokens.
- Alternate `bg-background` and `bg-muted/50` for visual rhythm between sections.

---

## 5. Spacing

### Page-Level
| Context | Classes |
|---------|---------|
| Admin page (AppLayout) | `p-4 md:p-6 lg:p-8` |
| Portal mobile | `p-6 pb-24` (extra bottom for `PortalBottomNav`) |
| Portal desktop | `p-6 md:p-8` inside `max-w-4xl mx-auto` |

### Component-Level
| Context | Classes |
|---------|---------|
| Major section gaps | `space-y-6` |
| Card padding | `p-4` standard, `p-5` spacious, `p-6` stat cards on desktop |
| Card grid gaps | `gap-4` |
| Form field gaps | `space-y-4` |
| Button groups | `gap-2` |
| PageHeader bottom | `mb-4` (built-in) |
| Icon-to-text | `gap-1.5` or `gap-2` |

### Responsive Spacing Patterns (used in StatCard, DashboardHero)
- Padding: `p-4 sm:p-5 md:p-6`
- Text: `text-xs sm:text-sm` or `text-sm sm:text-base`
- Icons: `h-3.5 w-3.5 sm:h-4 sm:w-4`

**Golden Rule:** When cramped → add space. When lost → tighten. LessonLoop always breathes.

---

## 6. Shadows & Elevation (from tailwind config)
| Token | Use |
|-------|-----|
| `shadow-card` | Default card state |
| `shadow-card-hover` | Cards on hover |
| `shadow-md` | Dropdowns, popovers |
| `shadow-lg` | Modals, dialogs |
| `shadow-float` | Floating elements, drawers |

Card base: `rounded-xl border bg-card shadow-card`
Interactive card: add `hover:shadow-card-hover transition-shadow cursor-pointer`

---

## 7. Animation

Global easing: `cubic-bezier(0.22, 1, 0.36, 1)` (set in `index.css`)

| Token | Duration | Use |
|-------|----------|-----|
| `animate-page-enter` | 0.2s | All page content (via AppLayout) |
| `animate-fade-up` | 0.4s | Elements appearing |
| `animate-slide-up` | 0.25s | List items |
| `animate-scale-fade` | 0.2s | Modals, dialogs |
| `animate-slide-in-right` | 0.3s | Side panels |

Framer Motion stagger pattern (Dashboard):
```tsx
const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
```

**Rules:** Never instant-appear. Never >400ms. Buttons: 150ms transitions. StatCard hover: `whileHover={{ y: -2 }}` spring.

---

## 8. Iconography

**lucide-react only.** Never mix icon libraries.

| Context | Size |
|---------|------|
| Inline with body text | `h-3.5 w-3.5 sm:h-4 sm:w-4` |
| In buttons | `h-4 w-4 mr-2` |
| In stat cards | `h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6` |
| Empty states | `h-12 w-12 text-muted-foreground/30` |
| Navigation | `h-5 w-5` |
| Active portal nav | `h-5 w-5 stroke-[2.5]` |

---

## 9. Component Patterns

### Buttons (287 outline, 127 ghost, 72 secondary, 48 destructive, 11 link in codebase)
| Action | Pattern |
|--------|---------|
| Primary page CTA | `<Button><Plus className="h-4 w-4 mr-2" />Add Student</Button>` |
| Save in modal | `<Button disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>` |
| Cancel | `<Button variant="outline">Cancel</Button>` |
| Destructive | `<Button variant="destructive">Delete Student</Button>` |
| Secondary | `<Button variant="outline">Export</Button>` |
| Inline action | `<Button variant="ghost" size="sm">` |
| Icon-only | `<Button variant="ghost" size="icon" aria-label="...">` |

### Page Structure (Admin)
```tsx
<AppLayout>
  <PageHeader title="..." description="..." actions={<Button>...</Button>} />
  {/* Filters bar */}
  {/* Stats/summary */}
  {/* Main content */}
</AppLayout>
```

### Page Structure (Portal)
```tsx
<PortalLayout>  {/* handles ChildSwitcher, bottom nav, sidebar */}
  <PageHeader title="..." actions={...} />
  {/* Main content */}
</PortalLayout>
```

### Modals
- Content/forms → `Dialog`
- Confirmations → `AlertDialog`
- Delete with checks → `DeleteValidationDialog`
- Mobile panels → `Sheet`
- AI assistant → `LoopAssistDrawer` (Drawer)

### Forms
- Labels above inputs
- Errors: `<p className="text-sm text-destructive mt-1">`
- Submit row: `<div className="flex justify-end gap-2 pt-4">Cancel | Save</div>`

---

## 10. Responsive Design

| Breakpoint | Width | Device |
|-----------|-------|--------|
| (none) | 0-639px | Phone |
| `sm:` | 640px+ | Large phone |
| `md:` | 768px+ | Tablet |
| `lg:` | 1024px+ | Desktop |
| `xl:` | 1280px+ | Wide desktop |

**Rules:**
1. Mobile-first — every layout starts at 375px and scales up
2. Touch targets: minimum 44×44px on mobile
3. Tables: horizontal scroll or card conversion on mobile
4. Modals: full-screen or bottom-sheet on mobile
5. Portal bottom nav: `h-16` with `pb-[env(safe-area-inset-bottom)]` for iOS
6. Text inputs: `text-base` (16px) on iOS to prevent zoom-on-focus
7. Portal is mobile-first — parents use phones. The mobile experience IS the experience.

---

## 11. British English & Localisation

- British spelling throughout UI copy: "organisation", "colour", "centre", "behaviour"
- Currency: £ (GBP) via `formatCurrencyMinor()` from `src/lib/utils.ts`
- Dates: dd/MM/yyyy via `formatDateUK()` from `src/lib/utils.ts`
- Time: 24-hour HH:mm via `formatTimeUK()` from `src/lib/utils.ts`
- Code variables can use US spelling (that's fine)

---

## 12. World-Class Definition

Every screen must pass ALL:
1. **No dead ends.** Clear next action on every screen.
2. **No mystery meat.** Every element's purpose is obvious.
3. **No janky transitions.** Smooth animations with defined easing.
4. **No broken states.** Loading, empty, error, success, offline — all beautiful.
5. **No inconsistency.** Same action = same look everywhere.
6. **No accessibility gaps.** Keyboard nav, screen reader, ARIA roles.
7. **No clutter.** Remove what doesn't serve the user.
8. **No ugly mobile.** Mobile is designed, not reflowed.
9. **Delightful details.** Subtle animations, smart defaults, helpful empty states.
10. **Stripe-tier quality.** Users should feel like they're using premium software.
