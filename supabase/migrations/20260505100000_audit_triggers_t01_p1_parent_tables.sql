-- Track 0.1 Phase 1 — Audit triggers for parent-table org-scoped surfaces.
--
-- Adds audit triggers to 12 of the 13 roadmap-named business-critical
-- tables that have org_id. The 13th (profiles) lacks org_id and is
-- handled in T01-P2 via platform_audit_log.
--
-- Pattern: a new canonical helper log_audit_event_singular() that mirrors
-- the existing audit_attendance_changes shape exactly:
--   - singular entity_type (vs the older log_audit_event which writes
--     plural TG_TABLE_NAME)
--   - COALESCE(NEW.org_id, OLD.org_id) (DELETE-safe)
--   - LOWER(TG_OP) for action ('insert' / 'update' / 'delete')
--   - full to_jsonb snapshots in before / after
--
-- The existing 9 audit triggers (using the older log_audit_event helper)
-- are NOT touched in P1. T01-P3 normalises them as part of the C50
-- entity_type plural->singular pass.
--
-- Each trigger uses a per-table TG_ARGV to pass the singular entity_type
-- name explicitly. This keeps the helper generic without hardcoding a
-- depluralisation rule (which would have to handle irregulars like
-- 'guardians' -> 'guardian', 'students' -> 'student', plus edge cases like
-- 'invoice_items' -> 'invoice_item').

-- ============================================================
-- Canonical helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event_singular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entity_type text;
BEGIN
  -- TG_ARGV[0] is the singular entity_type name passed at trigger creation.
  -- Required: every CREATE TRIGGER using this function must pass an
  -- entity_type as the first argument.
  IF TG_NARGS < 1 THEN
    RAISE EXCEPTION 'log_audit_event_singular requires entity_type as TG_ARGV[0]';
  END IF;
  _entity_type := TG_ARGV[0];

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
    _entity_type,
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

REVOKE ALL ON FUNCTION public.log_audit_event_singular() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event_singular() TO service_role;

COMMENT ON FUNCTION public.log_audit_event_singular() IS
  'T01-P1 canonical audit trigger helper. Writes singular entity_type via TG_ARGV[0]. Use for all new audit triggers on org-scoped tables. The older log_audit_event() (plural via TG_TABLE_NAME) is preserved for backwards compatibility with existing 9 triggers; T01-P3 will migrate those.';

-- ============================================================
-- Triggers (12 tables, one per CREATE TRIGGER block)
-- ============================================================

-- 1. refunds
DROP TRIGGER IF EXISTS audit_refunds ON public.refunds;
CREATE TRIGGER audit_refunds
  AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('refund');

-- 2. make_up_credits
DROP TRIGGER IF EXISTS audit_make_up_credits ON public.make_up_credits;
CREATE TRIGGER audit_make_up_credits
  AFTER INSERT OR UPDATE OR DELETE ON public.make_up_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('make_up_credit');

-- 3. term_adjustments
DROP TRIGGER IF EXISTS audit_term_adjustments ON public.term_adjustments;
CREATE TRIGGER audit_term_adjustments
  AFTER INSERT OR UPDATE OR DELETE ON public.term_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('term_adjustment');

-- 4. invoice_installments
DROP TRIGGER IF EXISTS audit_invoice_installments ON public.invoice_installments;
CREATE TRIGGER audit_invoice_installments
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('invoice_installment');

-- 5. invoice_items
DROP TRIGGER IF EXISTS audit_invoice_items ON public.invoice_items;
CREATE TRIGGER audit_invoice_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('invoice_item');

-- 6. billing_runs
DROP TRIGGER IF EXISTS audit_billing_runs ON public.billing_runs;
CREATE TRIGGER audit_billing_runs
  AFTER INSERT OR UPDATE OR DELETE ON public.billing_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('billing_run');

-- 7. rate_cards
DROP TRIGGER IF EXISTS audit_rate_cards ON public.rate_cards;
CREATE TRIGGER audit_rate_cards
  AFTER INSERT OR UPDATE OR DELETE ON public.rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('rate_card');

-- 8. teacher_profiles
DROP TRIGGER IF EXISTS audit_teacher_profiles ON public.teacher_profiles;
CREATE TRIGGER audit_teacher_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.teacher_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('teacher_profile');

-- 9. guardians
DROP TRIGGER IF EXISTS audit_guardians ON public.guardians;
CREATE TRIGGER audit_guardians
  AFTER INSERT OR UPDATE OR DELETE ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('guardian');

-- 10. lesson_participants
DROP TRIGGER IF EXISTS audit_lesson_participants ON public.lesson_participants;
CREATE TRIGGER audit_lesson_participants
  AFTER INSERT OR UPDATE OR DELETE ON public.lesson_participants
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('lesson_participant');

-- 11. student_guardians
DROP TRIGGER IF EXISTS audit_student_guardians ON public.student_guardians;
CREATE TRIGGER audit_student_guardians
  AFTER INSERT OR UPDATE OR DELETE ON public.student_guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('student_guardian');

-- 12. terms
DROP TRIGGER IF EXISTS audit_terms ON public.terms;
CREATE TRIGGER audit_terms
  AFTER INSERT OR UPDATE OR DELETE ON public.terms
  FOR EACH ROW
  EXECUTE FUNCTION public.log_audit_event_singular('term');

NOTIFY pgrst, 'reload schema';
