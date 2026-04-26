-- Migration 1: invoice-pdfs storage + pdf_rev triggers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-pdfs',
  'invoice-pdfs',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "service_role full access on invoice-pdfs"
  ON storage.objects;

CREATE POLICY "service_role full access on invoice-pdfs"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'invoice-pdfs')
  WITH CHECK (bucket_id = 'invoice-pdfs');

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pdf_rev integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.invoices.pdf_rev IS
  'Cache invalidator for server-generated PDFs. Incremented by triggers on PDF-affecting mutations (invoices direct columns, invoice_items, invoice_installments, payments). The generate-invoice-pdf edge fn writes to {org_id}/{invoice_id}_{pdf_rev}.pdf.';

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (
    NEW.status IS DISTINCT FROM OLD.status
    OR NEW.total_minor IS DISTINCT FROM OLD.total_minor
    OR NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor
    OR NEW.tax_minor IS DISTINCT FROM OLD.tax_minor
    OR NEW.vat_rate IS DISTINCT FROM OLD.vat_rate
    OR NEW.paid_minor IS DISTINCT FROM OLD.paid_minor
    OR NEW.credit_applied_minor IS DISTINCT FROM OLD.credit_applied_minor
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
    OR NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
    OR NEW.notes IS DISTINCT FROM OLD.notes
    OR NEW.payment_plan_enabled IS DISTINCT FROM OLD.payment_plan_enabled
    OR NEW.installment_count IS DISTINCT FROM OLD.installment_count
    OR NEW.payer_guardian_id IS DISTINCT FROM OLD.payer_guardian_id
    OR NEW.payer_student_id IS DISTINCT FROM OLD.payer_student_id
  ) THEN
    NEW.pdf_rev := COALESCE(OLD.pdf_rev, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev ON public.invoices;
CREATE TRIGGER trg_bump_invoice_pdf_rev
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_invoice_pdf_rev();

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_id uuid;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices
     SET pdf_rev = pdf_rev + 1
   WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_items ON public.invoice_items;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_items();

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_installments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_id uuid;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices
     SET pdf_rev = pdf_rev + 1
   WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_installments ON public.invoice_installments;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_installments
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_installments
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_installments();

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _invoice_id uuid;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE public.invoices
     SET pdf_rev = pdf_rev + 1
   WHERE id = _invoice_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_payments ON public.payments;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_payments();

REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_installments() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_payments() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

-- Migration 2: orphan sweep RPC + cron
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