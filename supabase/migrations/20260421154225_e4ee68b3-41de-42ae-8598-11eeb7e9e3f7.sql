-- MIGRATION 1: delete_billing_run stricter gate (block any non-draft invoices)
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
BEGIN
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT id, org_id, status INTO _run
  FROM billing_runs
  WHERE id = _billing_run_id AND org_id = _org_id
  FOR UPDATE;

  IF _run IS NULL THEN
    RAISE EXCEPTION 'Billing run not found';
  END IF;

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
      'deleted_items', _deleted_items
    ));

  RETURN json_build_object(
    'deleted_invoices', _deleted_invoices,
    'deleted_items', _deleted_items
  );
END;
$function$;

-- MIGRATION 2: btree_gist + overlap exclusion constraint on billing_runs
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE billing_runs 
  DROP CONSTRAINT IF EXISTS billing_runs_no_overlap_per_org;

ALTER TABLE billing_runs
  ADD CONSTRAINT billing_runs_no_overlap_per_org
  EXCLUDE USING gist (
    org_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  )
  WHERE (status != 'failed');

NOTIFY pgrst, 'reload schema';