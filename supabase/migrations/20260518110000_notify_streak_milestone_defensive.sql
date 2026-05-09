-- Make _notify_streak_milestone defensive against pg_net / vault failures.
--
-- Background: the helper does two things in sequence —
--   1. INSERT into audit_log (durable record of the milestone)
--   2. PERFORM net.http_post(...) → streak-notification edge fn (delivery)
--
-- Step 2 reads vault.decrypted_secrets for SUPABASE_URL +
-- SUPABASE_SERVICE_ROLE_KEY. When those secrets are missing (as they
-- were in production until this fix; vault had only INTERNAL_CRON_SECRET),
-- the URL concat produces NULL, pg_net's http_request_queue rejects the
-- row with sqlstate 23502 ("null value in column \"url\"… violates not
-- null constraint"), the trigger errors, and the underlying
-- practice_logs INSERT rolls back (update_practice_streak is
-- AFTER INSERT FOR EACH ROW, so its failure cancels the row).
--
-- User-visible bug: any parent or staff member logging the 3rd, 7th,
-- 14th, 30th, 60th, or 100th consecutive practice day for a single
-- student got a 500. Milestones never fired and the audit_log row
-- never committed.
--
-- Fix: wrap the net.http_post call in a nested BEGIN/EXCEPTION/END.
-- The audit_log INSERT remains the source of truth; notification
-- delivery is best-effort. RAISE WARNING preserves visibility in
-- Postgres logs without blocking the user action.

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
DECLARE
  _supabase_url text;
  _service_key text;
BEGIN
  -- Durable record: must succeed.
  INSERT INTO public.audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _org_id, NULL, 'streak_milestone', 'practice_streaks', _student_id,
    jsonb_build_object('streak', _new_current, 'student_id', _student_id)
  );

  -- Best-effort delivery: any vault / pg_net / network hiccup is
  -- caught so the caller's INSERT can commit.
  BEGIN
    SELECT decrypted_secret INTO _supabase_url
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _service_key
      FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

    IF _supabase_url IS NULL OR _service_key IS NULL THEN
      RAISE WARNING '[_notify_streak_milestone] vault missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — skipping http_post';
    ELSE
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/streak-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_key
        ),
        body := jsonb_build_object(
          'student_id', _student_id,
          'new_streak', _new_current,
          'org_id', _org_id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[_notify_streak_milestone] pg_net failed: % / %', SQLERRM, SQLSTATE;
  END;
END;
$$;
