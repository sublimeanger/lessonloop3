ALTER TABLE public.organisations DISABLE TRIGGER protect_org_subscription_fields;

UPDATE public.organisations 
SET trial_ends_at = NOW() + INTERVAL '365 days'
WHERE subscription_status = 'trialing'
  AND trial_ends_at < NOW();

ALTER TABLE public.organisations ENABLE TRIGGER protect_org_subscription_fields;