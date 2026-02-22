
-- Create the check_teacher_limit function
CREATE OR REPLACE FUNCTION public.check_teacher_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _current_count integer;
  _max_teachers integer;
BEGIN
  -- Only check for teacher-countable roles
  IF NEW.role NOT IN ('owner', 'admin', 'teacher') THEN
    RETURN NEW;
  END IF;

  -- Only check active memberships
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO _current_count
  FROM public.org_memberships
  WHERE org_id = NEW.org_id
    AND role IN ('owner', 'admin', 'teacher')
    AND status = 'active';

  SELECT max_teachers INTO _max_teachers
  FROM public.organisations
  WHERE id = NEW.org_id;

  IF _current_count >= _max_teachers THEN
    RAISE EXCEPTION 'Teacher limit reached for this plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER enforce_teacher_limit
  BEFORE INSERT ON public.org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_teacher_limit();
