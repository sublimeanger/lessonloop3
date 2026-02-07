

# Replace Fake Marketing Imagery with Real Product Screenshots

## The Problem

The marketing site uses a mix of:
1. **AI-generated `.jpg` screenshots** (in `src/assets/marketing/`) -- these are genuinely fake and should be replaced
2. **Hand-coded JSX mockups** (ProductShowcase, BentoFeatures, deep-dive sections) -- these are actually faithful recreations of the real UI using the same design system, and work well as interactive demos
3. **One remaining fake testimonial** in PortalDeepDive from "Sarah C." that was missed in the previous cleanup

## Constraint: Authenticated Screenshots

The real product pages (Dashboard, Calendar, Invoices, etc.) require user login. I cannot authenticate into the app in the browser tool because there are no test credentials available. This means I cannot capture real screenshots of the live product right now.

## What I Can Do Right Now

### 1. Remove the fake hero screenshot and replace with the interactive mockup approach
The `dashboard-hero.jpg` in the HeroSection is an AI-generated image that doesn't match the real product. Rather than showing a fake static screenshot, I'll replace it with a polished interactive mockup (similar to what ProductShowcase already does well) that accurately represents the real dashboard UI. This is honest -- it's showing what the product actually looks like using the real design system.

### 2. Remove the fake testimonial in PortalDeepDive
"Sarah C., Piano Teacher, London" is a fabricated quote that was missed in the earlier cleanup. This needs to be removed or replaced with Lauren's perspective on why the parent portal was important to build.

### 3. Clean up the `.jpg` assets
Remove the AI-generated images from `src/assets/marketing/` since they're misleading. The interactive JSX mockups are a better, more honest approach.

## What You Should Do (For Real Screenshots)

For genuine product screenshots, you would need to:
- Log into the app yourself in a browser
- Navigate to the Dashboard, Calendar, Invoices, Portal, etc.
- Take screenshots at each page
- Upload those screenshots to me via the chat (using the attach/upload button)
- I'll then replace the mockups with your real screenshots wrapped in the BrowserFrame component

This is the only way to get authentic product imagery since the system requires authentication that I don't have access to.

## File Changes

### 1. `src/components/marketing/HeroSection.tsx`
- Remove the `dashboardHero` image import
- Replace the static `<img>` with an interactive dashboard mockup (using the same approach as ProductShowcase) that shows a realistic today-view with lesson schedule, stats, and quick actions -- all matching the real product's design

### 2. `src/components/marketing/features/PortalDeepDive.tsx`
- Remove the fake "Sarah C." testimonial block (lines 106-127)
- Replace with a brief founder note: why Lauren built the parent portal (reducing "what time is the lesson?" messages and payment chasing)

### 3. `src/components/marketing/features/BillingDeepDive.tsx`
- Remove the "6 hours saved per month on billing" floating stat card (lines 192-204) -- this is an unsubstantiated claim that was missed in the earlier cleanup

### 4. `src/assets/marketing/index.ts`
- Remove the `dashboardHero` export (no longer used)
- Keep the other assets in case they're needed later, but they're not currently referenced anywhere except this index file

## Summary

| Change | File | What |
|---|---|---|
| Replace fake hero screenshot | HeroSection.tsx | Swap AI-generated jpg for interactive JSX mockup |
| Remove fake testimonial | PortalDeepDive.tsx | Remove "Sarah C." quote, add founder note |
| Remove unsubstantiated stat | BillingDeepDive.tsx | Remove "6 hours saved" floating card |
| Clean up unused import | assets/marketing/index.ts | Remove dashboardHero export |

**4 files changed. No database or backend changes.**

---

## Important Note for Real Screenshots

The interactive JSX mockups across the site (ProductShowcase, BentoFeatures, deep-dives) are actually a strong approach -- they're built from the real design system and give visitors an interactive feel. But if you want to add actual product screenshots alongside them, please capture them yourself while logged in and upload them to me. I'll integrate them into the BrowserFrame component across the site.
