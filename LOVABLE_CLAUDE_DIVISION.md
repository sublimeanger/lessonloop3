# Lovable ↔ Claude Code: Division of Labour & Sync Behaviour

> **Read this before starting any session.** This document defines exactly what Lovable controls, what Claude Code controls, how GitHub sync works, and what must be run manually. Both AIs share the same `main` branch and the same live Supabase project — there is no staging.

---

## 1. Project facts

- **Supabase project ref**: `ximxgnkpcswbvfrkkmjq`
- **Lovable project ID**: `c541d756-90e7-442a-ba85-0c723aeabc14`
- **Production app**: https://app.lessonloop.net
- **Marketing site**: https://lessonloop.net (separate, Cloudflare Pages)
- **Repo**: GitHub, default branch `main`. Bidirectional real-time sync with Lovable.
- **No staging environment**: every migration and edge-function deploy hits production.

---

## 2. Strict division of labour

| Domain | Owner | Notes |
|---|---|---|
| React components, pages, hooks, contexts | **Lovable** | All of `src/` UI |
| Tailwind config, design tokens, `index.css` | **Lovable** | |
| Routing (`src/config/routes.ts`) | **Lovable** | See critical rule in §8 |
| Edge functions (`supabase/functions/**`) | **Claude Code** | Lovable can write them but should not |
| SQL migrations (`supabase/migrations/**`) | **Claude Code** | Lovable can create them via tool; prefer Claude for batches |
| RLS policies, RPCs, triggers | **Claude Code** | |
| Playwright E2E tests | **Claude Code** | |
| `supabase/functions/_shared/**` | **Claude Code** | |
| Capacitor / iOS / Android builds | **You (human)** | |
| Marketing site build & deploy | **You (human)** | `node scripts/prerender.mjs` → Cloudflare Pages |
| Stripe / Resend / Zoom dashboards | **You (human)** | |

**These never cross.** If Lovable writes an edge function, the git history blurs and the deploy path differs (see §5).

---

## 3. Files Lovable cannot touch (auto-managed)

- `src/integrations/supabase/types.ts` — regenerated after each migration
- `src/integrations/supabase/client.ts` — auto-managed
- `.env` — auto-populated with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `supabase/migrations/*.sql` — read-only in Lovable; only created via the migration tool
- `package-lock.json`, `bun.lock`, `bun.lockb` — managed by dependency tools
- `.gitignore`

Claude Code **can** edit `types.ts` and migration files locally, but should let Supabase regenerate `types.ts` after `db push` rather than hand-editing it.

---

## 4. GitHub sync behaviour

- **Lovable → GitHub**: every Lovable change auto-commits and pushes to `main` within seconds. No manual push.
- **GitHub → Lovable**: pushes to `main` (from Claude Code or local) auto-pull into Lovable within seconds; preview rebuilds.
- **Conflict model**: last-write-wins at the file level. There is no merge UI.
- **Safe pattern**: do not have Lovable and Claude editing the same file in the same minute. When Claude is doing a batch (migrations + functions), pause Lovable edits in that area.

---

## 5. Edge function deployment

### From Lovable
- Writing/editing `supabase/functions/<name>/index.ts` triggers an automatic deploy.
- Lovable can also explicitly redeploy any function on demand.

### From Claude Code (preferred for backend work)
```bash
# Single function
supabase functions deploy <name> --project-ref ximxgnkpcswbvfrkkmjq

# All functions
supabase functions deploy --project-ref ximxgnkpcswbvfrkkmjq
```

### Important
- Both paths target the same live project.
- `supabase/config.toml` controls per-function settings (e.g. `verify_jwt`). Only function-specific blocks are safe to edit. **Never touch `project_id` or other project-level keys.**
- After deploy, first invocation can have a 2-3s cold start.
- If a deploy fails with 500/internal error, try removing `deno.lock` and retry — incompatible lockfiles are a common cause.

---

## 6. Database migrations

### From Lovable
1. Lovable writes SQL via the migration tool.
2. User approves the diff.
3. Migration runs against the live DB.
4. `types.ts` regenerates automatically (~30s lag possible).
5. The `.sql` file appears in `supabase/migrations/` and syncs to GitHub.

### From Claude Code
1. Write `supabase/migrations/<timestamp>_<name>.sql`.
2. Push to GitHub (or commit locally).
3. **Run `supabase db push --project-ref ximxgnkpcswbvfrkkmjq`** — Lovable will sync the file but will **not** execute it.
4. Reload PostgREST cache: `NOTIFY pgrst, 'reload schema';`
5. Lovable will pick up the regenerated `types.ts` on next sync.

The repo has `scripts/apply-pending-migrations.sh` which handles steps 3–4 plus deploys all edge functions in one shot. Use it for batch deploys.

### Migration rules
- Use `IF NOT EXISTS` / `IF EXISTS` for idempotency.
- Never include `ALTER DATABASE postgres` statements.
- Never modify `auth`, `storage`, `realtime`, `supabase_functions`, `vault` schemas.
- Use validation triggers, not CHECK constraints, for time-based validations (CHECK must be immutable).
- Use SECURITY DEFINER functions for cross-table role checks to avoid RLS recursion.

---

