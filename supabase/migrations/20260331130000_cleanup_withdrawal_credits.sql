-- COH-C1: Clean up make-up credits and waitlist entries when a student withdraws
CREATE OR REPLACE FUNCTION cleanup_withdrawal_credits(
  _student_id UUID,
  _org_id UUID,
  _effective_date DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _voided_count INTEGER := 0;
  _waitlist_count INTEGER := 0;
BEGIN
  -- 1. Void unredeemed credits for lessons AFTER the effective date
  UPDATE make_up_credits
  SET voided_at = NOW(), voided_by = auth.uid()
  WHERE student_id = _student_id
    AND org_id = _org_id
    AND redeemed_at IS NULL
    AND expired_at IS NULL
    AND voided_at IS NULL
    AND issued_for_lesson_id IN (
      SELECT id FROM lessons
      WHERE start_at >= _effective_date::timestamp
    );
  GET DIAGNOSTICS _voided_count = ROW_COUNT;

  -- 2. Cancel active waitlist entries
  UPDATE make_up_waitlist
  SET status = 'expired', updated_at = NOW()
  WHERE student_id = _student_id
    AND org_id = _org_id
    AND status IN ('waiting', 'matched', 'offered');
  GET DIAGNOSTICS _waitlist_count = ROW_COUNT;

  -- 3. Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'),
    'withdrawal_cleanup', 'student', _student_id,
    jsonb_build_object(
      'credits_voided', _voided_count,
      'waitlist_entries_cancelled', _waitlist_count,
      'effective_date', _effective_date
    ));

  RETURN json_build_object(
    'credits_voided', _voided_count,
    'waitlist_entries_cancelled', _waitlist_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_withdrawal_credits TO authenticated;
