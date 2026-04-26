-- Track 0.1 Phase 2 — Audit triggers for per-user tables (profiles only).
-- The legacy user_roles table was dropped 2026-03-15; role surface is
-- audit-covered by audit_org_memberships. T01-P2 covers profiles only.

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