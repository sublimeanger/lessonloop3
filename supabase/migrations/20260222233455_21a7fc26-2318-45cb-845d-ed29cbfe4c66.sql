
CREATE OR REPLACE FUNCTION public.redeem_make_up_credit(
  _credit_id uuid,
  _lesson_id uuid,
  _org_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _credit RECORD;
BEGIN
  -- Validate caller is org staff
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to redeem credits for this organisation';
  END IF;

  -- Lock the credit row
  SELECT * INTO _credit
  FROM make_up_credits
  WHERE id = _credit_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit not found';
  END IF;

  IF _credit.redeemed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Credit has already been redeemed';
  END IF;

  IF _credit.expires_at IS NOT NULL AND _credit.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Credit has expired';
  END IF;

  UPDATE make_up_credits SET
    redeemed_at = NOW(),
    redeemed_lesson_id = _lesson_id,
    updated_at = NOW()
  WHERE id = _credit_id;

  RETURN json_build_object(
    'credit_id', _credit_id,
    'lesson_id', _lesson_id,
    'status', 'redeemed'
  );
END;
$$;
