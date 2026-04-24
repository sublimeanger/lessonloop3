-- Journey 8 Commit 4 migration — two credit-admin RPCs.
--
-- (1) issue_make_up_credit (J8-F17): atomic replacement for the
--     client-side INSERT + fire-and-forget audit_log pattern in
--     useMakeUpCredits.createCredit. Keeps INSERT and audit_log in
--     the same transaction; failure of either rolls back both.
--
-- (2) void_invoice (J8-F4): preserves the original notes field on
--     credits when invoice-void restores them. Previous implementation
--     overwrote notes with 'Credit restored — invoice voided', losing
--     any prior issuance context (original reason, linked lesson info,
--     etc.). New implementation appends a timestamped restore note
--     with the invoice number for traceability.

BEGIN;

-- ============================================================
-- (1) issue_make_up_credit
-- ============================================================
CREATE OR REPLACE FUNCTION public.issue_make_up_credit(
  _org_id uuid,
  _student_id uuid,
  _credit_value_minor integer,
  _expires_at timestamptz DEFAULT NULL,
  _issued_for_lesson_id uuid DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS make_up_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _credit make_up_credits%ROWTYPE;
  _student_org_id uuid;
BEGIN
  -- Auth: staff (owner / admin / teacher / finance) — matches
  -- redeem_make_up_credit's role gate. Staff can issue credits.
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to issue credits'
      USING ERRCODE = '42501';
  END IF;

  -- Org must be active (trial not expired, subscription live).
  IF NOT is_org_active(_org_id) THEN
    RAISE EXCEPTION 'Organisation is not active'
      USING ERRCODE = '22023';
  END IF;

  IF _credit_value_minor IS NULL OR _credit_value_minor <= 0 THEN
    RAISE EXCEPTION 'Credit value must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  -- Validate student belongs to org.
  SELECT org_id INTO _student_org_id
  FROM students WHERE id = _student_id;
  IF _student_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found'
      USING ERRCODE = 'P0002';
  END IF;
  IF _student_org_id != _org_id THEN
    RAISE EXCEPTION 'Student does not belong to this organisation'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO make_up_credits (
    org_id,
    student_id,
    issued_for_lesson_id,
    credit_value_minor,
    expires_at,
    notes,
    created_by
  ) VALUES (
    _org_id,
    _student_id,
    _issued_for_lesson_id,
    _credit_value_minor,
    _expires_at,
    _notes,
    auth.uid()
  )
  RETURNING * INTO _credit;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  )
  VALUES (
    _org_id,
    auth.uid(),
    'credit_issued',
    'make_up_credit',
    _credit.id,
    jsonb_build_object(
      'student_id', _student_id,
      'credit_value_minor', _credit_value_minor,
      'issued_for_lesson_id', _issued_for_lesson_id,
      'expires_at', _expires_at,
      'source', 'manual'
    )
  );

  RETURN _credit;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_make_up_credit(uuid, uuid, integer, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_make_up_credit(uuid, uuid, integer, timestamptz, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.issue_make_up_credit(uuid, uuid, integer, timestamptz, uuid, text) IS
'Atomic manual credit issuance. Authorisation: is_org_staff. Validates org active, student in org, value > 0. INSERT + audit_log in one transaction — replaces the client-side non-atomic pattern.';


-- ============================================================
-- (2) void_invoice — preserve original credit notes
-- ============================================================
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

  SELECT id, invoice_number, status, credit_applied_minor, payment_plan_enabled, paid_minor, billing_run_id
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

  -- Clear billing_run_id on void (B28) so voided invoices don't count
  -- toward historical billing run totals or dedup logic.
  UPDATE invoices
    SET status = 'void',
        payment_plan_enabled = false,
        billing_run_id = NULL
    WHERE id = _invoice_id;

  -- Include partially_paid defensively. A5 guard makes this unreachable
  -- (paid_minor > 0 blocks void; partially_paid requires paid_minor > 0)
  -- but the explicit set makes intent clear.
  UPDATE invoice_installments
    SET status = 'void', updated_at = NOW()
    WHERE invoice_id = _invoice_id
      AND status IN ('pending', 'overdue', 'partially_paid');
  GET DIAGNOSTICS _installments_voided = ROW_COUNT;

  _credits_restored := 0;
  IF _invoice.credit_applied_minor > 0 THEN
    -- J8-F4: append restore trail to the existing notes rather than
    -- overwriting. Preserves original issuance context (reason,
    -- linked-lesson info, etc.) so the credit's history isn't lost
    -- each time it's applied and then voided.
    UPDATE make_up_credits
      SET redeemed_at = NULL,
          applied_to_invoice_id = NULL,
          notes = COALESCE(notes, '')
            || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END
            || 'Credit restored — invoice ' || _invoice.invoice_number
            || ' voided on ' || to_char(NOW(), 'YYYY-MM-DD')
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
