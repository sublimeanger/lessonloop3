CREATE OR REPLACE FUNCTION public.get_invoice_stats(_org_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT json_build_object(
    'total_outstanding', COALESCE(SUM(CASE WHEN status IN ('sent', 'overdue') THEN total_minor ELSE 0 END), 0),
    'overdue', COALESCE(SUM(CASE WHEN status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE) THEN total_minor ELSE 0 END), 0),
    'overdue_count', COUNT(*) FILTER (WHERE status = 'overdue' OR (status = 'sent' AND due_date < CURRENT_DATE)),
    'draft_count', COUNT(*) FILTER (WHERE status = 'draft'),
    'paid_total', COALESCE(SUM(CASE WHEN status = 'paid' THEN total_minor ELSE 0 END), 0),
    'paid_count', COUNT(*) FILTER (WHERE status = 'paid')
  ) FROM invoices WHERE org_id = _org_id;
$$;