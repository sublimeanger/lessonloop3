-- ============================================================
-- LessonLoop Phase 2 — Sequenced Schema-Drift Fixes
-- ============================================================
-- Destination-side only. NOT in supabase/migrations/. Applied directly via
-- Management API at the migration index marked in each section header.
--
-- Source of drift: migration chain doesn't faithfully replay source's history.
-- Some objects/columns were added on source via the Lovable SQL editor
-- without corresponding migration files in the repo.
-- ============================================================


-- ============================================================
-- SECTION 1 — Before migration 212  (idx 212 — `account_delete_fk_set_null`)
-- Status: ALREADY APPLIED 2026-05-04
-- ============================================================
-- Source has lead_students.created_by, but no migration in the chain adds it.
-- Migration 212's ADD CONSTRAINT lead_students_created_by_fkey references it.
--
-- ALTER TABLE public.lead_students ADD COLUMN IF NOT EXISTS created_by uuid;
--
-- (Already executed; column verified present.)


-- ============================================================
-- SECTION 2 — Before migration 305  (idx 305 — `xero_connections_schema_sync`)
-- Status: ALREADY APPLIED 2026-05-04
-- ============================================================
-- Migration 305's comment: "xero_connections table was created outside of
-- version control (pre-2026-04-17)". No migration in the chain creates it.
-- Migration 305 (and 310) idempotently ADD COLUMN connected_by + DROP NOT NULL
-- on user_id — both no-ops once the table exists with the right shape.
--
-- CREATE TABLE IF NOT EXISTS public.xero_connections (... 17 columns ...);
-- ALTER TABLE public.xero_connections ENABLE ROW LEVEL SECURITY;
--
-- (Already executed; verified 17 columns present.)
--
-- TODO post-Phase-2: source has RLS policies + indexes on this table not
-- captured in any migration. Re-create out-of-band before cutover.


-- ============================================================
-- SECTION 3 — Between migration 345 and migration 350
-- Status: PENDING — execute AFTER 345 succeeds, BEFORE 350 runs
-- ============================================================
-- Migration 345 (`20260424190000_recurring_template_runs_tables`) creates
-- `recurring_template_runs` with columns:
--   * invoices_generated  (integer)
--   * completed_at        (timestamptz)
--   * (no `source` column)
--
-- Migration 350 (`20260424225109_…`) creates RPC functions whose bodies
-- reference DIFFERENT column names:
--   * invoice_count   (referenced in UPDATE inside generate_invoices_from_template)
--   * finished_at     (referenced in UPDATE inside both functions)
--   * source          (referenced in INSERT inside generate_invoices_from_template)
--
-- PL/pgSQL defers SQL parsing — migration 350's CREATE FUNCTION will SUCCEED
-- at apply time. The mismatch only manifests at runtime when the functions
-- are invoked, raising column-not-found errors.
--
-- Source must have the columns named per 350's body (otherwise the function
-- would always fail on source too). The renames likely happened out-of-band.
-- These statements bring destination's column names into alignment with what
-- source uses + what migration 350's function bodies expect.
--
-- WHY APPLY THIS BETWEEN 345 AND 350: 345 creates the table; if we run these
-- before 345, table doesn't exist; if we run after 350, the functions are
-- already stored with stale references but they'll be parsed lazily, so the
-- order doesn't strictly matter — but apply between 345 and 350 keeps the
-- chain locally consistent at every step.

ALTER TABLE public.recurring_template_runs
  RENAME COLUMN invoices_generated TO invoice_count;

ALTER TABLE public.recurring_template_runs
  RENAME COLUMN completed_at TO finished_at;

ALTER TABLE public.recurring_template_runs
  ADD COLUMN IF NOT EXISTS source text;

-- recurring_template_items columns referenced inside generate_invoices_from_template body.
-- Source's recurring_template_items dump is empty (0 rows), so actual source types unconfirmed.
-- Inferred types:
--   unit_price integer    — LessonLoop convention is minor-unit integers (cf. amount_minor, total_minor)
--   tax_rate  numeric(5,2) — matches existing organisations.vat_rate type
-- Verify in Phase 5: call generate_invoices_from_template() against test data; adjust types
-- if runtime errors indicate (e.g. numeric overflow, type-cast failures).
ALTER TABLE public.recurring_template_items
  ADD COLUMN IF NOT EXISTS unit_price integer;

ALTER TABLE public.recurring_template_items
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);

