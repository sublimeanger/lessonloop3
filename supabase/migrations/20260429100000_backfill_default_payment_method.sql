-- J10-F1 — Backfill RPC for guardian_payment_preferences.default_payment_method_id.
--
-- Background: webhook handler in stripe-webhook (J10-P1-C1) now sets
-- default_payment_method_id from paymentIntent.payment_method on every
-- payment_intent.succeeded that is the first card for a guardian.
-- That fixes future cases. Existing guardians with auto_pay_enabled=true
-- and a payment history pre-J10-P1-C1 still have default_payment_method_id
-- IS NULL — the auto-pay cron skips them at stripe-auto-pay-installment
-- index.ts:85 (gate: prefs.default_payment_method_id IS NOT NULL).
--
-- Fix: a service-role-only RPC that sets the field if missing. Driven
-- by admin-backfill-default-pm edge fn (J10-P1-C3) which resolves a
-- payment_method_id from Stripe's customer PM list and calls this RPC
-- per guardian.
--
-- Idempotent: CREATE OR REPLACE FUNCTION; safe to re-run. Per-row
-- semantics: if a non-null default already exists, no-op. So a re-run
-- after the first pass only touches still-null rows from new opt-ins
-- since.

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

-- Service-role only. Driver edge fn invokes this via the service-role
-- supabase client; no end user should ever call this directly.
GRANT EXECUTE ON FUNCTION public.backfill_guardian_default_pm_set(uuid, uuid, text)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.backfill_guardian_default_pm_set(uuid, uuid, text)
  FROM authenticated, anon, public;

NOTIFY pgrst, 'reload schema';

COMMIT;
