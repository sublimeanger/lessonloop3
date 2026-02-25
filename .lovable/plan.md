

# Homepage SEO Upgrade — Implementation Plan

All changes are scoped to SEO metadata, structured data, internal links, and minor copy/attribute tweaks. No visual or animation changes.

## Files to Create (1)

### `src/components/marketing/HomepageSchema.tsx`
New component rendering three `<script type="application/ld+json">` blocks (SoftwareApplication, Organization, FAQPage) with the exact JSON-LD provided in the brief.

## Files to Modify (5)

### 1. `src/pages/marketing/Home.tsx`
- Update `usePageMeta` title to: `"LessonLoop — Music School Management Software for UK Academies"`
- Update meta description to: `"Schedule lessons, automate invoicing, track attendance, and keep parents in the loop. Music school management software built for UK educators. Free 30-day trial."`
- Import and render `<HomepageSchema />` just inside `<MarketingLayout>` before `<HeroSection />`

### 2. `src/hooks/usePageMeta.ts`
- Expand the hook to also set/update OG meta tags (`og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:locale`, `og:site_name`, `twitter:card`) via `document.head` meta manipulation
- Update the fallback defaults in the cleanup function to match the new title/description
- Add canonical link tag (`<link rel="canonical" href="https://lessonloop.co.uk/">`) and robots meta (`<meta name="robots" content="index, follow">`)

### 3. `index.html`
- Update `<title>`, `<meta name="description">`, `og:title`, `og:description`, `og:url`, `og:image`, `twitter:title`, `twitter:description`, `twitter:image` to use `lessonloop.co.uk` domain and the new copy
- Add `<link rel="canonical" href="https://lessonloop.co.uk/" />`
- Add `<meta name="robots" content="index, follow" />`

### 4. `src/components/marketing/HeroSection.tsx`
- Change the "See how it works" `<Link to="/features">` into a button/div with `onClick` that smooth-scrolls to `#product-showcase`

### 5. `src/components/marketing/ProductShowcase.tsx`
- Add `id="product-showcase"` to the outermost `<section>` element
- Update each tab's `url` field to use feature page routes (`/features/loopassist`, `/features/scheduling`, `/features/billing`, `/features/students`, `/features/practice-tracking`, `/features/resources`)
- Add a "Learn more →" `<Link>` below the feature list in each tab's content panel, pointing to the tab's `url`

## No Changes Needed
- H2 headings across BeforeAfter, ProductShowcase, AISpotlight, UKDifferentiator, HowItWorks, FounderStory, CTASection — all already match the required keywords
- No visual design, animation, navbar, footer, or chat widget changes

