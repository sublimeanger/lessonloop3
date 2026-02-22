
-- [ATT-003] Enforce that attendance records can only be created for lesson participants

CREATE OR REPLACE FUNCTION public.validate_attendance_participant()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.lesson_participants
    WHERE lesson_id = NEW.lesson_id AND student_id = NEW.student_id
  ) THEN
    RAISE EXCEPTION 'Student is not a participant of this lesson';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_attendance_participant
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW
EXECUTE FUNCTION public.validate_attendance_participant();
