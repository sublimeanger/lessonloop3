CREATE OR REPLACE FUNCTION recalc_continuation_summary(
  _run_id UUID,
  _org_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _summary JSON;
BEGIN
  -- Auth check
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Verify run belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM term_continuation_runs
    WHERE id = _run_id AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Run not found';
  END IF;

  SELECT json_build_object(
    'total_students', COUNT(*),
    'confirmed',          COUNT(*) FILTER (WHERE response = 'continuing'),
    'withdrawing',        COUNT(*) FILTER (WHERE response = 'withdrawing'),
    'pending',            COUNT(*) FILTER (WHERE response = 'pending'),
    'no_response',        COUNT(*) FILTER (WHERE response = 'no_response'),
    'assumed_continuing', COUNT(*) FILTER (WHERE response = 'assumed_continuing')
  ) INTO _summary
  FROM term_continuation_responses
  WHERE run_id = _run_id AND org_id = _org_id;

  UPDATE term_continuation_runs
  SET summary = _summary, updated_at = NOW()
  WHERE id = _run_id AND org_id = _org_id;

  RETURN _summary;
END;
$$;

GRANT EXECUTE ON FUNCTION recalc_continuation_summary TO authenticated;
