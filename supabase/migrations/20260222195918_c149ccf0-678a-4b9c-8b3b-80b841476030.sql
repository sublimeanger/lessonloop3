
CREATE OR REPLACE FUNCTION public.check_student_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _current_count integer;
  _max_students integer;
BEGIN
  SELECT COUNT(*) INTO _current_count
  FROM public.students
  WHERE org_id = NEW.org_id
    AND deleted_at IS NULL
    AND status != 'inactive';

  SELECT max_students INTO _max_students
  FROM public.organisations
  WHERE id = NEW.org_id;

  IF _current_count >= _max_students THEN
    RAISE EXCEPTION 'Student limit reached for this plan. Please upgrade.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_student_limit
  BEFORE INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.check_student_limit();
