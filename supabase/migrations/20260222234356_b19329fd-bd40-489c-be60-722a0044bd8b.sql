
-- PAY-014: Allow parents to view their children's make-up credits
CREATE POLICY "Parents can view their children credits"
ON public.make_up_credits
FOR SELECT
USING (
  public.is_parent_of_student(auth.uid(), student_id)
);

-- PAY-015: Restore auth check in get_invoice_stats
CREATE OR REPLACE FUNCTION public.get_invoice_stats(_org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RETURN '{}'::json;
  END IF;

  RETURN (
    SELECT json_build_object(
      'total_outstanding', COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_minor ELSE 0 END), 0),
      'overdue', COALESCE(SUM(CASE WHEN status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE) THEN total_minor ELSE 0 END), 0),
      'overdue_count', COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE)),
      'draft_count', COUNT(*) FILTER (WHERE status = 'draft'),
      'sent_count', COUNT(*) FILTER (WHERE status = 'sent' AND due_date >= CURRENT_DATE),
      'paid_total', COALESCE(SUM(CASE WHEN status = 'paid' THEN total_minor ELSE 0 END), 0),
      'paid_count', COUNT(*) FILTER (WHERE status = 'paid'),
      'void_count', COUNT(*) FILTER (WHERE status = 'void'),
      'total_count', COUNT(*),
      'active_payment_plans', COUNT(*) FILTER (WHERE payment_plan_enabled AND status NOT IN ('paid', 'void')),
      'plans_with_overdue', COUNT(*) FILTER (WHERE payment_plan_enabled AND id IN (
        SELECT invoice_id FROM invoice_installments WHERE status = 'overdue'
      ))
    ) FROM invoices WHERE org_id = _org_id
  );
END;
$function$;
