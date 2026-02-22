CREATE OR REPLACE FUNCTION public.complete_expired_assignments()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.practice_assignments
  SET status = 'completed', updated_at = now()
  WHERE status = 'active' AND end_date IS NOT NULL AND end_date < CURRENT_DATE;
END;
$$;