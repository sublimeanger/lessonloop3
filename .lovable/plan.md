

# Kickstarter Pre-Launch Landing Page

## Overview

Create a world-class `/kickstarter` landing page with email signup, 6 backer tiers, a live countdown timer, the full campaign story, and a risks section. The page will reuse the existing marketing design system (gradient backgrounds, motion animations, glass-morphism cards) and product screenshots from `src/assets/marketing/`.

## Page Sections (top to bottom)

### 1. Hero with Countdown
- Dark gradient background matching the existing Hero style (ink + teal/coral mesh)
- Headline: "Help Us Launch LessonLoop" with animated word reveal
- Subheadline about the mission
- Live countdown timer to June 1, 2026 (configurable target date) showing days/hours/minutes/seconds
- Email signup form (name + email) stored in a new `kickstarter_signups` database table
- Trust badges: "All-or-nothing | £18,500 goal | June 2026"

### 2. The Story (Campaign Narrative)
- Lauren's 20-year journey section with the "LT" avatar motif (reused from CTASection)
- Three-act structure: The Problem, The Journey, The Solution
- Product screenshots from `src/assets/marketing/` (dashboard-hero.jpg, calendar-week.jpg, invoices-list.jpg, parent-portal.jpg, loopassist-chat.jpg) displayed in browser frames
- Key stats: 300 students, 10 teachers, 20 years of experience

### 3. What You Get (Product Features Summary)
- Bento-style grid showing core features: Scheduling, Invoicing, Parent Portal, LoopAssist AI, Practice Tracking
- Reuses the visual style from BentoFeatures

### 4. Backer Tiers
- 6 reward cards in a responsive grid (2x3 on desktop, stacked on mobile):
  - **Supporter** - £5: Name on the supporters wall, early updates
  - **Teacher Early Bird** - £49: 1 year Teacher plan (save £95), founding member badge
  - **Studio Early Bird** - £149: 1 year Studio plan (save £199), founding member badge, priority onboarding
  - **Lifetime Teacher** - £199: Lifetime Teacher plan, founding member badge, name on supporters wall
  - **Lifetime Studio** - £399: Lifetime Studio plan, founding member badge, priority support, name on supporters wall
  - **Champion** - £500: Lifetime Studio plan, 1-hour strategy call, logo on partners page, everything above
- Popular badge on "Teacher Early Bird"
- Each card shows: price, title, what's included, estimated delivery, limited quantity indicators where appropriate

### 5. Why Kickstarter
- Clean section explaining: platform is built and ready, funds go to infrastructure scaling, mobile app, and AI enhancements
- Three columns: Infrastructure, Mobile App, AI Enhancement

### 6. Risks and Challenges
- Honest, transparent section covering:
  - Core platform already functional (mitigates vaporware risk)
  - Third-party API dependencies
  - Infrastructure scaling
  - AI accuracy (human-in-the-loop confirmation)
- Glass-morphism cards with warning/shield icons

### 7. FAQ
- Accordion-style FAQ section with 6-8 common questions
- Reuses Radix Accordion component

### 8. Final CTA
- Repeated email signup form
- Countdown timer (smaller)
- "Be the first to know when we launch"

## Technical Details

### New Files
- `src/pages/marketing/Kickstarter.tsx` - Main page component (composed of sub-sections)
- `src/components/marketing/kickstarter/KickstarterHero.tsx` - Hero + countdown + email form
- `src/components/marketing/kickstarter/CampaignStory.tsx` - The narrative section
- `src/components/marketing/kickstarter/BackerTiers.tsx` - Reward tier cards
- `src/components/marketing/kickstarter/RisksSection.tsx` - Risks and challenges
- `src/components/marketing/kickstarter/KickstarterFAQ.tsx` - FAQ accordion
- `src/components/marketing/kickstarter/CountdownTimer.tsx` - Reusable countdown hook + display

### Modified Files
- `src/App.tsx` - Add `/kickstarter` public route
- Database migration - Create `kickstarter_signups` table (id, email, name, created_at) with RLS policy allowing anonymous inserts

### Design Approach
- Reuses all existing marketing patterns: `MarketingLayout`, `motion` animations, gradient backgrounds, glass-morphism cards
- Product imagery from `src/assets/marketing/` displayed in `BrowserFrame`-style containers
- Countdown uses `useEffect` + `setInterval` with `date-fns` for time calculations
- Email signup writes to database via Supabase client (no edge function needed for simple insert)
- Fully responsive: mobile-first grid layouts
- No videos as requested

