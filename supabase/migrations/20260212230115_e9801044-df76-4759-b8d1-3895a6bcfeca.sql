
-- Add Stripe Connect columns to organisations
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_status text DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS platform_fee_percent numeric DEFAULT 0;
