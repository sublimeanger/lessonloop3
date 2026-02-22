
CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _invoice RECORD;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT id, status, credit_applied_minor, payment_plan_enabled INTO _invoice
  FROM invoices WHERE id = _invoice_id AND org_id = _org_id
  FOR UPDATE;

  IF _invoice IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', _invoice.status;
  END IF;

  -- Void the invoice and disable payment plan
  UPDATE invoices SET status = 'void', payment_plan_enabled = false WHERE id = _invoice_id;

  -- Void any pending/overdue installments
  UPDATE invoice_installments
  SET status = 'void', updated_at = NOW()
  WHERE invoice_id = _invoice_id AND status IN ('pending', 'overdue');

  -- Restore any applied credits atomically
  IF _invoice.credit_applied_minor > 0 THEN
    UPDATE make_up_credits
    SET redeemed_at = NULL,
        applied_to_invoice_id = NULL,
        notes = 'Credit restored — invoice voided'
    WHERE applied_to_invoice_id = _invoice_id
      AND org_id = _org_id
      AND redeemed_at IS NOT NULL;
  END IF;
END;
$function$;
