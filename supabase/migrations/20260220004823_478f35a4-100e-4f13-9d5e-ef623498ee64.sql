ALTER TABLE public.organisations
  ADD COLUMN schedule_start_hour integer NOT NULL DEFAULT 7,
  ADD COLUMN schedule_end_hour integer NOT NULL DEFAULT 21;

-- Validation trigger to ensure valid range
CREATE OR REPLACE FUNCTION public.validate_schedule_hours()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.schedule_start_hour < 0 OR NEW.schedule_start_hour > 23 THEN
    RAISE EXCEPTION 'schedule_start_hour must be between 0 and 23';
  END IF;
  IF NEW.schedule_end_hour < 0 OR NEW.schedule_end_hour > 23 THEN
    RAISE EXCEPTION 'schedule_end_hour must be between 0 and 23';
  END IF;
  IF NEW.schedule_end_hour <= NEW.schedule_start_hour THEN
    RAISE EXCEPTION 'schedule_end_hour must be greater than schedule_start_hour';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_org_schedule_hours
BEFORE INSERT OR UPDATE ON public.organisations
FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_hours();