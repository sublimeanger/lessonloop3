-- FIX 6: is_open_slot never set to false when a student is assigned
-- Create a trigger that auto-clears is_open_slot when a participant is added

CREATE OR REPLACE FUNCTION clear_open_slot_on_participant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE lessons
  SET is_open_slot = false
  WHERE id = NEW.lesson_id AND is_open_slot = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clear_open_slot
  AFTER INSERT ON lesson_participants
  FOR EACH ROW
  EXECUTE FUNCTION clear_open_slot_on_participant();