-- Verification queries (run after the five statements above):
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='recurring_template_runs'
--     AND column_name IN ('invoice_count','finished_at','source','invoices_generated','completed_at')
--   ORDER BY column_name;
-- Expected post-apply: ['finished_at','invoice_count','source']
-- Should NOT contain: ['invoices_generated','completed_at']
--
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='recurring_template_items'
--     AND column_name IN ('unit_price','tax_rate')
--   ORDER BY column_name;
-- Expected post-apply: ['tax_rate','unit_price']


-- ============================================================
-- (no further sections — predictive scan found 0 other apply-time
-- drift issues in migrations 213-400 after the v2 scan with
-- function-body awareness)
-- ============================================================


-- ============================================================
-- SECTION 4 — Before migration 217  (idx 217 — `invoice_stats_materialised_view`)
-- Status: APPLIED 2026-05-04
-- ============================================================
-- Migration 217 creates a materialised view that filters on `status = 'outstanding'`
-- but `invoice_status` enum on destination has only {draft, sent, paid, overdue, void}.
-- Source must have 'outstanding' added out-of-band (no migration extends invoice_status
-- in the chain). Source has no live rows with status='outstanding' (per JSON dump
-- distinct values), so the view is purely a forward-compatible filter.
--
-- ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'outstanding';
--
-- Verified post-apply: enum_range = {draft, sent, paid, overdue, void, outstanding}.


-- ============================================================
-- SECTION 5 — Phase 5 prep, before edge function deploys / smoke tests
-- Status: APPLIED 2026-05-05
-- ============================================================
-- Source has columns destination's chain doesn't create (V9 fingerprint findings).
-- See migration-journal.md "Phase 3 final state" for full V9 drift breakdown.

ALTER TABLE public.make_up_credits
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS reminder_before_due_days integer DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS reminder_before_due_enabled boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS reminder_escalation_days integer DEFAULT 7 NOT NULL,
  ADD COLUMN IF NOT EXISTS reminder_escalation_enabled boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS reminder_overdue_days integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS reminder_overdue_enabled boolean DEFAULT true NOT NULL;


-- ============================================================
-- SECTION 6 — Phase 5 GRANT P0 fix
-- Status: APPLIED 2026-05-05 23:43 UTC
-- ============================================================
-- Discovered during Phase 5 smoke testing: anon, authenticated, service_role
-- had no DML privileges on any public table. Caused profile-ensure to 500 with
-- "permission denied for table profiles". Supabase's platform-default
-- ALTER DEFAULT PRIVILEGES were either not applied at destination project
-- creation or were absent before chain replay. New tables therefore inherited
-- zero DML grants for API roles. See migration-journal.md "Phase 5 anomalies".
-- Without this fix the app would 42501 on every PostgREST/supabase-js call
-- from the frontend post-cutover.

BEGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
COMMIT;

-- Verification queries:
-- SELECT grantee, count(*)::int FROM information_schema.role_table_grants
--   WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
--   GROUP BY grantee;  -- expect 7 privileges per role per table
-- SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclacl
--   FROM pg_default_acl WHERE defaclnamespace='public'::regnamespace;
--   -- expect rows for both 'postgres' and 'supabase_admin' with full ACL strings


-- ============================================================
-- SECTION 7 — Phase 6 Tier 3 prep: xero_connections schema drift
-- Status: APPLIED 2026-05-07 during T3.1 smoke test
-- ============================================================
-- Discovered during T3.1.A Xero OAuth smoke test: xero-oauth-callback function
-- calls supabase.upsert(..., { onConflict: 'org_id' }) which requires a
-- unique constraint on org_id. Source's table has one (otherwise their
-- function would fail identically); destination's didn't (xero_connections
-- was created out-of-band on source — see Section 2 + Phase 2 deferred work
-- in migration-journal.md). The migration chain only carried the PK on id.
--
-- Symptom: OAuth flow completes (token exchange + tenant fetch succeed),
-- callback redirects to <redirect_uri>?xero_error=save_failed.
--
-- Fix:

ALTER TABLE public.xero_connections
  ADD CONSTRAINT xero_connections_org_id_key UNIQUE (org_id);

-- Verification:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.xero_connections'::regclass AND contype = 'u';
-- Expected: xero_connections_org_id_key with definition UNIQUE (org_id)
--
-- Other Phase 2 deferred items for xero_connections still TBD before cutover:
--  - RLS policies (table has RLS enabled but no policies; service_role bypass works
--    but anon/authenticated calls would 403 — relevant if frontend ever queries this
--    table directly rather than via edge functions)
--  - Per-column indexes (e.g., on tenant_id for sync queries) — performance, not
--    correctness. Add if observed slow at scale.
