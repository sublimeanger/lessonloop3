
-- When a participant is removed from a lesson, restore any associated make-up credit and waitlist entry
CREATE OR REPLACE FUNCTION public.on_makeup_participant_removed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _waitlist RECORD;
BEGIN
  -- Check if removed participant was a make-up booking
  SELECT * INTO _waitlist
  FROM make_up_waitlist
  WHERE booked_lesson_id = OLD.lesson_id
    AND student_id = OLD.student_id
    AND status = 'booked'
  LIMIT 1;

  IF NOT FOUND THEN RETURN OLD; END IF;

  -- Restore credit if one was redeemed for this lesson
  IF _waitlist.credit_id IS NOT NULL THEN
    UPDATE make_up_credits
    SET redeemed_at = NULL, redeemed_lesson_id = NULL, updated_at = NOW()
    WHERE id = _waitlist.credit_id
      AND redeemed_lesson_id = OLD.lesson_id;
  END IF;

  -- Reset waitlist entry back to waiting
  UPDATE make_up_waitlist
  SET status = 'waiting',
      booked_lesson_id = NULL,
      matched_lesson_id = NULL,
      matched_at = NULL,
      offered_at = NULL,
      responded_at = NULL,
      updated_at = NOW()
  WHERE id = _waitlist.id;

  -- Audit
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (OLD.org_id, auth.uid(), 'makeup_credit_restored', 'make_up_waitlist', _waitlist.id,
    jsonb_build_object('student_id', OLD.student_id, 'lesson_id', OLD.lesson_id, 'credit_id', _waitlist.credit_id));

  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_makeup_participant_removed
  AFTER DELETE ON lesson_participants
  FOR EACH ROW
  EXECUTE FUNCTION on_makeup_participant_removed();
