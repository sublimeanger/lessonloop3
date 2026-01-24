-- Update the streak update function to call notification edge function for milestones
CREATE OR REPLACE FUNCTION public.update_practice_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_id uuid;
  _org_id uuid;
  _practice_date date;
  _current_streak record;
  _new_current integer;
  _new_longest integer;
  _streak_start date;
  _is_milestone boolean := false;
BEGIN
  _student_id := NEW.student_id;
  _org_id := NEW.org_id;
  _practice_date := NEW.practice_date;

  -- Get current streak record
  SELECT * INTO _current_streak
  FROM public.practice_streaks
  WHERE student_id = _student_id;

  IF _current_streak IS NULL THEN
    -- First practice log for this student
    INSERT INTO public.practice_streaks (
      student_id, org_id, current_streak, longest_streak, 
      last_practice_date, streak_started_at
    ) VALUES (
      _student_id, _org_id, 1, 1, _practice_date, _practice_date
    );
    _new_current := 1;
  ELSE
    -- Check if this extends the streak
    IF _current_streak.last_practice_date IS NULL THEN
      -- No previous practice
      _new_current := 1;
      _streak_start := _practice_date;
    ELSIF _practice_date = _current_streak.last_practice_date THEN
      -- Same day practice, no change to streak
      RETURN NEW;
    ELSIF _practice_date = _current_streak.last_practice_date + 1 THEN
      -- Consecutive day, extend streak
      _new_current := _current_streak.current_streak + 1;
      _streak_start := _current_streak.streak_started_at;
    ELSIF _practice_date > _current_streak.last_practice_date + 1 THEN
      -- Gap in practice, reset streak
      _new_current := 1;
      _streak_start := _practice_date;
    ELSE
      -- Practice date is before last practice date (backdated), recalculate
      -- For simplicity, just return without updating
      RETURN NEW;
    END IF;

    _new_longest := GREATEST(_current_streak.longest_streak, _new_current);

    UPDATE public.practice_streaks
    SET 
      current_streak = _new_current,
      longest_streak = _new_longest,
      last_practice_date = _practice_date,
      streak_started_at = _streak_start,
      updated_at = now()
    WHERE student_id = _student_id;
  END IF;

  -- Check if this is a milestone streak (3, 7, 14, 30, 60, 100)
  IF _new_current IN (3, 7, 14, 30, 60, 100) THEN
    -- Queue a notification (we'll use pg_net extension if available, 
    -- otherwise this will be handled client-side)
    -- For now, we just log that a milestone was hit
    INSERT INTO public.audit_log (
      org_id, 
      actor_user_id, 
      action, 
      entity_type, 
      entity_id, 
      after
    ) VALUES (
      _org_id,
      NULL,
      'streak_milestone',
      'practice_streaks',
      _student_id,
      jsonb_build_object('streak', _new_current, 'student_id', _student_id)
    );
  END IF;

  RETURN NEW;
END;
$$;