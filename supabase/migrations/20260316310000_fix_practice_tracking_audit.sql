-- =============================================================================
-- Fix practice tracking audit findings (F1–F6)
-- F1 HIGH:   Restore backdated-log recalculation lost in webhook migration
-- F2 MEDIUM: Add student_id ↔ org_id validation in streak trigger
-- F3 MEDIUM: Lock down practice_streaks INSERT/UPDATE to trigger-only
-- F4 MEDIUM: Make streak calculation timezone-aware using org timezone
-- F5 LOW:    Add DELETE policy on practice_logs
-- F6 LOW:    Add FK on teacher_user_id → auth.users(id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- F3: Lock down practice_streaks INSERT/UPDATE to service-role / trigger only
-- The SECURITY DEFINER trigger bypasses RLS, so authenticated users should
-- never write directly to practice_streaks.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own streaks" ON public.practice_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON public.practice_streaks;
DROP POLICY IF EXISTS "System can insert streaks" ON public.practice_streaks;
DROP POLICY IF EXISTS "System can update streaks" ON public.practice_streaks;
-- No replacement INSERT/UPDATE policies: only SECURITY DEFINER trigger writes.

-- ---------------------------------------------------------------------------
-- F1 + F2 + F4: Rewrite update_practice_streak()
--   - Restores backdated-log recalculation from 20260222225228
--   - Adds student ↔ org validation (F2)
--   - Converts practice_date to org-local date for streak comparison (F4)
--   - Preserves pg_net webhook for milestones from 20260303180000
-- ---------------------------------------------------------------------------
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
  _last_date date;
  _student_org_id uuid;
  _org_tz text;
BEGIN
  _student_id := NEW.student_id;
  _org_id := NEW.org_id;

  -- F2: Validate student belongs to the claimed org
  SELECT s.org_id INTO _student_org_id
  FROM public.students s
  WHERE s.id = _student_id;

  IF _student_org_id IS NULL OR _student_org_id <> _org_id THEN
    RAISE EXCEPTION 'practice_logs student_id % does not belong to org_id %',
      _student_id, _org_id;
  END IF;

  -- F4: Look up org timezone and convert practice_date to org-local date
  SELECT COALESCE(o.timezone, 'Europe/London') INTO _org_tz
  FROM public.organisations o
  WHERE o.id = _org_id;

  _org_tz := COALESCE(_org_tz, 'Europe/London');

  -- Convert the practice_date (a plain DATE) to the org-local date.
  -- practice_date is already a DATE chosen by the client, so use it directly.
  -- The timezone matters for "today" comparisons with last_practice_date.
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
      -- F1: Backdated log — recalculate streak from all logs
      WITH ordered_dates AS (
        SELECT DISTINCT practice_date AS pd
        FROM public.practice_logs
        WHERE student_id = _student_id
        UNION
        SELECT _practice_date AS pd
        ORDER BY pd DESC
      ),
      streak_calc AS (
        SELECT pd,
          pd - (ROW_NUMBER() OVER (ORDER BY pd DESC))::int AS grp
        FROM ordered_dates
      )
      SELECT COUNT(*)::integer, MIN(pd), MAX(pd)
      INTO _new_current, _streak_start, _last_date
      FROM streak_calc
      WHERE grp = (SELECT grp FROM streak_calc ORDER BY pd DESC LIMIT 1);

      _new_longest := GREATEST(_current_streak.longest_streak, _new_current);

      UPDATE public.practice_streaks
      SET current_streak = _new_current,
          longest_streak = _new_longest,
          last_practice_date = _last_date,
          streak_started_at = _streak_start,
          updated_at = now()
      WHERE student_id = _student_id;

      -- Check milestone on backdated recalculation path
      IF _new_current IN (3, 7, 14, 30, 60, 100) THEN
        PERFORM public._notify_streak_milestone(_student_id, _org_id, _new_current);
      END IF;

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
    PERFORM public._notify_streak_milestone(_student_id, _org_id, _new_current);
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Helper: _notify_streak_milestone — DRY milestone notification logic
-- Called from both the normal and backdated paths of update_practice_streak()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._notify_streak_milestone(
  _student_id uuid,
  _org_id uuid,
  _new_current integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log to audit_log
  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _org_id, NULL, 'streak_milestone', 'practice_streaks', _student_id,
    jsonb_build_object('streak', _new_current, 'student_id', _student_id)
  );

  -- Fire the streak-notification edge function via pg_net
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/streak-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object(
      'student_id', _student_id,
      'new_streak', _new_current,
      'org_id', _org_id
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- F4: Make reset_stale_streaks() timezone-aware
-- Instead of a flat 2-day grace window, compare each streak's last_practice_date
-- against "today" in the org's local timezone.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_stale_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.practice_streaks ps
  SET current_streak = 0,
      streak_started_at = NULL,
      updated_at = now()
  FROM public.organisations o
  WHERE ps.org_id = o.id
    AND ps.current_streak > 0
    AND ps.last_practice_date < (
      (NOW() AT TIME ZONE COALESCE(o.timezone, 'Europe/London'))::date - 1
    );
END;
$$;

-- ---------------------------------------------------------------------------
-- F5: Add DELETE policies on practice_logs
-- Parents can delete their own children's logs; staff can delete any in org
-- ---------------------------------------------------------------------------
CREATE POLICY "Staff can delete practice logs"
  ON public.practice_logs FOR DELETE
  USING (public.is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parents can delete own children logs"
  ON public.practice_logs FOR DELETE
  USING (public.is_parent_of_student(auth.uid(), student_id));

-- ---------------------------------------------------------------------------
-- F6: Add FK on practice_assignments.teacher_user_id → auth.users(id)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'practice_assignments_teacher_user_id_fkey'
      AND table_name = 'practice_assignments'
  ) THEN
    ALTER TABLE public.practice_assignments
      ADD CONSTRAINT practice_assignments_teacher_user_id_fkey
      FOREIGN KEY (teacher_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;
