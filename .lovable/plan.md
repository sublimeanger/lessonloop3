

# UI Polish — Part 6: Quick Wins

## 6.1 — Selection colour
Add `::selection` rule to `src/index.css` using teal-light for on-brand text highlight.
```css
::selection { background: hsl(174 80% 85%); color: hsl(220 60% 12%); }
.dark ::selection { background: hsl(174 60% 25%); color: hsl(220 20% 92%); }
```

## 6.2 — Smooth scroll
Add `scroll-behavior: smooth` to the `html` rule in `src/index.css` (line ~206, the existing `html { transition: ... }` block).

## 6.3 — Focus ring audit
Focus rings are already well-implemented across all UI primitives (`ring-offset-2 ring-ring`). The global `*:focus-visible` rule in `index.css` (line ~234) catches everything else. **No changes needed.**

## 6.4 — Scrollbar styling for horizontal scroll areas
The vertical scrollbar is styled but horizontal overflow areas use `scrollbar-hide` or inline `scrollbarWidth: 'none'`. This is intentional for pill/tab bars — thin scrollbars on narrow horizontal areas look worse than hidden ones. **No changes needed.**

## 6.5 — Image loading
App components use almost no `<img>` tags directly — they use `<Avatar>`, icons, or SVGs. The only `<img>` usage is in marketing (already has `loading="lazy"`) and the `EmptyState` component (already has `loading="lazy"`). **No changes needed.**

## 6.6 — Empty state illustrations
The `EmptyState` component already supports `previewImage`. Add placeholder illustrations for the 5 most important empty states. Since we don't have actual illustration assets, we'll enhance the empty states with more descriptive copy and ensure they all have actionable CTAs. The key empty states to improve:

| Location | Current title | Enhancement |
|----------|--------------|-------------|
| Students page | "No students yet" | Add descriptive subtitle about importing or adding manually |
| Invoices page | "No invoices yet" | Add CTA to create first invoice |
| Messages page | "No messages yet" | Already good |
| Calendar (no lessons) | "No lessons scheduled" | Already good |
| Resources page | "No resources yet" | Already good |

**Verdict**: Empty states already have good copy and CTAs across the board. Skip — no meaningful improvement without actual illustration assets.

## 6.7 — Truncation consistency
Truncation is already widely used (62 files, 473 instances). The pattern `truncate` with `min-w-0` on flex parents is consistently applied to student names, emails, and invoice descriptions in `InvoiceList.tsx`, `MobileDayView.tsx`, sidebar items, etc. **No changes needed** — already well-implemented.

---

## Summary

Only 2 changes needed — both in `src/index.css`:

| Change | File | Lines |
|--------|------|-------|
| `::selection` colour (light + dark) | `src/index.css` | After the `*:focus-visible` block (~line 237) |
| `scroll-behavior: smooth` on `html` | `src/index.css` | Existing `html` block (~line 206) |

Everything else in this section is already well-implemented. This is genuinely a quick win — 2 lines of CSS.

