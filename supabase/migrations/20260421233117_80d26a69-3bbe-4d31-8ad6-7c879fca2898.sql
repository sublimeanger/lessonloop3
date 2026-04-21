-- J4-F24: Admin-triggered recalc + finance-team audit read for the
-- recalc failure banner. Both RPCs are narrow and SECURITY DEFINER
-- so we don't touch the 518-policy RLS matrix (see Track 0.2).

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

  IF NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = _invoice_id AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  SELECT recalculate_invoice_paid(_invoice_id) INTO _recalc_result;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  )
  VALUES (
    _org_id,
    auth.uid(),
    'invoice_recalc_manual',
    'invoice',
    _invoice_id,
    jsonb_build_object('result', _recalc_result, 'source', 'admin_retry_banner')
  );

  RETURN _recalc_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_recalculate_invoice_paid(uuid, uuid) FROM PUBLIC;
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
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM invoices WHERE id = _invoice_id AND org_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  RETURN QUERY
  SELECT al.id, al.created_at, al.after
  FROM audit_log al
  WHERE al.org_id = _org_id
    AND al.entity_type = 'invoice'
    AND al.entity_id = _invoice_id
    AND al.action = 'invoice_recalc_failed'
    AND al.created_at > now() - interval '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM audit_log al2
      WHERE al2.org_id = _org_id
        AND al2.entity_type = 'invoice'
        AND al2.entity_id = _invoice_id
        AND al2.action = 'invoice_recalc_manual'
        AND al2.created_at > al.created_at
    )
  ORDER BY al.created_at DESC
  LIMIT 10;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_recent_recalc_failures_for_invoice(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_recalc_failures_for_invoice(uuid, uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';