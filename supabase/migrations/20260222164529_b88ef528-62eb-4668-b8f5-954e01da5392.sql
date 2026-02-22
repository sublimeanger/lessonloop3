
CREATE OR REPLACE FUNCTION public.on_slot_released()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _match RECORD;
BEGIN
  -- Only 'sick' and 'family_emergency' open slots for others
  IF NEW.attendance_status NOT IN ('absent', 'cancelled_by_student')
    OR NEW.absence_reason_category NOT IN ('sick', 'family_emergency')
  THEN RETURN NEW; END IF;

  FOR _match IN
    SELECT waitlist_id FROM find_waitlist_matches(NEW.lesson_id, NEW.student_id, NEW.org_id) LIMIT 3
  LOOP
    UPDATE make_up_waitlist SET
      status = 'matched', matched_lesson_id = NEW.lesson_id, matched_at = NOW()
    WHERE id = _match.waitlist_id;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_slot_released
  AFTER INSERT OR UPDATE OF attendance_status, absence_reason_category
  ON attendance_records
  FOR EACH ROW EXECUTE FUNCTION on_slot_released();
