-- Track 0.1 Phase 2 — Audit triggers for per-user tables.
--
-- profiles and user_roles have no org_id (they're auth.users mirrors —
-- a single user spans multiple orgs). Cannot use the canonical
-- log_audit_event_singular helper from T01-P1 because audit_log.org_id
-- is NOT NULL.
--
-- Solution: write to platform_audit_log instead. Same surface that
-- captures webhook_stale_recovery events (T05-P1-C6) and future
-- cross-org platform events (T08-P2 cron health, etc).
--
-- Two separate trigger functions because the action semantics differ:
--   profiles → single 'profile_change' action with severity info
--              (routine personal-data movement: name, phone,
--              onboarding flag flip)
--   user_roles → 'user_role_grant' (INSERT) / 'user_role_revoke' (DELETE) /
--                'user_role_change' (UPDATE) with severity warning —
--                privilege movement deserves operator visibility, and
--                'warning' matches the existing webhook_stale_recovery
--                pattern for events worth a daily spot-check.
--
-- details payload shape (both triggers):
--   {
--     tg_op:           INSERT | UPDATE | DELETE,
--     actor_user_id:   auth.uid() of the calling user (NULL for service-role),
--     subject_user_id: the row's user identity (profile.id or user_role.user_id),
--     before:          to_jsonb(OLD) on UPDATE/DELETE, else NULL,
--     after:           to_jsonb(NEW) on INSERT/UPDATE, else NULL
--   }
-- user_roles also carries a top-level `role` field for cheap filtering.

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

-- ============================================================
-- user_roles audit trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _subject_user_id uuid;
  _action text;
  _details jsonb;
BEGIN
  _subject_user_id := COALESCE(NEW.user_id, OLD.user_id);

  _action := CASE TG_OP
    WHEN 'INSERT' THEN 'user_role_grant'
    WHEN 'DELETE' THEN 'user_role_revoke'
    WHEN 'UPDATE' THEN 'user_role_change'
  END;

  _details := jsonb_build_object(
    'tg_op', TG_OP,
    'actor_user_id', auth.uid(),
    'subject_user_id', _subject_user_id,
    'role', COALESCE(NEW.role::text, OLD.role::text),
    'before', CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    'after',  CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  INSERT INTO public.platform_audit_log (action, source, severity, details)
  VALUES (_action, 'user_roles_trigger', 'warning', _details);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_role_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_user_role_change() TO service_role;

COMMENT ON FUNCTION public.log_user_role_change() IS
  'T01-P2 audit trigger for the user_roles table. Writes to platform_audit_log because user_roles has no org_id. Actions: user_role_grant (INSERT) / user_role_revoke (DELETE) / user_role_change (UPDATE). Severity: warning (privilege movement deserves operator visibility).';

DROP TRIGGER IF EXISTS audit_user_role_changes ON public.user_roles;
CREATE TRIGGER audit_user_role_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_user_role_change();

NOTIFY pgrst, 'reload schema';
