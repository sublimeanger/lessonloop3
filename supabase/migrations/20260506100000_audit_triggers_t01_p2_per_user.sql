-- Track 0.1 Phase 2 — Audit triggers for per-user tables.
--
-- profiles has no org_id (it's an auth.users mirror — a single user
-- spans multiple orgs). Cannot use the canonical
-- log_audit_event_singular helper from T01-P1 because audit_log.org_id
-- is NOT NULL.
--
-- Solution: write to platform_audit_log instead. Same surface that
-- captures webhook_stale_recovery events (T05-P1-C6) and future
-- cross-org platform events (T08-P2 cron health, etc).
--
-- Scope note (T01-P2-fix1, 2026-04-26): the original T01-P0 walk also
-- listed the legacy per-user role table as needing this treatment.
-- That finding was stale — the legacy table was DROPPED on 15 March
-- 2026 in supabase/migrations/20260315220009_fix_roles_audit_findings.sql:98
-- as part of the role-surface consolidation onto org_memberships.
-- The role surface is fully audit-covered today by audit_org_memberships
-- (created 2026-01-20 in 20260120002039_5a489cca, one of the 9
-- grandfathered triggers T01-P1 deliberately preserved; T01-P3 will
-- migrate it to the singular-entity_type pattern in lockstep with
-- the other 8). T01-P2 therefore covers profiles only.
--
-- details payload shape:
--   {
--     tg_op:           INSERT | UPDATE | DELETE,
--     actor_user_id:   auth.uid() of the calling user (NULL for service-role),
--     subject_user_id: the row's user identity (profile.id),
--     before:          to_jsonb(OLD) on UPDATE/DELETE, else NULL,
--     after:           to_jsonb(NEW) on INSERT/UPDATE, else NULL
--   }

-- ============================================================
-- profiles audit trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subject_user_id uuid;
  _details jsonb;
BEGIN
  _subject_user_id := COALESCE(NEW.id, OLD.id);

  _details := jsonb_build_object(
    'tg_op', TG_OP,
    'actor_user_id', auth.uid(),
    'subject_user_id', _subject_user_id,
    'before', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    'after',  CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  INSERT INTO public.platform_audit_log (action, source, severity, details)
  VALUES ('profile_change', 'profiles_trigger', 'info', _details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_profile_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_profile_change() TO service_role;

COMMENT ON FUNCTION public.log_profile_change() IS
  'T01-P2 audit trigger for the profiles table. Writes to platform_audit_log because profiles has no org_id. Action: profile_change. Severity: info.';

DROP TRIGGER IF EXISTS audit_profile_changes ON public.profiles;
CREATE TRIGGER audit_profile_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_profile_change();

NOTIFY pgrst, 'reload schema';
