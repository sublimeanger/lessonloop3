# public schema GRANTs missing — every PostgREST call would 42501

**Severity:** critical
**Status:** fixed
**Area:** auth
**Discovered:** 2026-05-05
**Fixed:** 2026-05-05
**Fixed in:** ad_hoc_pre_cutover_drift_fixes.sql Section 1
**Affected components:** all 93 public.* tables (destination project xmrhmxizpslhtkibqyfy)

## Symptom

Phase 5 Task C smoke test of `profile-ensure` returned HTTP 500. Direct PostgREST call against `public.profiles` returned `42501: permission denied for table profiles, hint: GRANT SELECT ON public.profiles TO service_role`.

## Root cause

Supabase's platform-default `ALTER DEFAULT PRIVILEGES` on the `public` schema were not applied at destination project setup. New tables created during chain replay therefore inherited zero DML grants for `service_role`, `anon`, `authenticated` — they had only `REFERENCES, TRIGGER, TRUNCATE`. Migration files contained no explicit `GRANT` (because source had defaults that handled it). The `postgres` role had full DML throughout, which is why Management API loader + `db query --linked` worked fine — both connect as postgres.

## Fix

Applied the canonical Supabase grant block as a single transaction:

```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
```

## Verification

- 5 sample tables (profiles, organisations, lessons, invoices, audit_log, xero_connections): each role has all 7 privileges
- pg_default_acl shows `supabase_admin` and `postgres` as default-privilege grantors → future CREATE TABLE statements auto-grant correctly
- profile-ensure returns HTTP 200 with user's actual profile row post-fix

## Lessons / follow-ups

Would have caused total app failure post-cutover — every PostgREST/supabase-js call from the frontend would 42501. For any new Supabase project: verify default privileges on `public` schema before running any migration chain. Quick check: `SELECT * FROM pg_default_acl WHERE defaclnamespace = 'public'::regnamespace;` should show entries for `supabase_admin` and `postgres`.
