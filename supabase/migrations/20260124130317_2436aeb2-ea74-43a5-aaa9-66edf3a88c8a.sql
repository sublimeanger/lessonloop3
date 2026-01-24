-- Create practice_streaks table for tracking student practice streaks
CREATE TABLE public.practice_streaks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_practice_date date,
  streak_started_at date,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(student_id)
);

-- Enable RLS
ALTER TABLE public.practice_streaks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view org streaks"
  ON public.practice_streaks FOR SELECT
  USING (is_org_staff(auth.uid(), org_id));

CREATE POLICY "Parent can view child streaks"
  ON public.practice_streaks FOR SELECT
  USING (
    has_org_role(auth.uid(), org_id, 'parent'::app_role) AND
    is_parent_of_student(auth.uid(), student_id)
  );

-- System policies for trigger updates
CREATE POLICY "System can insert streaks"
  ON public.practice_streaks FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update streaks"
  ON public.practice_streaks FOR UPDATE
  USING (true);

-- Index for performance
CREATE INDEX idx_practice_streaks_student_id ON public.practice_streaks(student_id);
CREATE INDEX idx_practice_streaks_current_streak ON public.practice_streaks(current_streak) WHERE current_streak > 0;

-- Function to update streak when practice log is added
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

  RETURN NEW;
END;
$$;

-- Create trigger on practice_logs
CREATE TRIGGER update_streak_on_practice_log
  AFTER INSERT ON public.practice_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_practice_streak();

-- Function to check and reset stale streaks (can be called by cron)
CREATE OR REPLACE FUNCTION public.reset_stale_streaks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.practice_streaks
  SET 
    current_streak = 0,
    streak_started_at = NULL,
    updated_at = now()
  WHERE last_practice_date < CURRENT_DATE - 1
    AND current_streak > 0;
END;
$$;