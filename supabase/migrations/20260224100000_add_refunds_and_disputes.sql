-- Refund tracking table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled')),
  stripe_refund_id TEXT,
  stripe_charge_id TEXT,
  initiated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Dispute tracking table
CREATE TABLE IF NOT EXISTS public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id),
  invoice_id UUID REFERENCES public.invoices(id),
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  stripe_charge_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'GBP',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'needs_response'
    CHECK (status IN (
      'needs_response', 'under_review', 'won', 'lost',
      'warning_closed', 'warning_needs_response', 'warning_under_review',
      'charge_refunded'
    )),
  evidence_due_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_refunds_org ON public.refunds(org_id);
CREATE INDEX idx_refunds_payment ON public.refunds(payment_id);
CREATE INDEX idx_refunds_invoice ON public.refunds(invoice_id);
CREATE INDEX idx_disputes_org ON public.disputes(org_id);
CREATE INDEX idx_disputes_active ON public.disputes(status)
  WHERE status NOT IN ('won', 'lost', 'warning_closed');

-- RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance team can view refunds"
  ON public.refunds FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

CREATE POLICY "Finance team can view disputes"
  ON public.disputes FOR SELECT
  USING (is_org_finance_team(auth.uid(), org_id));

-- Updated_at trigger for disputes
CREATE TRIGGER update_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
