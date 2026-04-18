BEGIN;

CREATE OR REPLACE FUNCTION public.void_invoice(_invoice_id uuid, _org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _invoice RECORD; 
  _installments_voided integer; 
  _credits_restored integer;
BEGIN
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN 
    RAISE EXCEPTION 'Not authorised'; 
  END IF;

  SELECT id, status, credit_applied_minor, payment_plan_enabled, paid_minor, billing_run_id 
  INTO _invoice
  FROM invoices 
  WHERE id = _invoice_id AND org_id = _org_id 
  FOR UPDATE;
  
  IF _invoice IS NULL THEN 
    RAISE EXCEPTION 'Invoice not found'; 
  END IF;
  
  IF _invoice.status IN ('paid', 'void') THEN
    RAISE EXCEPTION 'Cannot void a % invoice', _invoice.status;
  END IF;

  IF COALESCE(_invoice.paid_minor, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot void invoice with £% in paid payments. Refund the payments first, then void.',
      to_char(_invoice.paid_minor / 100.0, 'FM999,999,999.00');
  END IF;

  UPDATE invoice_items 
    SET linked_lesson_id = NULL 
    WHERE invoice_id = _invoice_id;
    
  UPDATE invoices 
    SET status = 'void', 
        payment_plan_enabled = false, 
        billing_run_id = NULL
    WHERE id = _invoice_id;
    
  UPDATE invoice_installments 
    SET status = 'void', updated_at = NOW()
    WHERE invoice_id = _invoice_id 
      AND status IN ('pending', 'overdue', 'partially_paid');
  GET DIAGNOSTICS _installments_voided = ROW_COUNT;

  _credits_restored := 0;
  IF _invoice.credit_applied_minor > 0 THEN
    UPDATE make_up_credits
      SET redeemed_at = NULL, 
          applied_to_invoice_id = NULL, 
          notes = 'Credit restored — invoice voided'
      WHERE applied_to_invoice_id = _invoice_id 
        AND org_id = _org_id 
        AND redeemed_at IS NOT NULL;
    GET DIAGNOSTICS _credits_restored = ROW_COUNT;
  END IF;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  )
  VALUES (
    _org_id, 
    auth.uid(), 
    'invoice_voided', 
    'invoice', 
    _invoice_id,
    jsonb_build_object(
      'installments_voided', _installments_voided, 
      'credits_restored', _credits_restored,
      'credit_applied_minor', _invoice.credit_applied_minor,
      'billing_run_id_cleared', _invoice.billing_run_id IS NOT NULL
    )
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;