
-- Add cancels_at to the protected subscription fields trigger
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  _role := coalesce(current_setting('request.jwt.claims', true)::json->>'role', '');

  IF _role != 'service_role' THEN
    NEW.subscription_plan      := OLD.subscription_plan;
    NEW.subscription_status    := OLD.subscription_status;
    NEW.max_students           := OLD.max_students;
    NEW.max_teachers           := OLD.max_teachers;
    NEW.stripe_customer_id     := OLD.stripe_customer_id;
    NEW.stripe_subscription_id := OLD.stripe_subscription_id;
    NEW.trial_ends_at          := OLD.trial_ends_at;
    NEW.past_due_since         := OLD.past_due_since;
    NEW.cancels_at             := OLD.cancels_at;
  END IF;

  RETURN NEW;
END;
$$;
