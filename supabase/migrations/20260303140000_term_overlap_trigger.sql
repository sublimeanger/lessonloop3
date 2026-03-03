-- TERM-M1: Server-side term overlap validation.
-- Prevents overlapping date ranges within the same org.
CREATE OR REPLACE FUNCTION public.check_term_overlap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.terms
    WHERE org_id = NEW.org_id
      AND id != NEW.id
      AND daterange(start_date, end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'Term dates overlap with an existing term';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_term_no_overlap
  BEFORE INSERT OR UPDATE ON public.terms
  FOR EACH ROW
  EXECUTE FUNCTION public.check_term_overlap();
