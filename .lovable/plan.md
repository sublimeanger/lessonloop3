

# Implementation Plan: 25 Remaining Marketing Pages

This is a large build covering 25 pages across 6 categories. Following the brief's recommended build order, I will break this into **6 runs**.

---

## Run 1: About + Contact SEO upgrades + Legal meta upgrades (Parts A, B, F)

**5 pages — quick SEO upgrades only, no new pages.**

### About (`/about`) — SEO upgrade
- Create `src/components/marketing/about/AboutSchema.tsx` with Organization + BreadcrumbList JSON-LD (inline `<script>` blocks)
- Update `usePageMeta` in `About.tsx`: title, description, OG tags, canonical, robots
- Import and render `<AboutSchema />`
- Update hero subheadline: add "music school management software" and "UK"
- Update "What We Solve" H2 to "Designed to solve the real problems music teachers face"
- Add `<Link>` below each pain point card: Scheduling → `/features/scheduling`, Billing → `/features/billing`, Communication → `/features/parent-portal`
- Add links in Contact CTA section: "See pricing →" → `/pricing`, "Built for UK schools →" → `/uk`

### Contact (`/contact`) — SEO upgrade
- Create `src/components/marketing/contact/ContactSchema.tsx` with ContactPage + BreadcrumbList JSON-LD
- Update `usePageMeta`: title, description, OG tags, canonical
- Import and render `<ContactSchema />`

### Legal pages (Privacy, Terms, GDPR) — meta-only upgrades
- Update `usePageMeta` calls in all three pages with new titles, descriptions, canonical URLs, robots
- Add inline BreadcrumbList `<script>` block to each page (directly in JSX, no separate component needed for these small changes)

**Files created:** 2 (AboutSchema, ContactSchema)
**Files modified:** 5 (About, Contact, Privacy, Terms, GDPR)

---

## Run 2: Feature pages 1–4 (Scheduling, Billing, Parent Portal, LoopAssist)

**4 net-new pages + 7 shared template components.**

### Shared components (created once, reused by all 12 feature pages)
Create in `src/components/marketing/feature-page/`:
- `FeaturePageHero.tsx` — badge, H1, subheadline, CTAs (props-driven)
- `FeaturePageProblem.tsx` — H2 + 3 pain point cards (props-driven)
- `FeaturePageSolution.tsx` — H2 + 4-6 feature cards grid (props-driven)
- `FeaturePageHowItWorks.tsx` — H2 + 3 numbered steps (props-driven)
- `FeaturePageRelated.tsx` — H2 + 3 related feature cards with `<Link>` (props-driven)
- `FeaturePageCTA.tsx` — dark bg CTA section (props-driven)
- `FeaturePageSchema.tsx` — SoftwareApplication + BreadcrumbList + FAQPage JSON-LD (props-driven)

### Page files
Create in `src/pages/marketing/features/`:
- `FeatureScheduling.tsx` — `/features/scheduling`
- `FeatureBilling.tsx` — `/features/billing`
- `FeatureParentPortal.tsx` — `/features/parent-portal`
- `FeatureLoopAssist.tsx` — `/features/loopassist`

### Routes
Add all 4 routes to `src/config/routes.ts` with lazy imports.

Each page passes its spec data (title, description, H1, pain points, solution features, steps, FAQ, related features) as props to the shared components.

**Files created:** 11 (7 shared components + 4 page files)
**Files modified:** 1 (routes.ts)

---

## Run 3: Feature pages 5–8 (Students, Teachers, Attendance, Practice Tracking)

**4 net-new pages reusing the shared template from Run 2.**

Create in `src/pages/marketing/features/`:
- `FeatureStudents.tsx` — `/features/students`
- `FeatureTeachers.tsx` — `/features/teachers`
- `FeatureAttendance.tsx` — `/features/attendance`
- `FeaturePracticeTracking.tsx` — `/features/practice-tracking`

Add 4 routes to `routes.ts`.

**Files created:** 4
**Files modified:** 1 (routes.ts)

---

## Run 4: Feature pages 9–12 (Messaging, Reports, Locations, Resources)

**4 net-new pages reusing the shared template.**

