-- Server-side revenue report aggregation
-- Returns monthly revenue grouped by issue_date month for current and previous periods
CREATE OR REPLACE FUNCTION public.get_revenue_report(
  _org_id uuid,
  _start_date date,
  _end_date date,
  _prev_start_date date,
  _prev_end_date date
)
RETURNS TABLE (
  period text,
  month text,
  paid_amount_minor bigint,
  invoice_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- Verify caller has finance-team access
  SELECT 1 / (CASE WHEN is_org_finance_team(auth.uid(), _org_id) THEN 1 ELSE 0 END);

  -- Current period
  SELECT
    'current'::text AS period,
    to_char(issue_date, 'YYYY-MM') AS month,
    COALESCE(SUM(total_minor), 0)::bigint AS paid_amount_minor,
    COUNT(*)::bigint AS invoice_count
  FROM invoices
  WHERE org_id = _org_id
    AND status = 'paid'
    AND issue_date >= _start_date
    AND issue_date <= _end_date
  GROUP BY to_char(issue_date, 'YYYY-MM')

  UNION ALL

  -- Previous period
  SELECT
    'previous'::text AS period,
    to_char(issue_date, 'YYYY-MM') AS month,
    COALESCE(SUM(total_minor), 0)::bigint AS paid_amount_minor,
    COUNT(*)::bigint AS invoice_count
  FROM invoices
  WHERE org_id = _org_id
    AND status = 'paid'
    AND issue_date >= _prev_start_date
    AND issue_date <= _prev_end_date
  GROUP BY to_char(issue_date, 'YYYY-MM')
  ORDER BY period, month;
$$;