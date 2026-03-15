-- Prevent recording attendance for future lessons.
-- Adds a trigger that checks the lesson's start_at is not in the future.
CREATE OR REPLACE FUNCTION check_attendance_not_future()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_start TIMESTAMPTZ;
BEGIN
  SELECT start_at INTO v_start FROM lessons WHERE id = NEW.lesson_id;
  IF v_start > NOW() THEN
    RAISE EXCEPTION 'Cannot record attendance for future lessons';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_not_future
  BEFORE INSERT OR UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION check_attendance_not_future();
