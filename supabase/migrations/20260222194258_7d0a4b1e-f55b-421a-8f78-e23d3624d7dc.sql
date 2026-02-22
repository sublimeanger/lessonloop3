CREATE OR REPLACE FUNCTION public.get_invoice_stats(_org_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'total_outstanding', COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_minor ELSE 0 END), 0),
    'overdue', COALESCE(SUM(CASE WHEN status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE) THEN total_minor ELSE 0 END), 0),
    'overdue_count', COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE)),
    'draft_count', COUNT(*) FILTER (WHERE status = 'draft'),
    'paid_total', COALESCE(SUM(CASE WHEN status = 'paid' THEN total_minor ELSE 0 END), 0),
    'paid_count', COUNT(*) FILTER (WHERE status = 'paid'),
    'active_payment_plans', COUNT(*) FILTER (WHERE payment_plan_enabled AND status NOT IN ('paid', 'void')),
    'plans_with_overdue', COUNT(*) FILTER (WHERE payment_plan_enabled AND id IN (
      SELECT invoice_id FROM invoice_installments WHERE status = 'overdue'
    ))
  ) FROM invoices
  WHERE org_id = _org_id
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE user_id = auth.uid()
        AND org_id = _org_id
        AND status = 'active'
    );
$function$;