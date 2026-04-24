-- Journey 8 Commit 2 (J8-F6): delete_billing_run frees applied credits.
--
-- Live version (20260421110000) DELETEs draft invoices and items from
-- the billing run but does NOT free credits that were applied to those
-- invoices. Credit rows stay with redeemed_at = NOW(),
-- applied_to_invoice_id pointing at the deleted invoice id. Net effect:
-- orphan redeemed credits that are unusable (can't be re-applied because
-- redeemed_at is set) but still block new applies.
--
-- Fix: before the DELETE chain, free any credits redeemed against draft
-- invoices in this run — set redeemed_at=NULL, applied_to_invoice_id=NULL,
-- leave notes as a restore trail. Skip voided credits (don't resurrect
-- a credit that was manually voided while it happened to be applied).
--
-- The freed-credit count surfaces in the audit_log after block and in
-- the RPC return value so the UI can tell the operator "X credits
-- restored." Idempotent via CREATE OR REPLACE.

BEGIN;

CREATE OR REPLACE FUNCTION public.delete_billing_run(_billing_run_id uuid, _org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _run RECORD;
  _non_draft_count integer;
  _non_draft_breakdown jsonb;
  _deleted_invoices integer;
  _deleted_items integer;
  _freed_credits integer;
BEGIN
  -- Auth: caller must be admin/owner
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Lock the billing run row
  SELECT id, org_id, status INTO _run
  FROM billing_runs
  WHERE id = _billing_run_id AND org_id = _org_id
  FOR UPDATE;

  IF _run IS NULL THEN
    RAISE EXCEPTION 'Billing run not found';
  END IF;

  -- Check for any non-draft invoices (paid / sent / overdue / void)
  SELECT
    COUNT(*),
    jsonb_object_agg(status, status_count)
  INTO _non_draft_count, _non_draft_breakdown
  FROM (
    SELECT status, COUNT(*) AS status_count
    FROM invoices
    WHERE billing_run_id = _billing_run_id
      AND org_id = _org_id
      AND status != 'draft'
    GROUP BY status
  ) s;

  IF _non_draft_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete billing run: contains % non-draft invoice(s) (%). Void or reconcile these individually first.',
      _non_draft_count, _non_draft_breakdown::text;
  END IF;

  -- J8-F6: Free any credits applied to invoices in this run.
  -- Draft invoices can have credits applied; deletion must restore
  -- the credits to available state so they can be used elsewhere.
  -- Skip voided credits (don't resurrect a credit that was manually
  -- voided while it happened to be applied).
  UPDATE make_up_credits
  SET redeemed_at = NULL,
      applied_to_invoice_id = NULL,
      notes = 'Credit restored — billing run deleted',
      updated_at = NOW()
  WHERE applied_to_invoice_id IN (
    SELECT id FROM invoices
    WHERE billing_run_id = _billing_run_id AND org_id = _org_id
  )
  AND org_id = _org_id
  AND redeemed_at IS NOT NULL
  AND voided_at IS NULL;
  GET DIAGNOSTICS _freed_credits = ROW_COUNT;

  -- At this point every invoice in the run is a draft. Safe to delete.
  DELETE FROM invoice_items
  WHERE invoice_id IN (
    SELECT id FROM invoices
    WHERE billing_run_id = _billing_run_id AND org_id = _org_id
  );
  GET DIAGNOSTICS _deleted_items = ROW_COUNT;

  DELETE FROM invoices
  WHERE billing_run_id = _billing_run_id AND org_id = _org_id;
  GET DIAGNOSTICS _deleted_invoices = ROW_COUNT;

  DELETE FROM billing_runs
  WHERE id = _billing_run_id AND org_id = _org_id;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'billing_run_deleted', 'billing_run', _billing_run_id,
    jsonb_build_object(
      'deleted_invoices', _deleted_invoices,
      'deleted_items', _deleted_items,
      'freed_credits', _freed_credits
    ));

  RETURN json_build_object(
    'deleted_invoices', _deleted_invoices,
    'deleted_items', _deleted_items,
    'freed_credits', _freed_credits
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
