-- Journey 11 Phase 1 — cleanup-invoice-pdf-orphans daily cron at 03:45 UTC.
-- Closes J11-F2 (orphan accumulation in the invoice-pdfs bucket).
--
-- Mirrors the canonical Pattern C used by webhook-retention-daily.
-- Slot reasoning: 03:30 = webhook-retention-daily (T05-P2). 03:45 places
-- this immediately after with no contention. Both run before the 06:00–09:00
-- morning peak.

-- ─── RPC fallback for the orphan sweep edge fn ─────────────────────
-- PostgREST typically does not expose the storage schema, so a direct
-- supabase-js .from('storage.objects') query fails. This SECURITY
-- DEFINER helper performs the same SELECT under the function owner's
-- privileges and is the path the edge fn normally takes (after the
-- direct query attempt fails). LIMIT 20000 matches the edge fn's
-- in-memory ceiling — invoice-pdfs cache size is well below this in
-- practice, but the cap is defensive.
CREATE OR REPLACE FUNCTION public.list_invoice_pdf_objects()
RETURNS TABLE (name text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'storage'
AS $$
  SELECT name, created_at
  FROM storage.objects
  WHERE bucket_id = 'invoice-pdfs'
  ORDER BY name ASC
  LIMIT 20000;
$$;

REVOKE ALL ON FUNCTION public.list_invoice_pdf_objects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_invoice_pdf_objects() TO service_role;

-- ─── Cron registration (Pattern C) ─────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'invoice-pdf-orphan-sweep-daily') THEN
    PERFORM cron.unschedule('invoice-pdf-orphan-sweep-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'invoice-pdf-orphan-sweep-daily',
  '45 3 * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/cleanup-invoice-pdf-orphans',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cron$
);

NOTIFY pgrst, 'reload schema';
