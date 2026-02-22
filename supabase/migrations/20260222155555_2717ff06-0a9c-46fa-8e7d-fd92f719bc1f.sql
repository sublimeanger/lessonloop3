
-- Create invoice_installments table
CREATE TABLE public.invoice_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount_minor INTEGER NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'void')),
  paid_at TIMESTAMPTZ,
  payment_id UUID REFERENCES public.payments(id),
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (invoice_id, installment_number)
);

-- Indexes
CREATE INDEX idx_installments_invoice ON public.invoice_installments(invoice_id);
CREATE INDEX idx_installments_org_status ON public.invoice_installments(org_id, status);
CREATE INDEX idx_installments_due_date ON public.invoice_installments(due_date)
  WHERE status IN ('pending', 'overdue');

-- RLS
ALTER TABLE public.invoice_installments ENABLE ROW LEVEL SECURITY;

-- Staff can view installments for their org
CREATE POLICY "Org staff can view installments"
  ON public.invoice_installments FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

-- Finance team can manage installments
CREATE POLICY "Org finance team can manage installments"
  ON public.invoice_installments FOR ALL
  USING (public.is_org_finance_team(auth.uid(), org_id))
  WITH CHECK (public.is_org_finance_team(auth.uid(), org_id));

-- Parents can view installments for their invoices
CREATE POLICY "Parents can view their installments"
  ON public.invoice_installments FOR SELECT
  USING (public.is_invoice_payer(auth.uid(), invoice_id));

-- Updated_at trigger
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.invoice_installments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment plan columns to invoices
ALTER TABLE public.invoices ADD COLUMN payment_plan_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.invoices ADD COLUMN installment_count INTEGER;
ALTER TABLE public.invoices ADD COLUMN paid_minor INTEGER DEFAULT 0;
