

# Fix Invisible Buttons, Stale Claims, and Pricing Page Duplication

## Issues Found

### 1. Invisible Buttons on Dark Backgrounds (2 locations)

The screenshot shows a white rectangle next to the "Get in Touch" button on the About page. The cause: `variant="outline"` applies `bg-background` (white in light mode), but the text is set to `text-white` -- making white text on a white background invisible.

**Affected files:**
- `src/pages/marketing/About.tsx` (line 380) -- "Start Free Trial" button in the dark contact CTA section
- `src/components/marketing/pricing/EnterpriseCTA.tsx` (line 81-87) -- "Book a Demo" button in the dark enterprise section

**Fix:** Remove `variant="outline"` and explicitly set the background to be transparent with a visible border, e.g.:
```
className="border border-white/30 bg-transparent text-white hover:bg-white/10 ..."
```

### 2. "Book a Demo" Button Has No Link (EnterpriseCTA)

The "Book a Demo" button in `EnterpriseCTA.tsx` is a plain `<Button>` with no `<Link>` wrapper -- clicking it does nothing. It should link to `/contact?subject=demo`.

### 3. Remaining False Claims (2 files missed in previous overhaul)

- `src/components/marketing/features/FeatureCTA.tsx` line 46: **"Join thousands of music educators who've reclaimed their time."** -- still uses the fabricated "thousands" language
- `src/pages/marketing/BlogPost.tsx` line 441: **"Join thousands of UK music teachers who save hours every week"** -- same issue

### 4. Pricing Page Feels Like Two Pricing Sections

The Pricing page currently shows:
1. **PricingCards** -- the main 3-column plan cards with prices
2. **FeatureComparison** -- a full comparison table that *also* shows plan names and prices in its header, plus a "View full pricing details" CTA linking back to `/pricing` (redundant)

This creates a "two pricing sections" feeling. The fix:
- When `FeatureComparison` is rendered on the Pricing page, hide the per-plan pricing from the table header (since users already saw the cards above)
- Remove or change the bottom CTA that links back to `/pricing` when already on the Pricing page. On the Features page, the link makes sense; on Pricing, it's circular

**Approach:** Add an optional `showPrices` prop (default `true`) and `ctaLink` prop to `FeatureComparison`. On the Pricing page, pass `showPrices={false}` and omit the redundant CTA.

---

## File Changes

### `src/pages/marketing/About.tsx`
- Line 380: Fix the "Start Free Trial" outline button -- replace `variant="outline"` with explicit transparent styling so text is visible on the dark background

### `src/components/marketing/pricing/EnterpriseCTA.tsx`
- Lines 81-87: Fix the "Book a Demo" button -- replace `variant="outline"` with explicit transparent styling and wrap in a `<Link to="/contact?subject=demo">`

### `src/components/marketing/features/FeatureCTA.tsx`
- Line 46: Change "Join thousands of music educators" to "Join a growing community of music educators"

### `src/pages/marketing/BlogPost.tsx`
- Line 441: Change "Join thousands of UK music teachers" to "Join a growing community of UK music teachers"

### `src/components/marketing/features/FeatureComparison.tsx`
- Add an optional `hidePrices` prop to suppress plan pricing in the table header
- Add an optional `hideBottomCTA` prop to suppress the redundant "View full pricing details" link
- When `hidePrices` is true, remove the price line from the header columns
- When `hideBottomCTA` is true, hide the bottom CTA section

### `src/pages/marketing/Pricing.tsx`
- Pass `hidePrices` and `hideBottomCTA` to `FeatureComparison` to remove the duplication feeling

---

## Summary

| Issue | File(s) | Fix |
|---|---|---|
| Invisible "Start Free Trial" button | About.tsx | Replace outline variant with explicit transparent bg |
| Invisible "Book a Demo" button | EnterpriseCTA.tsx | Replace outline variant with explicit transparent bg |
| "Book a Demo" does nothing | EnterpriseCTA.tsx | Wrap in Link to /contact?subject=demo |
| "Join thousands" false claim | FeatureCTA.tsx, BlogPost.tsx | Change to "a growing community" |
| Duplicate pricing feel | FeatureComparison.tsx, Pricing.tsx | Add props to hide prices and redundant CTA on pricing page |

**6 files changed. No database or backend changes required.**
