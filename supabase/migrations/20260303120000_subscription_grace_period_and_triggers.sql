-- SUB-M4: Add 7-day grace period for past_due orgs in is_org_write_allowed().
-- Previously past_due orgs could write indefinitely; now they are blocked
-- after 7 days, matching the frontend PAST_DUE_GRACE_DAYS constant.
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
      AND (
        subscription_status IN ('active', 'trialing')
        OR (
          subscription_status = 'past_due'
          AND past_due_since IS NOT NULL
          AND past_due_since > NOW() - INTERVAL '7 days'
        )
      )
  )
$$;

-- SUB-M5: Add check_subscription_active trigger to guardians,
-- attendance_records, and practice_logs (matching existing pattern
-- on students, lessons, invoices, resource_categories).
CREATE TRIGGER enforce_subscription_active_guardians
  BEFORE INSERT ON public.guardians
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();

CREATE TRIGGER enforce_subscription_active_attendance_records
  BEFORE INSERT ON public.attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();

CREATE TRIGGER enforce_subscription_active_practice_logs
  BEFORE INSERT ON public.practice_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.check_subscription_active();
