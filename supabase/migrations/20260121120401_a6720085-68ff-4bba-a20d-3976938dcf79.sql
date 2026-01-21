-- Create table for tracking Stripe checkout sessions and payments
CREATE TABLE public.stripe_checkout_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'gbp',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'failed')),
  payer_email TEXT,
  payer_user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX idx_stripe_sessions_org ON public.stripe_checkout_sessions(org_id);
CREATE INDEX idx_stripe_sessions_invoice ON public.stripe_checkout_sessions(invoice_id);
CREATE INDEX idx_stripe_sessions_stripe_id ON public.stripe_checkout_sessions(stripe_session_id);
CREATE INDEX idx_stripe_sessions_status ON public.stripe_checkout_sessions(status);

-- Enable RLS
ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Org finance team can view all sessions for their org
CREATE POLICY "Finance team can view org checkout sessions"
ON public.stripe_checkout_sessions
FOR SELECT
USING (is_org_finance_team(auth.uid(), org_id));

-- Policy: Invoice payers can view their own checkout sessions
CREATE POLICY "Payers can view their checkout sessions"
ON public.stripe_checkout_sessions
FOR SELECT
USING (is_invoice_payer(auth.uid(), invoice_id));

-- Policy: Insert via service role only (edge functions)
-- No user-facing INSERT policy needed as sessions are created server-side

-- Add comment for documentation
COMMENT ON TABLE public.stripe_checkout_sessions IS 'Tracks Stripe checkout sessions for invoice payments';