-- Fix: Replace SQL function with plpgsql for proper auth guard
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  -- Current period
  SELECT
    'current'::text AS period,
    to_char(i.issue_date, 'YYYY-MM') AS month,
    COALESCE(SUM(i.total_minor), 0)::bigint AS paid_amount_minor,
    COUNT(*)::bigint AS invoice_count
  FROM invoices i
  WHERE i.org_id = _org_id
    AND i.status = 'paid'
    AND i.issue_date >= _start_date
    AND i.issue_date <= _end_date
  GROUP BY to_char(i.issue_date, 'YYYY-MM')

  UNION ALL

  -- Previous period
  SELECT
    'previous'::text,
    to_char(i2.issue_date, 'YYYY-MM'),
    COALESCE(SUM(i2.total_minor), 0)::bigint,
    COUNT(*)::bigint
  FROM invoices i2
  WHERE i2.org_id = _org_id
    AND i2.status = 'paid'
    AND i2.issue_date >= _prev_start_date
    AND i2.issue_date <= _prev_end_date
  GROUP BY to_char(i2.issue_date, 'YYYY-MM')

  ORDER BY period, month;
END;
$$;