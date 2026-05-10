-- _notify_streak_milestone — send x-cron-secret so streak-notification
-- accepts the call.
--
-- Background: 20260518110000 made the trigger non-blocking against vault
-- / pg_net failures, but kept passing only `Authorization: Bearer
-- <vault.SUPABASE_SERVICE_ROLE_KEY>`. The deployed streak-notification
-- function (verify_jwt=false; v18) gates on `_shared/cron-auth.ts`
-- `validateCronAuth(req)`, which checks the `x-cron-secret` header
-- against `Deno.env.get("INTERNAL_CRON_SECRET")`. Without that header
-- the function returns 401 immediately. Every milestone callout in
-- production was silently 401'ing — audit_log row commits, no email.
-- See audit/findings/2026-05-10-streak-notification-x-cron-secret-mismatch.md.
--
-- Fix: read INTERNAL_CRON_SECRET from vault.decrypted_secrets (already
-- seeded since 2026-05-05) and add `x-cron-secret` to the headers
-- jsonb. The Authorization Bearer header is left in place for
-- forward-compat (current fn ignores it; harmless). The service-role
-- vault read is preserved but no longer required for the http_post
-- to fire — INTERNAL_CRON_SECRET takes its place as the gating value.
--
-- Idempotent: CREATE OR REPLACE.

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
  _cron_secret text;
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
    SELECT decrypted_secret INTO _cron_secret
      FROM vault.decrypted_secrets WHERE name = 'INTERNAL_CRON_SECRET' LIMIT 1;

    IF _supabase_url IS NULL OR _cron_secret IS NULL THEN
      RAISE WARNING '[_notify_streak_milestone] vault missing SUPABASE_URL or INTERNAL_CRON_SECRET — skipping http_post';
    ELSE
      PERFORM net.http_post(
        url := _supabase_url || '/functions/v1/streak-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', _cron_secret,
          'Authorization', 'Bearer ' || COALESCE(_service_key, '')
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
