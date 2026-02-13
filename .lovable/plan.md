

# Kickstarter Page Overhaul — Addressing Review Feedback

This plan addresses the two pieces of Kickstarter review feedback: (1) incomplete AI disclosure and (2) funds framed around general business/marketing rather than product creation and delivery.

---

## Issue 1: AI Disclosure

Kickstarter requires a dedicated "Use of AI" section in the Story tab. While this is primarily filled out on the Kickstarter platform itself, the landing page should also be transparent. We will add a new **AI Transparency** section to the page that mirrors what you'll put in Kickstarter's form.

### New component: `AIDisclosure.tsx`

A clearly labelled section titled **"How We Use AI"** covering:

- **Confirmation**: Yes, LessonLoop uses AI as a product feature (LoopAssist).
- **Providers**: Lovable AI gateway (which routes to Google Gemini and OpenAI models). No proprietary models are trained.
- **Funding link**: Specify that campaign funds will be used to enhance LoopAssist's capabilities (smarter scheduling suggestions, predictive analytics) — not to train foundational models.
- **Human safeguards**: LoopAssist operates under a strict human-in-the-loop model. Every AI-proposed action (invoice run, reschedule, etc.) requires explicit user confirmation before execution. All AI actions are logged in an audit trail.
- **AI vs human-designed**: Clearly state which parts are AI-powered (LoopAssist chat, proactive alerts, action proposals) and which are fully human-designed (scheduling engine, invoicing, calendar, parent portal, all UI/UX).
- **Page materials**: Disclose if any AI tools were used to create the Kickstarter page copy or imagery.

This section will sit between **RisksSection** and **KickstarterFAQ**.

---

## Issue 2: Reframe Funding Away from Marketing

### Changes to `WhyKickstarter.tsx`

The current three pillars are "Infrastructure", "Mobile App", and "AI Enhancement". The problem is the broader page references marketing in the budget. We need to:

- **Remove any mention of "marketing"** from the funding breakdown.
- **Replace the pillars** with creation/delivery-focused items:
  1. **Product Development** — Building native mobile apps (iOS and Android) for teachers and parents, plus new features like calendar sync and practice tracking.
  2. **AI Feature Development** — Expanding LoopAssist with smarter scheduling suggestions, automated billing analysis, and progress reports.
  3. **Infrastructure and Testing** — Scaling servers, security hardening, load testing, and ensuring enterprise-grade reliability for thousands of users.

- **Add a visible "Use of Funds" breakdown** (e.g. a simple bar or list) showing percentages directed purely at product creation:
  - Product Development: 45%
  - AI Feature Development: 25%
  - Infrastructure, Hosting and Security: 20%
  - Backer Fulfilment and Delivery: 10%

### Changes to `KickstarterHero.tsx`

- Update the subtitle copy to emphasise **what is being created** and **how backers receive it**: "Back us to fund mobile apps, smarter AI features, and rock-solid infrastructure. Every backer gets early access to the platform."

### Changes to `CampaignStory.tsx`

- In Act 3 ("The Solution"), add a sentence making it explicit what backers are funding: "Your backing funds the creation of mobile apps, enhanced AI features, and the infrastructure to serve thousands of teachers — and you'll receive access as soon as it's ready."

### Changes to `KickstarterFAQ.tsx`

- **Update the first FAQ** ("Is LessonLoop actually built?") to remove the mention of "scaling infrastructure" (too vague/business-y) and replace with specifics: "Funds will go towards building native mobile apps, developing new AI scheduling features, and hardening infrastructure for reliability."
- **Add a new FAQ**: "What exactly will my pledge fund?" — Answer: "100% of funds go towards product creation and delivery: mobile app development, AI feature enhancements, infrastructure for reliability, and delivering backer rewards. No funds are allocated to marketing or general business operations."

### Changes to `RisksSection.tsx`

- Update the "Not Vaporware" risk copy to reinforce creation focus: "Kickstarter funds go towards creating mobile apps, new AI features, and scaling infrastructure — not general business expenses."

---

## Updated Page Order

1. KickstarterHero (updated subtitle)
2. CampaignStory (updated Act 3 copy)
3. WhyKickstarter (reframed pillars + visible Use of Funds breakdown)
4. BackerTiers (unchanged)
5. RisksSection (updated copy)
6. **AIDisclosure (NEW)**
7. KickstarterFAQ (updated + new FAQ)
8. FinalCTA (unchanged)

---

## Technical Details

### Files to create
- `src/components/marketing/kickstarter/AIDisclosure.tsx` — New section with AI transparency info, using the same card-based layout as RisksSection for visual consistency.

### Files to modify
- `src/pages/marketing/Kickstarter.tsx` — Import and add AIDisclosure between RisksSection and KickstarterFAQ.
- `src/components/marketing/kickstarter/WhyKickstarter.tsx` — Reframe pillars, add Use of Funds percentage breakdown.
- `src/components/marketing/kickstarter/KickstarterHero.tsx` — Update subtitle text.
- `src/components/marketing/kickstarter/CampaignStory.tsx` — Update Act 3 body text.
- `src/components/marketing/kickstarter/KickstarterFAQ.tsx` — Update FAQ 1, add new "What will my pledge fund?" FAQ.
- `src/components/marketing/kickstarter/RisksSection.tsx` — Update "Not Vaporware" body text.

### What you'll need to do on Kickstarter's platform
These landing page changes mirror what you should fill in on Kickstarter's "Use of AI" form in the Story tab:
- (a) Confirm the project uses AI
- (b) List providers: Google Gemini, OpenAI (via Lovable AI gateway)
- (c) Confirm funds will be used to develop/enhance AI features (not train foundational models)
- (d) Explain human-in-the-loop safeguards and audit logging

