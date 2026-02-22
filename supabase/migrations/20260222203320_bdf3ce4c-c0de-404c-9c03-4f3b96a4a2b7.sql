
CREATE OR REPLACE FUNCTION public.cleanup_attendance_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.attendance_records WHERE lesson_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_attendance_on_cancel
AFTER UPDATE OF status ON public.lessons
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status != 'cancelled')
EXECUTE FUNCTION public.cleanup_attendance_on_cancel();
