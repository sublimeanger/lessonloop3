-- Fix trial_ends_at default to 30 days instead of 14
ALTER TABLE public.organisations 
ALTER COLUMN trial_ends_at 
SET DEFAULT (now() + interval '30 days');

-- Update comment to reflect correct trial period
COMMENT ON COLUMN public.organisations.trial_ends_at IS 'When the 30-day trial period expires';