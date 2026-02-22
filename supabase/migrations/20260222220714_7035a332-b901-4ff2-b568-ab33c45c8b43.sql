
-- (1) Reusable helper: is the org's subscription in a writable state?
CREATE OR REPLACE FUNCTION public.is_org_write_allowed(_org_id uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = _org_id
      AND subscription_status IN ('active', 'trialing', 'past_due')
  )
$$;

-- (2) Generic trigger function that blocks inserts for inactive orgs
CREATE OR REPLACE FUNCTION public.check_subscription_active()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF NOT public.is_org_write_allowed(NEW.org_id) THEN
    RAISE EXCEPTION 'Your subscription is inactive. Please renew to continue.';
  END IF;
  RETURN NEW;
END;
$$;

-- (3) Attach BEFORE INSERT triggers on key tables
CREATE TRIGGER enforce_subscription_active_students
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();

CREATE TRIGGER enforce_subscription_active_lessons
  BEFORE INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();

CREATE TRIGGER enforce_subscription_active_invoices
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();
