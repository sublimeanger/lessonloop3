

# Homepage Revamp Plan

## Current State Assessment

The homepage has 12 sections in this order:
1. **HeroSection** — dark bg, "Teach more. Admin less.", dashboard screenshot
2. **CredibilityStrip** — 4 plain text badges (minimal, underwhelming)
3. **BeforeAfter** — pain/solution comparison
4. **AISpotlight** — LoopAssist chat demo
5. **ProductShowcase** — tabbed screenshot tour (5 tabs)
6. **BentoFeatures** — bento grid of features
7. **UKDifferentiator** — 6 UK-specific cards
8. **AudiencePaths** — Solo/Studio/Academy cards
9. **HowItWorks** — 4 steps
10. **FounderStory** — quote card
11. **StatsCounter** — 4 stats on dark bg
12. **CTASection** — final CTA with form

### Problems
- **Too many sections** (12) — creates scroll fatigue before the CTA
- **Redundancy** — BentoFeatures and ProductShowcase overlap heavily; AudiencePaths duplicates pricing page content
- **CredibilityStrip** is plain text with emoji flags — looks amateur for a "world-class" marketing page
- **Stats are weak** — "50+ Features" and "Zero spreadsheets" aren't compelling social proof (no real user numbers yet, but can reframe)
- **No testimonials/social proof section** — even pre-launch, placeholder quotes or "Founding Teacher" programme callout would help
- **BeforeAfter** is text-heavy and visually flat
- **StatsCounter** uses floating music notes (♪ ♫) — feels gimmicky
- **Missing features from copy**: payment plans/installments, practice tracking, resource library, booking pages, exam board tracking, custom branding — all built but not mentioned
- **No video or motion demo** — the "See how it works" button goes to /features, not a video
- **Mobile**: sections are too tall on mobile, especially HeroSection (min-h-screen forces scroll)

## Revamp Strategy

Reduce from 12 sections to 9, tighten copy, add missing features, and elevate visual polish.

### New Section Order

```text
1. HeroSection (refreshed)
2. SocialProofStrip (replaces CredibilityStrip)
3. ProblemSolution (replaces BeforeAfter — visual upgrade)
4. ProductShowcase (consolidated, updated tabs)
5. AISpotlight (refined copy)
6. UKDifferentiator (kept, tightened)
7. HowItWorks (kept, minor copy updates)
8. FounderStory (kept)
9. CTASection (kept)
```

**Removed**: BentoFeatures (merged into ProductShowcase), AudiencePaths (belongs on /pricing), StatsCounter (weak without real data — stats folded into HeroSection trust strip).

---

### Section-by-Section Changes

#### 1. HeroSection — Refresh
- **Headline**: Keep "Teach more. Admin less." — it's strong
- **Sub-headline update**: "Scheduling, invoicing, parent portal, practice tracking, and an AI assistant — purpose-built for UK music educators."
- **Badge update**: "Now with payment plans, practice tracking & resource library" (highlight new features)
- **Trust indicators**: Add "From £12/month" alongside existing "30-day free trial" and "No credit card"
- **Dashboard screenshot**: Keep, but add subtle animated annotations (pointer hotspots) highlighting key UI areas
- **Mobile fix**: Change `min-h-screen` to `min-h-[85vh]` so content doesn't feel trapped

#### 2. SocialProofStrip (replaces CredibilityStrip)
- Replace emoji-text badges with proper icon + label cards in a horizontal scroll
- Content: "Built in the UK" (flag icon), "GDPR Compliant" (shield), "Stripe Payments" (credit card), "AI-Powered" (sparkles), "30-Day Free Trial" (clock), "From £12/mo" (pound)
- Subtle background: `bg-muted/30` with border top/bottom
- Animated entrance with stagger

#### 3. ProblemSolution (replaces BeforeAfter)
- Keep the before/after concept but make it visually richer
- **Before column**: Red-tinted card with X icons (keep items but update):
  - Add "No way to track student practice"
  - Add "Printing invoices or using generic software"
- **After column**: Green-tinted card with check icons (update):
  - Add "Payment plans with automatic installment tracking"
  - Add "Practice assignments with streak tracking"
  - Add "Resource library for sharing materials"
  - Update "Bulk invoice generation in clicks" → "Termly billing runs with payment plans"
- Visual polish: Cards get subtle gradient borders and shadow on hover

#### 4. ProductShowcase — Consolidated & Updated
- **Add new tabs**: "Practice" and "Resources" alongside existing AI/Calendar/Invoicing/Students/Make-Ups
- **Update feature lists per tab**:
  - Calendar: Add "Closure date management", "Teacher availability"
  - Invoicing: Add "Payment plans & installments", "Overdue cron automation"
  - Students: Add "Exam board tracking", "Instrument & grade management"
  - AI: Add "Revenue insights", "Attendance summaries"
  - Make-Ups: Keep as-is
  - Practice (new): "Create assignments", "Streak tracking", "Parent visibility"
  - Resources (new): "Upload audio/PDF/video", "Category organisation", "Share with students"
- Use existing screenshots where available; for new tabs use the parent-portal screenshot as placeholder
- This section absorbs what BentoFeatures was doing, eliminating redundancy

#### 5. AISpotlight — Copy Refinement
- Update query chips to include new capabilities:
  - "What's my revenue this term?" (keep)
  - "Who has overdue installments?" (new — reflects payment plans)
  - "Draft a practice reminder for parents" (new)
  - "Show attendance for this week" (new)
- Add a 4th feature bullet: "Works across scheduling, billing, practice & attendance"
- Remove "No competitors offer an AI assistant" claim (can't verify, sounds aggressive)

#### 6. UKDifferentiator — Tighten
- Keep all 6 cards, update descriptions to be punchier (single sentence each)
- Update founder quote to something more specific about the product

#### 7. HowItWorks — Minor Updates
- Step 1: Add "Configure rate cards and payment plans"
- Step 4: Update to "Let LoopAssist handle reminders, reports and routine tasks"
- Keep the animated connecting line — it's effective

#### 8. FounderStory — Keep As-Is
- The quote and design are solid

#### 9. CTASection — Keep As-Is  
- Already handles logged-in vs logged-out states well

---

### Technical Implementation

**Files to modify:**
1. `src/pages/marketing/Home.tsx` — Remove BentoFeatures, AudiencePaths, StatsCounter imports/usage
2. `src/components/marketing/CredibilityStrip.tsx` — Full rewrite → SocialProofStrip with icons and animation
3. `src/components/marketing/BeforeAfter.tsx` — Update content arrays, add visual polish (gradient borders, shadows)
4. `src/components/marketing/HeroSection.tsx` — Update sub-headline, badge text, trust indicators, fix mobile height
5. `src/components/marketing/ProductShowcase.tsx` — Add Practice and Resources tabs, update all feature lists
6. `src/components/marketing/AISpotlight.tsx` — Update query chips and features, remove competitor claim
7. `src/components/marketing/UKDifferentiator.tsx` — Tighten descriptions
8. `src/components/marketing/HowItWorks.tsx` — Update step descriptions

**Files removed from homepage** (kept in codebase for /features page):
- `BentoFeatures.tsx` — still used on /features
- `AudiencePaths.tsx` — still used on /pricing  
- `StatsCounter.tsx` — can be reused elsewhere

**No new dependencies needed.** All changes use existing Framer Motion, Lucide icons, and Tailwind utilities.

**Estimated scope**: ~8 file edits, no database changes, no new components to create (SocialProofStrip is a rewrite of CredibilityStrip).

