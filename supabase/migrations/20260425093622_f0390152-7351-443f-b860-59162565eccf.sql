-- J10-F1 — Backfill RPC for guardian_payment_preferences.default_payment_method_id.
BEGIN;

CREATE OR REPLACE FUNCTION public.backfill_guardian_default_pm_set(
  _guardian_id uuid,
  _org_id uuid,
  _payment_method_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _existing record;
BEGIN
  IF _guardian_id IS NULL OR _org_id IS NULL OR _payment_method_id IS NULL THEN
    RAISE EXCEPTION 'guardian_id, org_id, and payment_method_id are required';
  END IF;

  SELECT id, default_payment_method_id
    INTO _existing
    FROM public.guardian_payment_preferences
    WHERE guardian_id = _guardian_id AND org_id = _org_id
    FOR UPDATE;

  IF _existing IS NULL THEN
    INSERT INTO public.guardian_payment_preferences (
      guardian_id, org_id, default_payment_method_id, updated_at
    ) VALUES (
      _guardian_id, _org_id, _payment_method_id, now()
    );
    RETURN json_build_object('updated', true, 'previous', null, 'action', 'inserted');
  END IF;

  IF _existing.default_payment_method_id IS NULL THEN
    UPDATE public.guardian_payment_preferences
      SET default_payment_method_id = _payment_method_id,
          updated_at = now()
      WHERE id = _existing.id;
    RETURN json_build_object('updated', true, 'previous', null, 'action', 'updated');
  END IF;

  RETURN json_build_object(
    'updated', false,
    'previous', _existing.default_payment_method_id,
    'action', 'skipped'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.backfill_guardian_default_pm_set(uuid, uuid, text)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.backfill_guardian_default_pm_set(uuid, uuid, text)
  FROM authenticated, anon, public;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- J10-F5 — schedule the 24-hour auto-pay final reminder cron.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-pay-final-reminder-daily') THEN
    PERFORM cron.unschedule('auto-pay-final-reminder-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'auto-pay-final-reminder-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ximxgnkpcswbvfrkkmjq.supabase.co/functions/v1/auto-pay-final-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);