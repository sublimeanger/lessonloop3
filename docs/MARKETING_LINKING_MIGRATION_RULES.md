# Internal Linking & HTML Migration Rules for Marketing Pages

## Internal Linking Rules (IMPORTANT — apply to ALL marketing pages)

### Link Implementation
- Use react-router-dom `<Link>` for ALL internal navigation between marketing pages
- Every `<Link>` MUST have a descriptive, keyword-rich anchor text — never use "click here" or "learn more" alone. Good: "Explore music lesson scheduling →". Bad: "Learn more →"
- Every marketing page must link to at least 3 other marketing pages (not counting nav/footer)
- Every deep-dive section or feature block that has a corresponding dedicated page MUST include a contextual link to that page
- Links should feel natural within the content flow — placed at the end of a section's content column, after the feature grid or description, never floating randomly

### Link Hierarchy (follow this priority)
1. Feature pages link to: related feature pages (2-3), relevant comparison pages (1-2), pricing page
2. Comparison pages link to: features overview, relevant individual feature pages (3-4), pricing page
3. Blog posts link to: relevant feature page (1-2), relevant comparison page (1), pricing or signup
4. Use case / audience pages link to: features overview, 3-4 relevant feature pages, pricing
5. ALL pages link to /signup or /pricing as a CTA

### Anchor Text Keywords (use naturally, not forced)
- When linking to /features/scheduling → use "music lesson scheduling", "scheduling features", "drag-and-drop calendar"
- When linking to /features/billing → use "invoicing and billing", "automated billing", "music school billing"
- When linking to /features/parent-portal → use "parent portal", "family portal"
- When linking to /features/loopassist → use "LoopAssist AI", "AI assistant", "LoopAssist"
- When linking to /compare/lessonloop-vs-my-music-staff → use "My Music Staff alternative", "compare with My Music Staff"
- When linking to /compare/lessonloop-vs-teachworks → use "Teachworks alternative", "compare with Teachworks"
- When linking to /pricing → use "view pricing", "plans and pricing", "start free trial"
- When linking to /uk → use "built for UK music schools", "UK music school software"

### Future Route Map (add links to these even if the pages don't exist yet — they will be created)

**Marketing pages:**
- / (home)
- /features (overview)
- /features/scheduling
- /features/billing
- /features/parent-portal
- /features/loopassist
- /features/students
- /features/teachers
- /features/attendance
- /features/practice-tracking
- /features/messaging
- /features/reports
- /features/locations
- /features/resources
- /pricing
- /about
- /contact
- /blog
- /uk

**Comparison pages:**
- /compare/lessonloop-vs-my-music-staff
- /compare/lessonloop-vs-teachworks
- /compare/lessonloop-vs-opus1
- /compare/lessonloop-vs-jackrabbit-music
- /compare/lessonloop-vs-fons

**Use case pages:**
- /for/music-academies
- /for/solo-teachers
- /for/piano-schools
- /for/guitar-schools
- /for/performing-arts

**Legal:**
- /privacy
- /terms
- /gdpr
- /cookies

## HTML Migration Notice (IMPORTANT)

These marketing pages are currently built as React SPA components using react-router-dom. They will be migrated to static HTML pages in the near future for maximum SEO performance.

To make this migration smooth:
1. Keep all marketing page content **SELF-CONTAINED** within each page component and its child components — do not rely on global React state, context providers, or app-level hooks for content rendering
2. All internal links should use standard href paths (e.g., "/features/scheduling") — the `<Link>` component already does this, but do NOT use programmatic navigation (`useNavigate`) for marketing page links
3. All JSON-LD schema should be rendered as `<script type="application/ld+json">` blocks directly in the component JSX — do NOT use React Helmet or any head-management library that requires JS execution
4. All meta tags (title, description, OG, Twitter) should be set via the `usePageMeta` hook AND also have static fallbacks in `index.html` for pre-render crawling
5. Keep marketing components free of heavy client-side interactivity that would break without React — animations (framer-motion) are fine as progressive enhancement, but the content must be readable without JS
6. Image assets should use standard `<img>` tags with alt text, width, height attributes — not dynamically loaded via React state
7. CSS classes should use Tailwind utility classes that compile to static CSS — no runtime style computation
