-- ============================================================
-- Fix dashboard & report audit findings
-- (DR-H1, DR-H2/H3, DR-M5)
-- Audit: audit-feature-15-dashboard-reports.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- DR-H1: get_revenue_report uses total_minor instead of paid_minor
-- Revenue should reflect money actually received, not money billed.
-- Changed SUM(i.total_minor) → SUM(COALESCE(i.paid_minor, 0))
-- in both current and previous period queries.
-- ────────────────────────────────────────────────────────────
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
  -- Current period: use paid_minor (actual amount received) not total_minor
  SELECT
    'current'::text AS period,
    to_char(i.issue_date, 'YYYY-MM') AS month,
    COALESCE(SUM(COALESCE(i.paid_minor, 0)), 0)::bigint AS paid_amount_minor,
    COUNT(*)::bigint AS invoice_count
  FROM invoices i
  WHERE i.org_id = _org_id
    AND i.status = 'paid'
    AND i.issue_date >= _start_date
    AND i.issue_date <= _end_date
  GROUP BY to_char(i.issue_date, 'YYYY-MM')

  UNION ALL

  -- Previous period: same fix — use paid_minor
  SELECT
    'previous'::text,
    to_char(i2.issue_date, 'YYYY-MM'),
    COALESCE(SUM(COALESCE(i2.paid_minor, 0)), 0)::bigint,
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

COMMENT ON FUNCTION public.get_revenue_report(uuid, date, date, date, date) IS
  'Revenue report: sums paid_minor (actual money received) for paid invoices. '
  'Must stay in sync with dashboard Revenue MTD which also uses paid_minor.';


-- ────────────────────────────────────────────────────────────
-- DR-M5: Drop orphaned materialised view invoice_stats_mv
-- This MV was superseded by the live-query get_invoice_stats
-- RPC in migration 20260315220003. The MV references
-- status = ''outstanding'' which doesn''t exist in the enum.
-- pg_cron schedule was never enabled. No code references it.
-- ────────────────────────────────────────────────────────────
DROP MATERIALIZED VIEW IF EXISTS invoice_stats_mv;
