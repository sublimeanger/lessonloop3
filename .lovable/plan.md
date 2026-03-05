

# UI Polish — Part 5: Visual Consistency Sweep

## Scope Assessment

After auditing the codebase, this part has **massive surface area** — 171 files with `rounded-lg`, 110 files with raw shadows, 49 files with `bg-white`. A full sweep in one pass would touch 100+ files and risk regressions. I recommend a **tiered approach**: fix the systemic issues (UI primitives, status badges, dark mode violations) first, then do a broader sweep of app pages.

Marketing pages are excluded entirely — they use intentional dark-theme patterns (`bg-white/[0.03]`, glassmorphic cards) and will be migrated to static HTML.

---

## 5.1 — Border Radius (scoped to UI primitives + high-traffic pages)

**UI components to update** (these cascade everywhere):

| File | Current | Change |
|------|---------|--------|
| `ui/dialog.tsx` | `rounded-lg` on content | → `rounded-xl` |
| `ui/alert-dialog.tsx` | `sm:rounded-lg` | → `sm:rounded-xl` |
| `ui/alert.tsx` | `rounded-lg` in cva | → `rounded-xl` |
| `ui/chart.tsx` | `rounded-lg` on tooltip | → `rounded-xl` |
| `ui/button.tsx` | `rounded-lg` on xl size | Keep — buttons use `rounded-md` by default, `rounded-lg` on xl is fine |
| `ui/sidebar.tsx` | `rounded-lg` on floating variant | Keep — sidebar-specific |

**App pages** — replace `rounded-lg` with `rounded-xl` on container/card-like elements in the most-used pages:
- `Students.tsx` (filter pill container)
- `Locations.tsx` (filter pills, room cards, dialog overrides)
- `Practice.tsx` (stat icon containers, assignment rows)
- `Continuation.tsx` (bulk actions bar, table wrapper, past run rows)
- `AcceptInvite.tsx` (warning box)

**App components** — top 10 most-used:
- `MessageRequestsList.tsx` (message bubbles, lesson details)
- `ThreadCard.tsx` (skeleton, email toggle)
- `TeacherQuickView.tsx` (stats bar, student rows)
- `StudentLessonNotes.tsx` (note cards)
- `MessageFiltersBar.tsx` (toggle items, clear button)

~15 files, ~60 individual replacements. Leave remaining files for a follow-up sweep.

## 5.2 — Shadow Hierarchy (UI primitives only)

Raw Tailwind shadows (`shadow-sm`, `shadow-md`, `shadow-lg`) are used in 110 files — mostly marketing. For app components, the custom `shadow-card`, `shadow-elevated`, etc. are already used in the right places.

**Changes**: Only fix the UI primitives where `shadow-lg` should be `shadow-elevated`:
- `ui/dialog.tsx`: `shadow-lg` → `shadow-elevated-lg`
- `ui/alert-dialog.tsx`: `shadow-lg` → `shadow-elevated-lg`

App page shadows are mostly `shadow-sm` on filter pills and toggles — these are fine as-is. Marketing page shadows stay untouched.

## 5.3 — Status Badge Colour Consistency

**Files with hardcoded status colours instead of semantic tokens:**

| File | Issue | Fix |
|------|-------|-----|
| `LeadDetail.tsx` | Uses `bg-gray-100 text-gray-600` for "lost" | → `bg-muted text-muted-foreground` |
| `LeadDetail.tsx` | Uses `bg-purple-100 text-purple-800` for "trial_completed" | → `bg-violet-light text-violet-dark` |
| `LeadDetail.tsx` | Uses `bg-emerald-100 text-emerald-800` for "enrolled" | → `bg-emerald-light text-emerald-dark` |
| `WaitlistEntryDetail.tsx` | Same pattern — `bg-gray-100`, `bg-green-100`, `bg-red-100` | → semantic tokens |
| `EnrolmentWaitlistPage.tsx` | Same pattern | → semantic tokens |
| `WaitlistActivityTimeline.tsx` | `text-gray-500 bg-gray-500/10` | → `text-muted-foreground bg-muted` |
| `CalendarSyncHealth.tsx` | `bg-gray-400` for disabled dot | → `bg-muted-foreground` |

~5 files, ~15 colour replacements.

## 5.4 — Icon Sizing

This is too broad to audit comprehensively (hundreds of icons). **Skip for this pass** — icon sizes are already largely consistent within their contexts. Flag for future design system lint rule.

## 5.5 — Divider/Separator Consistency

Also too broad. The existing patterns are acceptable — `border-b`, `divide-y`, and `<Separator>` are all used appropriately in context. **Skip for this pass.**

## 5.6 — Dark Mode Violations

**App component `bg-white` violations** (marketing excluded):

| File | Issue | Fix |
|------|-------|-----|
| `SendInvoiceModal.tsx` | `bg-white` on email preview | → `bg-background` |
| `CalendarIntegrationsTab.tsx` | `bg-white` on Google icon container | → `bg-background` |
| `PortalHome.tsx` (×2) | `bg-white dark:bg-background` | Already has dark fallback ✓ — no change |
| `InvoicePreview.tsx` | `bg-white` | Intentional — invoice preview mimics paper ✓ — no change |

**`text-gray-` / `bg-gray-` violations:**

| File | Issue | Fix |
|------|-------|-----|
| `InvoicePreview.tsx` | Heavy use of `text-gray-*`, `bg-gray-*`, `border-gray-*` | Intentional print/paper styling — skip |
| `CalendarSyncHealth.tsx` | `bg-gray-400`, `text-gray-500` | → `bg-muted-foreground`, `text-muted-foreground` |
| All status badge files (5.3) | Covered above | — |

~4 files for dark mode fixes.

---

## Summary

| Category | Files | Changes |
|----------|-------|---------|
| 5.1 Border radius (UI + top pages) | ~15 | ~60 `rounded-lg` → `rounded-xl` |
| 5.2 Shadows (UI primitives) | 2 | Dialog + AlertDialog shadow upgrade |
| 5.3 Status badges | 5 | ~15 hardcoded colours → semantic tokens |
| 5.6 Dark mode | 4 | `bg-white` → `bg-background`, `gray-*` → semantic |

**Total: ~26 files, ~80 individual changes.**

Items 5.4 (icon sizing) and 5.5 (dividers) deferred — too broad for meaningful impact without a design system linting tool.

