

# Homepage Build Brief Implementation Plan

After comparing the uploaded brief against the current codebase, the following deltas need to be addressed. Many SEO elements (JSON-LD, OG tags, scroll target, internal links) are already implemented from the previous round. The remaining changes are primarily **content/copy updates** and a few structural tweaks.

---

## Changes Required

### 1. `src/components/marketing/HeroSection.tsx` — Copy & Structure Updates

| Element | Current | Brief Requires |
|---|---|---|
| Height | `min-h-[85vh]` | `min-h-[90vh]` |
| Badge text | "Now with payment plans, practice tracking & resource library" | "🇬🇧 Built for UK Music Schools" |
| H1 | "Teach more. Admin less." | "The modern way to run your music school" |
| Subheadline | "Scheduling, invoicing, parent portal..." | "Schedule lessons, automate invoicing, track attendance, and keep parents in the loop — all from one beautifully simple platform." |
| Trust line items | "Built for UK music educators", "30-day free trial", "No credit card needed", "From £12/month" | "Free for 30 days", "No credit card required", "Set up in under 5 minutes" |
| Dashboard alt text | Current alt | "LessonLoop music school management software dashboard showing lesson scheduling, invoices, and student management" |

The H1 change is significant — the brief targets "music school" in the H1 for semantic keyword relevance.

### 2. `src/components/marketing/ProductShowcase.tsx` — H2 & Subheading

| Element | Current | Brief Requires |
|---|---|---|
| Badge text | "Product Tour" | "The Platform" |
| H2 | "See it in action" | "Everything you need. Nothing you don't." |
| Subheading | "Explore the key features..." | "LessonLoop replaces your scheduling spreadsheet, invoicing software, messaging apps, and admin notebooks with one integrated music school management platform." |
| AI tab description | "Your intelligent teaching assistant" | "Your intelligent music school co-pilot" |
| AI tab features | 4 items | 5 items (add "Works across scheduling, billing, practice and attendance") |
| Calendar features | Current list | Update to match brief (add "Teacher availability matching", reword items) |
| Invoicing features | Current list | Update to match brief wording |
| Students features | Current list | Add "Notes and lesson history" |
| Make-Ups description | "Automatic make-up lesson matching" | "Never lose revenue from cancellations" |
| Practice features | Current list | Update wording per brief |

### 3. `src/components/marketing/AISpotlight.tsx` — Subheading & Link

| Element | Current | Brief Requires |
|---|---|---|
| Subheading copy | "Ask questions in plain English. Get instant answers..." | "Ask questions about your school in plain English. LoopAssist analyses your data and takes action — with your permission. Included on every plan at no extra cost." |
| Internal link | Missing | Add "Explore LoopAssist →" linking to `/features/loopassist` below the bottom statement |

### 4. `src/components/marketing/HowItWorks.tsx` — Bottom CTA Copy

| Element | Current | Brief Requires |
|---|---|---|
| Bottom CTA text | "Ready to simplify your teaching practice?" | "Ready to simplify your teaching admin?" |

### 5. `src/components/marketing/HomepageSchema.tsx` — Schema Enhancement

The brief's SoftwareApplication schema includes two extra fields vs current:
- `"screenshot": "https://lessonloop.co.uk/og-home.png"`
- Nested `offers` array inside the AggregateOffer with a Free Trial offer object
- `"sameAs": []` in Organization schema

### 6. `index.html` + `usePageMeta.ts` — Robots Directive Update

| Element | Current | Brief Requires |
|---|---|---|
| robots meta | `index, follow` | `index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1` |

### 7. `src/pages/marketing/Home.tsx` — OG Tags Enhancement

The `usePageMeta` call currently passes OG tags but the brief also specifies `og:image:width` (1200) and `og:image:height` (630) — need to verify these are in `index.html` (they are) but the dynamic hook doesn't set them. Minor gap, acceptable since they're in the static HTML.

---

## Files to Modify (7)

1. **`src/components/marketing/HeroSection.tsx`** — H1, badge, subheadline, trust line, height, alt text
2. **`src/components/marketing/ProductShowcase.tsx`** — H2, subheading, badge, tab descriptions and features
3. **`src/components/marketing/AISpotlight.tsx`** — Subheading copy, add internal link
4. **`src/components/marketing/HowItWorks.tsx`** — Bottom CTA text
5. **`src/components/marketing/HomepageSchema.tsx`** — Add screenshot field, nested offer, sameAs
6. **`index.html`** — Update robots directive
7. **`src/hooks/usePageMeta.ts`** — No changes needed (robots passed per-page)

No new files, no new dependencies, no database changes. All changes are copy and content updates.