Create in `src/pages/marketing/features/`:
- `FeatureMessaging.tsx` — `/features/messaging`
- `FeatureReports.tsx` — `/features/reports`
- `FeatureLocations.tsx` — `/features/locations`
- `FeatureResources.tsx` — `/features/resources`

Add 4 routes to `routes.ts`.

**Files created:** 4
**Files modified:** 1 (routes.ts)

---

## Run 5: 5 Comparison pages

**5 net-new pages + 7 shared comparison components.**

### Shared components
Create in `src/components/marketing/compare/`:
- `CompareHero.tsx` — H1, subheadline, two badges, CTA
- `CompareTable.tsx` — tick/cross feature comparison table (responsive)
- `CompareDifferentiators.tsx` — 3-4 differentiator cards
- `CompareWhySwitch.tsx` — 3 reason cards + migration CTA
- `CompareFAQ.tsx` — accordion FAQ
- `CompareCTA.tsx` — dark bg CTA
- `CompareSchema.tsx` — BreadcrumbList + FAQPage JSON-LD

### Page files
Create in `src/pages/marketing/compare/`:
- `VsMyMusicStaff.tsx` — `/compare/lessonloop-vs-my-music-staff`
- `VsTeachworks.tsx` — `/compare/lessonloop-vs-teachworks`
- `VsOpus1.tsx` — `/compare/lessonloop-vs-opus1`
- `VsJackrabbitMusic.tsx` — `/compare/lessonloop-vs-jackrabbit-music`
- `VsFons.tsx` — `/compare/lessonloop-vs-fons`

Add 5 routes to `routes.ts`. Each page includes internal links to `/features`, `/pricing`, `/uk`, and cross-links to other comparison pages.

**Files created:** 12 (7 shared + 5 pages)
**Files modified:** 1 (routes.ts)

---

## Run 6: 5 Use Case pages

**5 net-new pages + shared use case components.**

### Shared components
Create in `src/components/marketing/use-case/`:
- `UseCaseHero.tsx`
- `UseCasePainPoints.tsx`
- `UseCaseFeatures.tsx` — each feature card links to its feature page via `<Link>`
- `UseCaseSocialProof.tsx`
- `UseCasePricing.tsx`
- `UseCaseCTA.tsx`
- `UseCaseSchema.tsx` — BreadcrumbList + SoftwareApplication JSON-LD

### Page files
Create in `src/pages/marketing/use-cases/`:
- `MusicAcademies.tsx` — `/for/music-academies`
- `SoloTeachers.tsx` — `/for/solo-teachers`
- `PianoSchools.tsx` — `/for/piano-schools`
- `GuitarSchools.tsx` — `/for/guitar-schools`
- `PerformingArts.tsx` — `/for/performing-arts`

Add 5 routes to `routes.ts`. Each page links to 3-4 feature pages + `/pricing` + `/features`.

**Files created:** 12 (7 shared + 5 pages)
**Files modified:** 1 (routes.ts)

---

## Cross-cutting rules (all runs)

- All internal links use `<Link>` from `react-router-dom` with keyword-rich anchor text
- All links to future routes are implemented even if the destination does not exist yet
- All JSON-LD rendered as inline `<script type="application/ld+json">` in JSX (no useEffect, no Helmet)
- All components self-contained (no global state/context for content)
- Framer-motion for animations (progressive enhancement)
- Tailwind CSS utilities only
- Brand system: DM Sans, ink/teal/coral/violet/emerald, shadcn/ui

---

## Summary

| Run | Pages | New files | Modified files |
|-----|-------|-----------|----------------|
| 1 | About, Contact, Privacy, Terms, GDPR | 2 | 5 |
| 2 | Scheduling, Billing, Parent Portal, LoopAssist + shared template | 11 | 1 |
| 3 | Students, Teachers, Attendance, Practice Tracking | 4 | 1 |
| 4 | Messaging, Reports, Locations, Resources | 4 | 1 |
| 5 | 5 Comparison pages + shared template | 12 | 1 |
| 6 | 5 Use Case pages + shared template | 12 | 1 |
| **Total** | **25 pages** | **45 files** | **10 edits** |

