
-- Protect has_completed_onboarding from client-side writes
CREATE OR REPLACE FUNCTION public.protect_onboarding_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.has_completed_onboarding IS DISTINCT FROM OLD.has_completed_onboarding
     AND current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Cannot modify onboarding status directly';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_onboarding_flag
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_onboarding_flag();
