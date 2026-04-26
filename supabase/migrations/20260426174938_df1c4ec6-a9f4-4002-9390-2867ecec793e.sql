-- T01-P1: Audit triggers for parent-table org-scoped surfaces (16 tables)
-- Combines 20260505100000 + 20260505100100 from main.

CREATE OR REPLACE FUNCTION public.log_audit_event_singular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _entity_type text;
BEGIN
  IF TG_NARGS < 1 THEN
    RAISE EXCEPTION 'log_audit_event_singular requires entity_type as TG_ARGV[0]';
  END IF;
  _entity_type := TG_ARGV[0];

  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, before, after
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
  'T01-P1 canonical audit trigger helper. Writes singular entity_type via TG_ARGV[0]. Use for all new audit triggers on org-scoped tables.';

-- Parent-table triggers (12)
DROP TRIGGER IF EXISTS audit_refunds ON public.refunds;
CREATE TRIGGER audit_refunds AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('refund');

DROP TRIGGER IF EXISTS audit_make_up_credits ON public.make_up_credits;
CREATE TRIGGER audit_make_up_credits AFTER INSERT OR UPDATE OR DELETE ON public.make_up_credits
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('make_up_credit');

DROP TRIGGER IF EXISTS audit_term_adjustments ON public.term_adjustments;
CREATE TRIGGER audit_term_adjustments AFTER INSERT OR UPDATE OR DELETE ON public.term_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('term_adjustment');

DROP TRIGGER IF EXISTS audit_invoice_installments ON public.invoice_installments;
CREATE TRIGGER audit_invoice_installments AFTER INSERT OR UPDATE OR DELETE ON public.invoice_installments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('invoice_installment');

DROP TRIGGER IF EXISTS audit_invoice_items ON public.invoice_items;
CREATE TRIGGER audit_invoice_items AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('invoice_item');

DROP TRIGGER IF EXISTS audit_billing_runs ON public.billing_runs;
CREATE TRIGGER audit_billing_runs AFTER INSERT OR UPDATE OR DELETE ON public.billing_runs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('billing_run');

DROP TRIGGER IF EXISTS audit_rate_cards ON public.rate_cards;
CREATE TRIGGER audit_rate_cards AFTER INSERT OR UPDATE OR DELETE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('rate_card');

DROP TRIGGER IF EXISTS audit_teacher_profiles ON public.teacher_profiles;
CREATE TRIGGER audit_teacher_profiles AFTER INSERT OR UPDATE OR DELETE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('teacher_profile');

DROP TRIGGER IF EXISTS audit_guardians ON public.guardians;
CREATE TRIGGER audit_guardians AFTER INSERT OR UPDATE OR DELETE ON public.guardians
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('guardian');

DROP TRIGGER IF EXISTS audit_lesson_participants ON public.lesson_participants;
CREATE TRIGGER audit_lesson_participants AFTER INSERT OR UPDATE OR DELETE ON public.lesson_participants
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('lesson_participant');

DROP TRIGGER IF EXISTS audit_student_guardians ON public.student_guardians;
CREATE TRIGGER audit_student_guardians AFTER INSERT OR UPDATE OR DELETE ON public.student_guardians
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('student_guardian');

DROP TRIGGER IF EXISTS audit_terms ON public.terms;
CREATE TRIGGER audit_terms AFTER INSERT OR UPDATE OR DELETE ON public.terms
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('term');

-- Walk-surfaced triggers (4)
DROP TRIGGER IF EXISTS audit_recurring_invoice_templates ON public.recurring_invoice_templates;
CREATE TRIGGER audit_recurring_invoice_templates AFTER INSERT OR UPDATE OR DELETE ON public.recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('recurring_invoice_template');

DROP TRIGGER IF EXISTS audit_recurring_template_items ON public.recurring_template_items;
CREATE TRIGGER audit_recurring_template_items AFTER INSERT OR UPDATE OR DELETE ON public.recurring_template_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('recurring_template_item');

DROP TRIGGER IF EXISTS audit_recurring_template_recipients ON public.recurring_template_recipients;
CREATE TRIGGER audit_recurring_template_recipients AFTER INSERT OR UPDATE OR DELETE ON public.recurring_template_recipients
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('recurring_template_recipient');

DROP TRIGGER IF EXISTS audit_guardian_payment_preferences ON public.guardian_payment_preferences;
CREATE TRIGGER audit_guardian_payment_preferences AFTER INSERT OR UPDATE OR DELETE ON public.guardian_payment_preferences
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event_singular('guardian_payment_preference');

NOTIFY pgrst, 'reload schema';