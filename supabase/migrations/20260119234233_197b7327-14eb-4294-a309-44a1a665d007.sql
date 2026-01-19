-- Drop partial enums from failed migration
DROP TYPE IF EXISTS invoice_status CASCADE;
DROP TYPE IF EXISTS payment_method CASCADE;
DROP TYPE IF EXISTS payment_provider CASCADE;
DROP TYPE IF EXISTS billing_run_type CASCADE;
DROP TYPE IF EXISTS billing_run_status CASCADE;

-- Create enums for billing
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'void');
CREATE TYPE payment_method AS ENUM ('card', 'bank_transfer', 'cash', 'other');
CREATE TYPE payment_provider AS ENUM ('stripe', 'manual');
CREATE TYPE billing_run_type AS ENUM ('monthly', 'term', 'custom');
CREATE TYPE billing_run_status AS ENUM ('pending', 'completed', 'failed');

-- 1) invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  currency_code text NOT NULL DEFAULT 'GBP',
  subtotal_minor integer NOT NULL DEFAULT 0,
  tax_minor integer NOT NULL DEFAULT 0,
  total_minor integer NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  payer_guardian_id uuid REFERENCES public.guardians(id) ON DELETE SET NULL,
  payer_student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, invoice_number)
);

-- 2) invoice_items table
CREATE TABLE public.invoice_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_minor integer NOT NULL,
  amount_minor integer NOT NULL,
  linked_lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) payments table
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_minor integer NOT NULL,
  currency_code text NOT NULL DEFAULT 'GBP',
  method payment_method NOT NULL DEFAULT 'other',
  provider payment_provider NOT NULL DEFAULT 'manual',
  provider_reference text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) billing_runs table
CREATE TABLE public.billing_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  run_type billing_run_type NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  status billing_run_status NOT NULL DEFAULT 'pending',
  summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Function to generate invoice numbers: LL-YYYY-00001
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year text;
  _count integer;
  _number text;
BEGIN
  _year := to_char(CURRENT_DATE, 'YYYY');
  
  SELECT COUNT(*) + 1 INTO _count
  FROM public.invoices
  WHERE org_id = _org_id
    AND invoice_number LIKE 'LL-' || _year || '-%';
  
  _number := 'LL-' || _year || '-' || LPAD(_count::text, 5, '0');
  
  RETURN _number;
END;
$$;

-- Trigger to auto-generate invoice number
CREATE OR REPLACE FUNCTION public.set_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := generate_invoice_number(NEW.org_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_invoice_number_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invoice_number();

-- Updated_at trigger for invoices
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoices
CREATE POLICY "Members can view org invoices"
  ON public.invoices FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update invoices"
  ON public.invoices FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for invoice_items
CREATE POLICY "Members can view org invoice items"
  ON public.invoice_items FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create invoice items"
  ON public.invoice_items FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update invoice items"
  ON public.invoice_items FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete invoice items"
  ON public.invoice_items FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for payments
CREATE POLICY "Members can view org payments"
  ON public.payments FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- RLS Policies for billing_runs
CREATE POLICY "Members can view org billing runs"
  ON public.billing_runs FOR SELECT
  USING (is_org_member(auth.uid(), org_id));

CREATE POLICY "Admins can create billing runs"
  ON public.billing_runs FOR INSERT
  WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can update billing runs"
  ON public.billing_runs FOR UPDATE
  USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Admins can delete billing runs"
  ON public.billing_runs FOR DELETE
  USING (is_org_admin(auth.uid(), org_id));

-- Indexes for performance
CREATE INDEX idx_invoices_org_id ON public.invoices(org_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_payer_guardian ON public.invoices(payer_guardian_id);
CREATE INDEX idx_invoices_payer_student ON public.invoices(payer_student_id);
CREATE INDEX idx_invoice_items_invoice_id ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_items_org_id ON public.invoice_items(org_id);
CREATE INDEX idx_invoice_items_lesson_id ON public.invoice_items(linked_lesson_id);
CREATE INDEX idx_payments_org_id ON public.payments(org_id);
CREATE INDEX idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX idx_billing_runs_org_id ON public.billing_runs(org_id);
CREATE INDEX idx_billing_runs_status ON public.billing_runs(status);