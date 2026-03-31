-- =============================================================================
-- CRD-L1: Make offer + notification atomic via pg_net
-- CRD-M4: Add audit trail for waitlist offer and dismiss actions
-- =============================================================================

-- ── offer_makeup_slot: add pg_net notification + audit log ──────────────

CREATE OR REPLACE FUNCTION public.offer_makeup_slot(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
  _expiry_hours INTEGER;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to offer slots for this organisation';
  END IF;

  -- Get org-specific expiry hours
  SELECT COALESCE(enrolment_offer_expiry_hours, 48)
    INTO _expiry_hours
    FROM organisations WHERE id = _org_id;

  -- Lock the waitlist entry and validate
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'matched' THEN
    RAISE EXCEPTION 'Waitlist entry is not in matched status (current: %)', _entry.status;
  END IF;

  -- Atomically update to offered with per-entry expiry
  UPDATE make_up_waitlist
  SET status = 'offered',
      offered_at = NOW(),
      offer_expires_at = NOW() + (_expiry_hours || ' hours')::INTERVAL,
      updated_at = NOW()
  WHERE id = _waitlist_id;

  -- CRD-M4: Audit trail for offer action
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'waitlist.offered', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'matched_lesson_id', _entry.matched_lesson_id));

  -- CRD-L1: Fire notification atomically via pg_net so the parent is
  -- always notified even if the frontend call fails after the RPC succeeds.
  PERFORM net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1)
           || '/functions/v1/notify-makeup-offer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object('waitlist_id', _waitlist_id)
  );

  RETURN json_build_object('status', 'offered', 'id', _waitlist_id,
    'offer_expires_at', (NOW() + (_expiry_hours || ' hours')::INTERVAL)::TEXT);
END;
$function$;


-- ── dismiss_makeup_match: add audit log ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.dismiss_makeup_match(_waitlist_id uuid, _org_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _entry RECORD;
BEGIN
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Access denied: not authorised to dismiss matches for this organisation';
  END IF;

  -- Lock the waitlist entry and validate
  SELECT * INTO _entry
  FROM make_up_waitlist
  WHERE id = _waitlist_id AND org_id = _org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Waitlist entry not found';
  END IF;

  IF _entry.status != 'matched' THEN
    RAISE EXCEPTION 'Waitlist entry is not in matched status (current: %)', _entry.status;
  END IF;

  -- Reset to waiting
  UPDATE make_up_waitlist
  SET status = 'waiting',
      matched_lesson_id = NULL,
      matched_at = NULL,
      updated_at = NOW()
  WHERE id = _waitlist_id;

  -- CRD-M4: Audit trail for dismiss action
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'waitlist.dismissed', 'make_up_waitlist', _waitlist_id,
    jsonb_build_object('student_id', _entry.student_id, 'previous_match', _entry.matched_lesson_id));

  RETURN json_build_object('status', 'waiting', 'id', _waitlist_id);
END;
$function$;
