
-- [ATT-005] Audit logging for attendance record changes

CREATE OR REPLACE FUNCTION public.audit_attendance_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (
    org_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    before,
    after
  ) VALUES (
    COALESCE(NEW.org_id, OLD.org_id),
    auth.uid(),
    LOWER(TG_OP),
    'attendance_record',
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_attendance
AFTER INSERT OR UPDATE OR DELETE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.audit_attendance_changes();
