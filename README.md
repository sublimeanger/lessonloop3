# LessonLoop

Music academy management platform — manage students, lessons, billing, and parent communication in one place.

- **App:** https://app.lessonloop.net
- **Marketing:** https://lessonloop.net
- **Repo:** https://github.com/sublimeanger/lessonloop3

## Tech stack

- **Frontend:** React 18 / TypeScript / Vite / Tailwind CSS / shadcn/ui — hosted on **Netlify**
- **Backend:** **Supabase** (PostgreSQL, Auth, Edge Functions, Storage, Realtime) — project ref `xmrhmxizpslhtkibqyfy`
- **Payments:** Stripe Connect (live mode, account `acct_1SrzbkAzPfYm94ux`)
- **AI:** Anthropic Claude (LoopAssist copilot), Google Gemini (CSV import column mapping, marketing chat)
- **Email:** Resend (`@lessonloop.net` domain)
- **Video:** Zoom OAuth integration
- **Native:** Capacitor (iOS App Store + Android AAB)
- **Monitoring:** Sentry (`lessonloop/javascript-react`)
- **Marketing site:** Cloudflare Pages (separate stack at `lessonloop.net`)
- **Testing:** Playwright E2E (suite present, currently being modernised)

## Architecture

| Site | URL | Stack | Hosting |
|---|---|---|---|
| App | app.lessonloop.net | React SPA | Netlify |
| Marketing | lessonloop.net | Static HTML (prerendered) | Cloudflare Pages |
| API | xmrhmxizpslhtkibqyfy.supabase.co | Supabase | Supabase EU-Frankfurt |

**Note on history:** the app was hosted on Lovable Cloud through April 2026, migrated to self-managed Supabase + Netlify in Phase 7 (May 2026). Several docs in `audit/archive/2026-q1-doc-snapshot/` reference the older topology — they're kept for historical reference but are no longer current.

## Database

PostgreSQL via Supabase. **93 tables, 326 RLS policies, 154 DB functions, 103 edge functions, 18 cron jobs, 420 migrations.**

Key domains:
- **Auth & orgs:** organisations, org_memberships (NB: not `organisation_members`), profiles
- **Academy:** students, teachers, locations, rooms, lessons, lesson_participants, recurrence_rules
- **Billing:** billing_runs, invoices, invoice_items, payments, refunds, stripe_webhook_events
- **Continuation:** terms, term_continuation_runs, term_continuation_responses
- **Credits:** make_up_credits, make_up_waitlist, enrolment_waitlist
- **Engagement:** attendance_records, practice_logs, practice_streaks, lesson_notes, resources
- **Messaging:** internal_messages, conversations, notification_preferences
- **AI:** ai_conversations, ai_messages

## Roles

Five roles with layered enforcement (RLS + edge functions + UI route guards):

| Role | Access |
|---|---|
| Owner | Full access, subscription management, org deletion |
| Admin | Full operational access, no subscription changes |
| Teacher | Own lessons, own students, attendance, notes, own payroll |
| Finance | Invoices, payments, refunds, payroll, reports |
| Parent | Portal only — own children's data via guardian link |

Solo teacher mode: when an owner is the only teacher, the UI simplifies navigation automatically.

## Documentation

The audit framework lives at `audit/` — start there:

- `audit/README.md` — entry point
- `audit/MASTER.md` — feature-by-feature production-readiness tracker
- `audit/00-launch-readiness.md` — pre-public-launch blocker list
- `audit/findings/` — known bugs and how they were fixed
- `audit/active/` — in-flight feature audits
- `audit/archive/` — historical audits, Phase 7 migration record, Q1 doc snapshot

Persistent design docs that haven't been folded into the audit framework yet:

