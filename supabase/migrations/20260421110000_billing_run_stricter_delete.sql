-- BR5: delete_billing_run refuses to delete runs that contain any
-- non-draft invoices. Previously only 'paid' blocked deletion.
--
-- Rationale: sent/overdue invoices have been emailed to parents.
-- Silently deleting them from the system orphans the parent-facing
-- references. Teacher should void sent invoices individually first
-- so each void has a proper audit trail.
--
-- Void invoices are blocked too: they already have an audit trail
-- (the void itself). Deleting the void record erases that history.

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
      'deleted_items', _deleted_items
    ));

  RETURN json_build_object(
    'deleted_invoices', _deleted_invoices,
    'deleted_items', _deleted_items
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
