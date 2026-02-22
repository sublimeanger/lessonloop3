
CREATE OR REPLACE FUNCTION public.check_lesson_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _conflict_teacher RECORD;
  _conflict_room RECORD;
BEGIN
  -- Skip checks for cancelled lessons
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- 1. Teacher double-booking check (only if teacher_id is set)
  IF NEW.teacher_id IS NOT NULL THEN
    SELECT id, title, start_at INTO _conflict_teacher
    FROM public.lessons
    WHERE teacher_id = NEW.teacher_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND org_id = NEW.org_id
      AND status != 'cancelled'
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'CONFLICT:TEACHER:Teacher is already booked at this time (conflicts with "%")', _conflict_teacher.title;
    END IF;
  END IF;

  -- 2. Room double-booking check (only if room_id is set)
  IF NEW.room_id IS NOT NULL THEN
    SELECT id, title, start_at INTO _conflict_room
    FROM public.lessons
    WHERE room_id = NEW.room_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND org_id = NEW.org_id
      AND status != 'cancelled'
      AND start_at < NEW.end_at
      AND end_at > NEW.start_at
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'CONFLICT:ROOM:Room is already booked at this time (conflicts with "%")', _conflict_room.title;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER check_lesson_conflicts_insert
  BEFORE INSERT ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.check_lesson_conflicts();

CREATE TRIGGER check_lesson_conflicts_update
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.check_lesson_conflicts();