## 7. What needs to run manually

| Action | Who | Command / location |
|---|---|---|
| Frontend production deploy | You | Lovable → **Publish → Update** |
| Marketing site deploy | You | `node scripts/prerender.mjs` → Cloudflare Pages |
| iOS build refresh | You | `npx cap copy ios` (**not `sync`** — hangs) |
| Apply Claude-authored migrations | Claude / you | `./scripts/apply-pending-migrations.sh` or `supabase db push` |
| Deploy Claude-authored edge functions | Claude / you | `supabase functions deploy --project-ref ximxgnkpcswbvfrkkmjq` |
| Stripe webhook secret rotation | You | Stripe dashboard → update secret in Lovable Cloud |
| Workspace build secrets (private npm tokens) | You | Workspace Settings → Build Secrets (Lovable cannot set these) |
| Custom domain DNS | You | DNS provider + Lovable project settings |
| Reload PostgREST cache after manual SQL | Claude | `NOTIFY pgrst, 'reload schema';` |

---

## 8. Critical rules — DO NOT BREAK

### 8.1 `src/config/routes.ts`
Must NOT contain any `import()` calls for marketing pages (`@/pages/marketing/*`). The old `const MktHome = lazy(() => import('@/pages/marketing/Home'))` pattern crashes Lovable's dev server because Vite cannot serve those modules.

Correct architecture:
- `src/config/routes.ts` → `AuthRedirect` for `/`, `makeExternalRedirect()` for all marketing paths. Zero marketing imports.
- `src/config/routes-ssg.ts` → all marketing `import()` calls. Loaded only when `window.__SSG_MODE__` is set by the Puppeteer prerender script.

If you see `TypeError: Failed to fetch dynamically imported module: src/pages/marketing/Home.tsx`, do NOT revert to an older commit — the fix is already in place. Stop reverting it.

### 8.2 User roles
- Roles live in `public.user_roles` (separate table). **Never** store roles on `profiles` or any user table — that enables privilege escalation.
- Use the `has_role(_user_id, _role)` SECURITY DEFINER function in RLS policies.

### 8.3 Secrets
- Never hardcode private keys in source. Publishable/anon keys are fine.
- Edge function secrets: managed via Lovable Cloud secrets UI or `supabase secrets set`.
- Required secrets (see `docs/DEPLOYMENT.md` §3.2): `RESEND_API_KEY`, `LOVABLE_API_KEY`, `INTERNAL_CRON_SECRET`, `FRONTEND_URL`, `ALLOWED_ORIGINS`, Stripe keys.

### 8.4 Money
- All amounts stored as integer minor units (pence). No floats.
- Currency from org settings, never hardcoded `£` / `$`.

### 8.5 Time
- All timestamps stored as `timestamptz`.
- All date filtering uses the org timezone (`Europe/London` by default), never the server timezone.

### 8.6 LoopAssist (AI)
- Every action proposed by AI requires explicit user confirmation before execution.
- All AI actions are logged in `ai_action_proposals`.

---

## 9. Quick reference for Claude

When you start a session:
1. Read this file and `README.md`.
2. Check `supabase/migrations/` for any locally-authored migrations not yet applied (compare with `supabase migration list --project-ref ximxgnkpcswbvfrkkmjq`).
3. Stay in your lane: edge functions, migrations, RLS, RPCs, tests. Do not modify `src/components/**`, `src/pages/**`, `src/hooks/**`, or styling.
4. After backend changes: run `./scripts/apply-pending-migrations.sh` (covers migrations + function deploys + cache reload + verification).
5. If you must touch UI for an end-to-end feature, leave a clear commit message so Lovable doesn't unknowingly overwrite it.

---

## 10. Quick reference for Lovable

When the user asks for backend work:
1. Default to: "That's owned by Claude Code per `LOVABLE_CLAUDE_DIVISION.md`. Want me to do it anyway, or hand it off?"
2. If proceeding, use the migration tool / edit `supabase/functions/<name>/index.ts` directly — do not write SQL files in `supabase/migrations/` by hand.
3. Never edit `src/integrations/supabase/types.ts`, `client.ts`, or `.env`.
4. Never touch `supabase/migrations/*.sql` — they're read-only.

---

## Migration tracking — not what you think

Lovable's migration tool does NOT write to supabase_migrations.schema_migrations. That table will appear mostly empty / wildly out of date relative to the supabase/migrations/ folder.

**DO NOT use schema_migrations as a drift signal.** During the 18 April 2026 audit deploy, a false-alarm "120 missing migrations" diagnosis was triggered by treating that table as authoritative. Only one migration was actually unapplied live (payments.installment_id from 20260303100000), and Lovable caught + prereq-applied it during the deploy.

**Authoritative drift check:** compare expected schema objects (tables, columns, functions, triggers) against live via pg_catalog / information_schema queries, not against schema_migrations. When in doubt, probe the specific object the code expects to exist.

**Claude-Code-authored migrations:** these are picked up by Lovable on GitHub sync but Lovable's migration tool does NOT auto-apply them. Jamie must prompt Lovable explicitly to apply pending migrations after any merge that contains Claude-Code-authored migration files.

---

_Last updated: 2026-04-18_
