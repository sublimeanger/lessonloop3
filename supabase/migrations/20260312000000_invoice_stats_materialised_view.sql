-- FIX 4 (Option B): Materialised view for invoice stats.
-- This replaces the live aggregation in get_invoice_stats with a pre-computed
-- view that refreshes every 5 minutes via pg_cron.
--
-- NOTE: This migration requires pg_cron to be enabled on the Supabase project.
-- Apply manually if pg_cron is not available.

-- Create the materialised view
CREATE MATERIALIZED VIEW IF NOT EXISTS invoice_stats_mv AS
SELECT
  org_id,
  COUNT(*) FILTER (WHERE status = 'outstanding' OR status = 'sent') AS outstanding_count,
  COALESCE(SUM(total_minor) FILTER (WHERE status = 'outstanding' OR status = 'sent'), 0) AS outstanding_total,
  COUNT(*) FILTER (WHERE status = 'overdue') AS overdue_count,
  COALESCE(SUM(total_minor) FILTER (WHERE status = 'overdue'), 0) AS overdue_total,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count,
  COALESCE(SUM(total_minor) FILTER (WHERE status = 'paid'), 0) AS paid_total,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'void') AS void_count,
  COUNT(*) AS total_count
FROM invoices
GROUP BY org_id;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS invoice_stats_mv_org_id_idx ON invoice_stats_mv (org_id);

-- Schedule refresh every 5 minutes (requires pg_cron extension)
-- Uncomment when pg_cron is available:
-- SELECT cron.schedule(
--   'refresh-invoice-stats',
--   '*/5 * * * *',
--   'REFRESH MATERIALIZED VIEW CONCURRENTLY invoice_stats_mv'
-- );
