# LessonLoop

Music lesson management platform for academies, schools, and independent teachers. Built with React, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, RLS)
- **Payments:** Stripe Connect + Stripe Billing
- **AI:** LoopAssist conversational assistant
- **Monitoring:** Sentry

## Getting Started

```bash
npm install
npm run dev
```

Requires a Supabase project with the migrations applied. See `supabase/migrations/` for the schema.

## Project Structure

- `src/components/` — React components organized by feature
- `src/hooks/` — Custom React hooks for data fetching and business logic
- `src/contexts/` — Auth, Org, and LoopAssist context providers
- `src/pages/` — Route-level page components
- `supabase/functions/` — Supabase Edge Functions
- `supabase/migrations/` — Database migrations
- `docs/` — Architecture and compliance documentation

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run test` — Run test suite
- `npm run lint` — Run ESLint
