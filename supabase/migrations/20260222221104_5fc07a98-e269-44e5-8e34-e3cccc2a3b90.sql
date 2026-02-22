
-- Update check_subscription_active to also enforce trial expiry in real-time
CREATE OR REPLACE FUNCTION public.check_subscription_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- First check general subscription write eligibility
  IF NOT public.is_org_write_allowed(NEW.org_id) THEN
    RAISE EXCEPTION 'Your subscription is inactive. Please renew to continue.';
  END IF;

  -- Real-time trial expiry check (covers window between expiry and cron run)
  IF EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = NEW.org_id
      AND subscription_status = 'trialing'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < now()
  ) THEN
    RAISE EXCEPTION 'Your trial has expired. Please upgrade to continue.';
  END IF;

  RETURN NEW;
END;
$$;
