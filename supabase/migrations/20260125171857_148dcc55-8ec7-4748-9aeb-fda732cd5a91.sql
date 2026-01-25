-- Create subscription plan enum
CREATE TYPE subscription_plan AS ENUM ('trial', 'solo_teacher', 'academy', 'agency', 'custom');

-- Create subscription status enum
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'paused');

-- Add subscription fields to organisations table
ALTER TABLE public.organisations 
  ADD COLUMN subscription_plan subscription_plan NOT NULL DEFAULT 'trial',
  ADD COLUMN subscription_status subscription_status NOT NULL DEFAULT 'trialing',
  ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN max_students integer NOT NULL DEFAULT 50,
  ADD COLUMN max_teachers integer NOT NULL DEFAULT 1,
  ADD COLUMN stripe_customer_id text,
  ADD COLUMN stripe_subscription_id text;

-- Create index for Stripe lookups
CREATE INDEX idx_organisations_stripe_customer_id ON public.organisations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_organisations_stripe_subscription_id ON public.organisations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- Create index for trial expiry queries (for scheduled jobs)
CREATE INDEX idx_organisations_trial_ends_at ON public.organisations(trial_ends_at) WHERE subscription_status = 'trialing';

-- Add comment for documentation
COMMENT ON COLUMN public.organisations.subscription_plan IS 'Current subscription tier: trial, solo_teacher, academy, agency, or custom';
COMMENT ON COLUMN public.organisations.subscription_status IS 'Subscription state: trialing, active, past_due, cancelled, or paused';
COMMENT ON COLUMN public.organisations.trial_ends_at IS 'When the 14-day trial period expires';
COMMENT ON COLUMN public.organisations.max_students IS 'Maximum students allowed for this organisation based on plan';
COMMENT ON COLUMN public.organisations.max_teachers IS 'Maximum teachers allowed for this organisation based on plan';