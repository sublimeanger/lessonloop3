-- Journey 11 Phase 1 — Invoice PDF storage + revision tracking.
--
-- Server-generated PDFs are cached in the invoice-pdfs bucket at path
--   {org_id}/{invoice_id}_{rev}.pdf
-- where rev is the invoices.pdf_rev counter. The renderer is the same
-- as the client-side useInvoicePdf flow (lifted to _shared/invoice-pdf.ts
-- in C2), so the cached PDF is byte-equivalent to what a teacher would
-- download from the dashboard.
--
-- Cache invalidation: pdf_rev is incremented whenever a column or related
-- row that affects PDF output changes. Four trigger sources:
--   1. invoices BEFORE UPDATE — direct column changes (status, totals,
--      dates, payer, notes, payment plan flags).
--   2. invoice_items AFTER INSERT/UPDATE/DELETE — line items table.
--   3. invoice_installments AFTER INSERT/UPDATE/DELETE — payment schedule.
--   4. payments AFTER INSERT/UPDATE/DELETE — Paid / Amount Due block at
--      useInvoicePdf.ts:471-488 sums these.
--
-- Generation: the generate-invoice-pdf edge function (C3) reads/writes
-- this bucket via service-role.
-- Read access for end users (parent portal): signed URL only, no
-- direct public read.

-- ─── Bucket ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-pdfs',
  'invoice-pdfs',
  false,
  10485760,  -- 10MB cap per PDF (real invoices are <500KB; cap is defensive)
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage RLS: service-role only ────────────────────────────────
-- End users get signed URLs from the edge fn; no direct reads.
DROP POLICY IF EXISTS "service_role full access on invoice-pdfs"
  ON storage.objects;

CREATE POLICY "service_role full access on invoice-pdfs"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'invoice-pdfs')
  WITH CHECK (bucket_id = 'invoice-pdfs');

-- ─── pdf_rev counter on invoices ───────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS pdf_rev integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.invoices.pdf_rev IS
  'Cache invalidator for server-generated PDFs. Incremented by triggers on PDF-affecting mutations (invoices direct columns, invoice_items, invoice_installments, payments). The generate-invoice-pdf edge fn writes to {org_id}/{invoice_id}_{pdf_rev}.pdf.';

-- ─── Trigger 1: invoices direct column changes ────────────────────
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

-- ─── Trigger 2: invoice_items mutations ────────────────────────────
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

-- ─── Trigger 3: invoice_installments mutations ─────────────────────
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

-- ─── Trigger 4: payments mutations ─────────────────────────────────
-- The PDF includes a Paid / Amount Due block (useInvoicePdf.ts:471-488)
-- that sums the payments table. New/refunded/edited payments must
-- invalidate the cached PDF.
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
