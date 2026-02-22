CREATE OR REPLACE FUNCTION public.reset_stale_streaks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Use a 2-day grace window instead of 1 to account for timezone differences
  UPDATE public.practice_streaks
  SET current_streak = 0,
      streak_started_at = NULL,
      updated_at = now()
  WHERE last_practice_date < CURRENT_DATE - 2
    AND current_streak > 0;
END;
$$;