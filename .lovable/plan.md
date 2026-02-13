

# Replace Marketing Screenshots with Real Product Captures

## Problem
The Kickstarter campaign story section currently uses placeholder/AI-generated images from `src/assets/marketing/`. These don't match the actual product UI. We need to replace them with the real screenshots captured from the live demo account.

## Screenshots Captured
Five authentic screenshots from the Harmony Music Education Agency demo account:

1. **Dashboard** - Command center with 300 students, 263 lessons this week, £41,227 outstanding, urgent actions bar
2. **Calendar** - Weekly view for February 2026 with 50+ daily lessons, teacher colour coding, filters
3. **Invoices** - Invoice management with stats cards (Outstanding, Overdue, Drafts, Paid YTD), invoice list with statuses
4. **Students** - Student list with search, active badges, avatar initials
5. **LoopAssist** - AI assistant intro modal showing capabilities (Ask Questions, Request Actions, Confirm Before Acting)

## Implementation Steps

1. **Save the 5 browser screenshots** as new high-quality `.png` files in `src/assets/marketing/`:
   - `dashboard-hero.png` (replaces existing `dashboard-hero.jpg`)
   - `calendar-week.png` (replaces existing `calendar-week.jpg`)
   - `invoices-list.png` (replaces existing `invoices-list.jpg`)
   - `loopassist-chat.png` (replaces existing `loopassist-chat.jpg`)
   - `students-list.png` (new, for potential use)

2. **Update `src/assets/marketing/index.ts`** to export the new `.png` files instead of the old `.jpg` ones

3. **Update `src/components/marketing/kickstarter/CampaignStory.tsx`** to reference the updated imports (the import names stay the same, just the underlying files change)

4. **Update any other marketing components** that reference the old `.jpg` assets (e.g., `HeroSection`, `ProductShowcase`) to use the new real screenshots

## Technical Notes
- The screenshots are captured at 1280x720 resolution which is ideal for browser-frame mockups
- PNG format preserves the crisp text and UI elements better than JPG
- No code logic changes needed -- only asset file swaps and import path updates
- The `BrowserFrameLight` wrapper in `CampaignStory.tsx` already handles the chrome decoration around the images

