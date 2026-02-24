
-- Add missing branding columns to organisations
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS invoice_number_prefix TEXT DEFAULT 'LL',
  ADD COLUMN IF NOT EXISTS invoice_number_digits INTEGER DEFAULT 5;

-- Create guardian_payment_preferences for Stripe customer ID storage
CREATE TABLE IF NOT EXISTS public.guardian_payment_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guardian_id UUID NOT NULL REFERENCES public.guardians(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  auto_pay_enabled BOOLEAN DEFAULT false,
  default_payment_method_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardian_id, org_id)
);

ALTER TABLE public.guardian_payment_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view payment preferences"
  ON public.guardian_payment_preferences FOR SELECT
  USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Staff can manage payment preferences"
  ON public.guardian_payment_preferences FOR ALL
  USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parents can view own payment preferences"
  ON public.guardian_payment_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_payment_preferences.guardian_id
        AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Parents can update own payment preferences"
  ON public.guardian_payment_preferences FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.guardians g
      WHERE g.id = guardian_payment_preferences.guardian_id
        AND g.user_id = auth.uid()
    )
  );

-- Create push_tokens table for mobile push notifications
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
