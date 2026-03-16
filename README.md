
LessonLoop
Music academy management platform — manage students, lessons, billing, and parent communication in one place.
App: app.lessonloop.net Marketing: lessonloop.net
Tech Stack
* Frontend: React 18 / TypeScript / Vite / Tailwind CSS / shadcn/ui
* Backend: Supabase (PostgreSQL, Auth, Edge Functions, Storage, Realtime)
* Payments: Stripe Connect (checkout, subscriptions, invoicing)
* AI: Anthropic Claude (LoopAssist copilot)
* Video: Zoom OAuth integration
* Native: Capacitor (iOS App Store approved, Android AAB built)
* Hosting: Lovable (app), Cloudflare Pages (marketing site)
* Testing: Playwright E2E (950+ tests)
Architecture
Two-site architecture:
Site URL Stack Hosting App app.lessonloop.net React SPA (Lovable) Lovable Marketing lessonloop.net Static HTML Cloudflare Pages
Database
PostgreSQL via Supabase with 56+ tables, 82 edge functions, 120+ RLS policies. Key domains:
* Auth & Orgs: organisations, organisation_members, profiles
* Academy: students, teachers, locations, rooms, lessons, lesson_participants, recurrence_rules
* Billing: billing_runs, invoices, invoice_items, payments, refunds, stripe_webhook_events
* Continuation: terms, term_continuation_runs, term_continuation_responses
* Credits: make_up_credits, make_up_waitlist, enrolment_waitlist
* Engagement: attendance_records, practice_logs, practice_streaks, lesson_notes, resources
* Messaging: internal_messages, conversations, notification_preferences
* AI: ai_conversations, ai_messages
Roles
Five roles with layered enforcement (RLS + edge functions + UI route guards):
Role Access Owner Full access, subscription management, org deletion Admin Full operational access, no subscription changes Teacher Own lessons, own students, attendance, notes, own payroll Finance Invoices, payments, refunds, payroll, reports Parent Portal only — own children's data via guardian link
Solo teacher mode: when an owner is the only teacher, the UI simplifies navigation automatically.
Key Features
* Students & Guardians — CRUD, guardian linking, enrollment lifecycle, tier-limited
* Teachers & Availability — profiles, weekly availability, time-off, invite flow
* Lessons & Calendar — one-off + recurring, day/week/stacked/agenda views, drag-to-reschedule, conflict detection (7 dimensions), Zoom integration
* Slot Generator — bulk lesson creation with preview, conflict detection, batch insert
* Bulk Edit — multi-select lessons, atomic RPC for batch updates with conflict/guard checks
* Attendance & Register — mark attendance, batch mode, future-lesson guard, org-timezone date filtering
* Billing Runs — rate resolution chain, rate snapshots, per-(lesson,student) dedup, skipped student tracking
* Invoices — draft→sent→paid→voided lifecycle, line items, VAT, send via email, void with credit restoration
* Stripe Payments — embedded checkout, webhook processing, three-layer idempotency, Stripe Connect
* Refunds — full/partial, pending row before Stripe API, voided invoice guard, audit logged
* Dashboard & Reports — role-specific dashboards, revenue/outstanding/attendance reports, CSV export
* Term Continuation — run creation, parent accept/decline, lesson materialisation on acceptance, realtime widget
* Make-Up Credits — issuance, consumption (FOR UPDATE SKIP LOCKED), void mechanism, expiry with waitlist protection, partial credits, max per term
* Waitlist — enrolment + make-up, matching algorithm, offer/accept/book lifecycle, mutual exclusion, atomic conversion
* Lesson Notes — public + teacher-private with column-level privacy enforcement via RPCs
* Practice Tracking — timer, quick-log, streaks (5-tier gamification), teacher review
* Resources — upload, share, private storage with signed URLs, MIME validation
* Parent Portal — complete parent experience: schedule, invoices, payments, notes, practice, credits, make-ups, continuation, messaging
* Messaging — internal messages, email notifications, notification bell, bulk compose
* LoopAssist AI — role-aware copilot with prompt injection protection, rate limiting, cost controls
* Subscriptions — Stripe subscriptions, 5 tiers, feature gating, trial flow, downgrade handling
* Payroll — teacher earnings, rate calculation, open slot exclusion, CSV export
Development
Prerequisites
* Node.js 18+
* Supabase CLI
* Stripe CLI (for webhook testing)
Setup
git clone https://github.com/sublimeanger/lessonloop3.git cd lessonloop3 npm install
Environment
Copy .env.example to .env and configure:
* VITE_SUPABASE_URL — Supabase project URL
* VITE_SUPABASE_ANON_KEY — Supabase anon key
* VITE_STRIPE_PUBLISHABLE_KEY — Stripe publishable key
Edge function secrets are managed via Supabase dashboard.
Run
npm run dev          # Start dev server npm run build        # Production build npm run typecheck    # TypeScript check
Testing
npx playwright test                    # Run full E2E suite npx playwright test --grep "billing"   # Run specific tests
E2E tests run against the live site via container proxy. See claude.md for test infrastructure constraints.
Deployment
* App: Deployed via Lovable (auto-deploys on main)
* Marketing site: node scripts/prerender.mjs → deploy to Cloudflare Pages
* Edge functions: supabase functions deploy
* Migrations: supabase db push
* iOS: npx cap copy ios (not sync — sync hangs)
Project Structure
src/ ├── components/          # React components by feature domain │   ├── calendar/        # Calendar views, lesson form, bulk edit │   ├── invoices/        # Invoice list, detail, billing run wizard │   ├── students/        # Student CRUD, guardian management │   ├── teachers/        # Teacher CRUD, availability │   ├── continuation/    # Term continuation admin │   ├── dashboard/       # Dashboard widgets, stats │   ├── makeup/          # Make-up credits and waitlist │   ├── portal/          # Parent portal components │   ├── messaging/       # Messages, notifications │   ├── loopassist/      # AI copilot chat interface │   └── ui/              # shadcn/ui base components ├── hooks/               # React hooks by feature domain ├── pages/               # Route-level page components ├── integrations/        # Supabase client, types ├── lib/                 # Utilities (currency, timezone, platform detection) └── contexts/            # React contexts (auth, org, role)  supabase/ ├── functions/           # 82 edge functions │   ├── _shared/         # Shared utilities (rate-limit, auth, email) │   ├── create-billing-run/ │   ├── stripe-webhook/ │   ├── send-invoice-email/ │   └── ... ├── migrations/          # SQL migrations (76+) └── config.toml          # Edge function config (verify_jwt settings)  scripts/ └── prerender.mjs        # Marketing site static generator
Division of Labour
Tool Responsibility Lovable Frontend UI/UX, React components, pages, hooks, styling Claude Code Edge functions, migrations, RLS policies, RPCs, test infrastructure
These NEVER cross. Lovable does not write edge functions. Claude Code does not modify UI components.
Production Readiness
All 26 features passed independent production readiness audits (March 2026) covering:
* Database schema, constraints, cascades
* RLS policies per role per table
* Edge function auth, validation, error handling
* SECURITY DEFINER RPC auth verification
* Timezone handling (org timezone throughout)
* Currency handling (org currency, no hardcoded symbols)
* Financial accuracy (integer minor units, no floating point)
* UI/UX (responsive, loading/empty/error states, role gating)
Audit reports are in the repo root: audit-feature-{01-26}-*.md
License
Proprietary. All rights reserved.
