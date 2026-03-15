-- SG-09: Prevent inserting open slots with start_at in the past.
-- Allows 1 hour of clock skew to avoid false positives.
-- Only applies to new open slot inserts, not updates or regular lessons.

CREATE OR REPLACE FUNCTION public.prevent_past_open_slot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_open_slot = true AND NEW.start_at < (now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Cannot create open slots in the past';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_past_open_slot
  BEFORE INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_past_open_slot();
