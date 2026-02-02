
# Promotional Media Assets Plan

## Overview

This plan outlines how to capture high-quality photos (screenshots) and create videos/GIFs of LessonLoop to use across the marketing site, documentation, and promotional materials.

## Current Asset Audit

### Existing Assets
- **SVG Previews** (`/public/previews/`): Static placeholder illustrations
  - `calendar-preview.svg`
  - `invoices-preview.svg`
  - `students-preview.svg`
- **Blog Graphics** (`/public/blog/`): Abstract SVG illustrations for articles
- **Marketing Mockups**: Animated React components in the HeroSection, ProductShowcase, and BentoFeatures

### Gap Analysis
The current marketing site relies heavily on **animated mockups** (React components) rather than real screenshots. While these look polished, they:
- Don't show the real product
- Can't be used in external media (pitch decks, social, print)
- May not fully represent current features

## Proposed Asset Categories

### 1. Hero Screenshots (High-Priority)
Static screenshots for key marketing placements:

| Screenshot | Source Page | Usage |
|------------|-------------|-------|
| Dashboard Overview | `/dashboard` | Hero section, About page |
| Calendar Week View | `/calendar` (Week view with lessons) | Product tour, Features |
| Invoice List | `/invoices` (Mixed statuses) | Billing deep-dive |
| Parent Portal Home | `/portal/home` | Portal deep-dive |
| LoopAssist AI Chat | Drawer open with conversation | AI feature section |
| Student Profile | `/students/:id` | Student management |
| Billing Run Wizard | Modal open | Automation story |

### 2. Feature GIFs/Videos (Medium-Priority)
Short animated captures demonstrating workflows:

| Demo | Duration | Shows |
|------|----------|-------|
| Create Lesson | 8-10s | Click slot → Fill modal → Save |
| Billing Run | 10-12s | Open wizard → Select options → Generate |
| LoopAssist Query | 8-10s | Type question → AI response streams |
| Parent Portal Pay | 6-8s | View invoice → Click Pay → Stripe flow |
| Drag-Drop Reschedule | 5-7s | Drag lesson to new slot |

### 3. Device Mockups (For Social/Print)
Screenshots placed into device frames:
- MacBook Pro frame for desktop views
- iPhone 15 Pro frame for parent portal mobile view
- iPad frame for tablet users

## Technical Implementation

### Phase 1: Capture Infrastructure

Create a dedicated **demo mode** that prepares the app with:
- Seeded realistic data (already exists: `seed-demo-data` edge function)
- Specific test accounts for consistent captures
- Option to hide UI chrome (sidebar, header) for clean shots

### Phase 2: Screenshot Capture Process

**Option A: Manual Browser Capture** (Fastest)
1. Log in as demo Owner account
2. Navigate to each target page
3. Use browser's screenshot tool or macOS Screenshot (Cmd+Shift+4)
4. Crop and export at 2x resolution

**Option B: Automated Playwright Script**
Create a script that:
- Logs in via test credentials
- Navigates to each key page
- Captures at multiple resolutions (desktop, tablet, mobile)
- Saves to `/public/screenshots/` or external storage

### Phase 3: Video/GIF Creation

**Tools:**
- **Screen Recording**: macOS Screen Recording, Loom, or ScreenStudio
- **GIF Conversion**: FFmpeg or Gifski for high-quality GIFs
- **Editing**: CapCut or Final Cut for transitions

**Recording Guidelines:**
- Resolution: 1920x1080 minimum
- Frame rate: 30fps for videos, 15fps for GIFs
- Duration: Keep under 15 seconds for GIFs
- Mouse movements: Smooth, deliberate, visible cursor
- No personal data visible (use demo accounts)

## Storage Strategy

### For Web Usage
Store in `/public/marketing/`:
```
/public/marketing/
├── screenshots/
│   ├── dashboard-hero.webp
│   ├── calendar-week.webp
│   ├── invoices-list.webp
│   ├── parent-portal.webp
│   └── loopassist-chat.webp
├── gifs/
│   ├── create-lesson.gif
│   ├── billing-run.gif
│   └── loopassist-query.gif
└── videos/
    ├── product-tour.mp4
    └── 60-second-demo.mp4
```

### For External Use (Pitch Decks, Social)
- Export as PNG (screenshots) and MP4 (videos)
- Store in cloud (Google Drive, Dropbox) for sharing
- Maintain a brand asset library document

## Marketing Site Integration

### Updates Required

1. **HeroSection**: Replace animated mockup with real screenshot in browser frame
2. **ProductShowcase**: Option to toggle between animated mockups and real screenshots
3. **Features Page**: Add actual product screenshots to deep-dive sections
4. **About Page**: Use dashboard screenshot as "the product" visual

### New Component: ScreenshotBrowserFrame

A reusable component that wraps screenshots in a browser-style frame:

```tsx
<BrowserFrame>
  <img src="/marketing/screenshots/dashboard-hero.webp" alt="LessonLoop Dashboard" />
</BrowserFrame>
```

## Recommended Capture Sequence

### Session 1: Core Screenshots
1. Dashboard (Owner view with populated data)
2. Calendar (Week view with 8-10 lessons)
3. Students list (10+ students showing)
4. Single student profile (with guardian, lessons tab)
5. Invoices list (mixed statuses)
6. LoopAssist drawer open (with sample conversation)

### Session 2: Feature Workflows
1. Record: Create new lesson flow
2. Record: Billing run wizard
3. Record: LoopAssist asking "who hasn't paid"
4. Record: Parent portal payment flow

### Session 3: Mobile/Tablet
1. Parent portal on iPhone frame
2. Calendar on iPad
3. Mobile-responsive dashboard

## Quality Checklist

Before using any capture:
- [ ] No personal/test email addresses visible
- [ ] Realistic-looking data (British names, GBP amounts)
- [ ] Current date/time looks appropriate
- [ ] No console errors or loading states visible
- [ ] Consistent brand colours and typography
- [ ] High resolution (minimum 2x for retina)

---

## Technical Details

### Demo Data Requirements
The existing `seed-demo-data` edge function should be verified/enhanced to include:
- 20+ students with realistic British names
- 50+ lessons spread across calendar
- 10+ invoices in various statuses
- Sample conversation in LoopAssist history
- Parent portal with linked children

### Recommended Resolutions
| Context | Resolution |
|---------|------------|
| Desktop screenshot | 2560x1440 or 1920x1080 @2x |
| Mobile screenshot | 390x844 (iPhone 15 Pro) |
| Tablet screenshot | 1024x768 (iPad) |
| Video | 1920x1080 @ 30fps |
| GIF | 800x600 max, 15fps |

### File Formats
- **Photos**: WebP (primary), PNG (fallback), JPEG (external)
- **Animations**: GIF (short loops), MP4 (longer demos)
- **Source**: Keep original recordings for future edits

## Next Steps After Approval

1. Verify demo data is sufficient for realistic captures
2. Set up consistent test environment
3. Capture Session 1 (core screenshots)
4. Create BrowserFrame component for marketing integration
5. Update HeroSection to use real screenshot option
6. Capture Session 2 (workflow videos)
7. Convert to GIFs and optimise for web

