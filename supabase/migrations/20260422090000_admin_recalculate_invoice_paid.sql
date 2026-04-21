-- J4-F24: Admin-triggered recalc + finance-team audit read for the
-- recalc failure banner. Both RPCs are narrow and SECURITY DEFINER
-- so we don't touch the 518-policy RLS matrix (see Track 0.2).
--
-- admin_recalculate_invoice_paid: manual retry button surface. Wraps
-- recalculate_invoice_paid with a finance-team auth check and an
-- audit_log entry recording the manual trigger.
--
-- get_recent_recalc_failures_for_invoice: banner read surface. Returns
-- recent (last 7 days) invoice_recalc_failed audit entries for a
-- specific invoice, accessible to the same finance-team set that
-- can manage billing.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_recalculate_invoice_paid(
  _invoice_id uuid,
  _org_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _recalc_result json;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Verify invoice belongs to the claimed org — prevents cross-org
  -- tampering by a compromised auth token.
  IF NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = _invoice_id AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT recalculate_invoice_paid(_invoice_id) INTO _recalc_result;

  -- Record the manual trigger separately from the recalc itself.
  -- Closes the loop with invoice_recalc_failed entries: operator
  -- sees failure banner → clicks retry → this row lands alongside
  -- showing the recovery action was taken.
  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  )
  VALUES (
    _org_id,
    auth.uid(),
    'invoice_recalc_manual',
    'invoice',
    _invoice_id,
    jsonb_build_object(
      'recalc_result', _recalc_result,
      'triggered_by', 'admin_retry_button'
    )
  );

  RETURN _recalc_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_recalculate_invoice_paid(uuid, uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_recent_recalc_failures_for_invoice(
  _invoice_id uuid,
  _org_id uuid
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  after jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Return failed recalcs from the last 7 days that have NOT been
  -- superseded by a successful invoice_recalc_manual since. Once
  -- the operator retries successfully the banner should clear
  -- without requiring a full audit_log truncation.
  RETURN QUERY
  SELECT a.id, a.created_at, a.after
  FROM audit_log a
  WHERE a.entity_type = 'invoice'
    AND a.entity_id = _invoice_id
    AND a.org_id = _org_id
    AND a.action = 'invoice_recalc_failed'
    AND a.created_at > NOW() - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM audit_log b
      WHERE b.entity_type = 'invoice'
        AND b.entity_id = _invoice_id
        AND b.org_id = _org_id
        AND b.action = 'invoice_recalc_manual'
        AND b.created_at > a.created_at
        AND (b.after->>'recalc_result')::jsonb IS NOT NULL
    )
  ORDER BY a.created_at DESC
  LIMIT 5;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_recent_recalc_failures_for_invoice(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
