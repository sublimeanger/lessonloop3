-- FIX 5 [8C.4]: Make parent accept/decline atomic via RPC
--
-- The parent portal does a direct table UPDATE to accept/decline offers.
-- This is not atomic: two parents could race to accept the same offered slot,
-- and the accept flow (update waitlist + eventually add participant + redeem credit)
-- is split across client and server.
--
-- Fix: Create an RPC that locks the waitlist row, validates guardian ownership
-- and current status, then performs the state transition atomically.

CREATE OR REPLACE FUNCTION public.respond_to_makeup_offer(
  _waitlist_id UUID,
  _action TEXT  -- 'accept' or 'decline'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _guardian_id UUID;
  _user_id UUID;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Resolve guardian for the current user
  SELECT g.id INTO _guardian_id
    FROM guardians g
    WHERE g.user_id = _user_id AND g.deleted_at IS NULL
    LIMIT 1;

  IF _guardian_id IS NULL THEN
    RAISE EXCEPTION 'Guardian record not found';
  END IF;

  IF _action NOT IN ('accept', 'decline') THEN
    RAISE EXCEPTION 'Invalid action: %. Must be accept or decline.', _action;
  END IF;

  -- Lock the waitlist entry and validate ownership + status
  SELECT * INTO _entry
    FROM make_up_waitlist
    WHERE id = _waitlist_id
      AND guardian_id = _guardian_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found or does not belong to you';
  END IF;

  IF _entry.status != 'offered' THEN
    RAISE EXCEPTION 'This offer is no longer available (current status: %)', _entry.status;
  END IF;

  IF _action = 'accept' THEN
    UPDATE make_up_waitlist
    SET status = 'accepted',
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = _waitlist_id;

    RETURN json_build_object('status', 'accepted', 'id', _waitlist_id);

  ELSE  -- decline
    UPDATE make_up_waitlist
    SET status = 'waiting',
        responded_at = NOW(),
        matched_lesson_id = NULL,
        matched_at = NULL,
        offered_at = NULL,
        updated_at = NOW()
    WHERE id = _waitlist_id;

    RETURN json_build_object('status', 'waiting', 'id', _waitlist_id);
  END IF;
END;
$function$;