- `claude.md` — project-specific Claude Code context (tables, RPCs, RLS patterns, conventions)
- `docs/RECURRING_BILLING_DESIGN.md` — recurring billing template design lock
- `docs/INVOICE_PDF.md` — server-side PDF rendering
- `docs/WEBHOOK_DEDUP.md` — Stripe webhook two-phase dedup pattern
- `docs/CRON_AUTH.md`, `docs/CRON_HEALTH.md`, `docs/CRON_JOBS.md` — cron infrastructure
- `docs/PLATFORM_AUDIT_LOG.md`, `docs/AUTO_PAY_FAILURE_HANDLING.md`, `docs/BILLING_NOTES.md`, `docs/MESSAGING_NOTES.md` — feature-level reference
- `docs/DESIGN_BRIEF.md`, `docs/UX_CHECKLIST.md`, `docs/FUNCTIONALITY_STANDARDS.md`, `docs/FUNCTIONALITY_CHECKLIST.md` — quality bars
- `docs/MIGRATION_CONVENTIONS.md` — SQL migration patterns
- `docs/mobile/CAPACITOR_README.md` — Capacitor build setup

## Development

### Prerequisites

- Node.js 22+
- Supabase CLI
- Stripe CLI (for webhook testing locally)

### Setup

```bash
git clone https://github.com/sublimeanger/lessonloop3.git
cd lessonloop3
npm install
```

### Environment

Copy `.env.example` to `.env` and configure:

```
VITE_SUPABASE_URL=https://xmrhmxizpslhtkibqyfy.supabase.co
VITE_SUPABASE_PROJECT_ID=xmrhmxizpslhtkibqyfy
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_…
VITE_SENTRY_DSN=https://…@…ingest.de.sentry.io/…
```

Edge function secrets are managed via `supabase secrets set --project-ref xmrhmxizpslhtkibqyfy …`.

### Run

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

### Testing

```bash
npx playwright test                    # Run full E2E suite
npx playwright test --grep "billing"   # Run specific tests
```

## Deployment

| Layer | How |
|---|---|
| **App** | Push to `main` → Netlify auto-builds + deploys (or trigger manually via `POST /api/v1/sites/26c144a4-…/builds`) |
| **Edge functions** | `supabase functions deploy <fn-slug> --project-ref xmrhmxizpslhtkibqyfy --use-api` |
| **Migrations** | `supabase db push --linked` (after `supabase link --project-ref xmrhmxizpslhtkibqyfy`) — or apply via Supabase MCP `apply_migration` if working from a Claude Code session |
| **Marketing site** | `node scripts/prerender.mjs` → deploy `dist/` to Cloudflare Pages |
| **iOS** | `npx cap copy ios` (NB: `cap sync` hangs — use `copy`) |
| **Android** | `npx cap sync android && npx cap open android` |

## Project structure

```
src/
├── components/          # React components by feature domain
│   ├── calendar/        # Calendar views, lesson form, bulk edit
│   ├── invoices/        # Invoice list, detail, billing run wizard
│   ├── students/        # Student CRUD, guardian management
│   ├── teachers/        # Teacher CRUD, availability
│   ├── continuation/    # Term continuation admin
│   ├── dashboard/       # Dashboard widgets, stats
│   ├── makeup/          # Make-up credits and waitlist
│   ├── portal/          # Parent portal components
│   ├── messaging/       # Messages, notifications
│   ├── loopassist/      # AI copilot chat interface
│   └── ui/              # shadcn/ui base components
├── hooks/               # React hooks by feature domain
├── pages/               # Route-level page components
├── integrations/        # Supabase client, types
├── lib/                 # Utilities (currency, timezone, platform detection, sentry init)
└── contexts/            # React contexts (auth, org, role)

supabase/
├── functions/           # 103 edge functions
│   ├── _shared/         # Shared utilities (rate-limit, auth, email, cors)
│   └── …                # one directory per function
├── migrations/          # 420 SQL migrations
└── config.toml          # Edge function config (verify_jwt settings)

audit/                   # Production-readiness sweep — start here
scripts/
└── prerender.mjs        # Marketing site static generator
```

## Working with this codebase via Claude Code

Project-specific Claude Code context — Stripe specifics, edge function conventions, RLS patterns, recent fixes — is in `claude.md`. Read it before making infrastructure changes.

The day-to-day pattern: open Claude Code in this directory, type `/sweep`, work through one feature at a time. See `audit/README.md`.

## License

Proprietary. All rights reserved.
