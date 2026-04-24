-- ============================================================
-- Journey 8 Part A bundle: 3 migrations applied together
-- (mirrors content of supabase/migrations/20260424{120000,130000,140000}_*.sql)
-- All CREATE OR REPLACE — fully idempotent.
-- ============================================================

-- ===== 20260424120000: update_invoice_with_items credit eligibility fix (J8-F1, J8-F2) =====
CREATE OR REPLACE FUNCTION public.update_invoice_with_items(
  _invoice_id uuid,
  _due_date date,
  _payer_guardian_id uuid DEFAULT NULL,
  _payer_student_id uuid DEFAULT NULL,
  _issue_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _credit_ids uuid[] DEFAULT ARRAY[]::uuid[],
  _items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _item jsonb;
  _new_subtotal_minor integer := 0;
  _new_total_minor integer;
  _new_tax_minor integer := 0;
  _vat_rate numeric;
  _credit_applied_minor integer := 0;
  _credit_row record;
  _items_count integer;
BEGIN
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', _invoice_id USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;

  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be edited (current status: %). To amend a sent invoice, create a credit note or a new invoice.', _invoice.status USING ERRCODE = '22023';
  END IF;

  IF (_payer_guardian_id IS NULL AND _payer_student_id IS NULL)
     OR (_payer_guardian_id IS NOT NULL AND _payer_student_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of payer_guardian_id or payer_student_id must be set' USING ERRCODE = '22023';
  END IF;

  _items_count := jsonb_array_length(_items);
  IF _items_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one line item' USING ERRCODE = '22023';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    IF (_item->>'description') IS NULL OR TRIM(_item->>'description') = '' THEN
      RAISE EXCEPTION 'Each item must have a non-empty description' USING ERRCODE = '22023';
    END IF;
    IF (_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero' USING ERRCODE = '22023';
    END IF;
    IF (_item->>'unit_price_minor')::integer < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative' USING ERRCODE = '22023';
    END IF;
    _new_subtotal_minor := _new_subtotal_minor
      + ((_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer);
  END LOOP;

  _vat_rate := COALESCE(_invoice.vat_rate, 0);
  IF _vat_rate > 0 THEN
    _new_tax_minor := ROUND(_new_subtotal_minor * _vat_rate / 100.0);
  END IF;
  _new_total_minor := _new_subtotal_minor + _new_tax_minor;

  IF _invoice.payment_plan_enabled = true AND _new_total_minor != _invoice.total_minor THEN
    RAISE EXCEPTION 'Cannot change invoice total while a payment plan is attached (current total: %, new total: %). Remove the payment plan first, then edit.',
      _invoice.total_minor, _new_total_minor USING ERRCODE = '22023';
  END IF;

  UPDATE make_up_credits
    SET redeemed_at = NULL,
        applied_to_invoice_id = NULL,
        notes = 'Credit freed — invoice edited'
    WHERE applied_to_invoice_id = _invoice_id
      AND org_id = _invoice.org_id
      AND redeemed_at IS NOT NULL;

  IF array_length(_credit_ids, 1) > 0 THEN
    FOR _credit_row IN
      SELECT * FROM make_up_credits
      WHERE id = ANY(_credit_ids)
        AND org_id = _invoice.org_id
      FOR UPDATE
    LOOP
      IF _credit_row.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has been voided', _credit_row.id USING ERRCODE = '22023';
      END IF;
      IF _credit_row.redeemed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has already been redeemed', _credit_row.id USING ERRCODE = '22023';
      END IF;
      IF _credit_row.expired_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has been marked expired', _credit_row.id USING ERRCODE = '22023';
      END IF;
      IF _credit_row.expires_at IS NOT NULL AND _credit_row.expires_at < CURRENT_DATE THEN
        RAISE EXCEPTION 'Credit % has expired', _credit_row.id USING ERRCODE = '22023';
      END IF;
      _credit_applied_minor := _credit_applied_minor + _credit_row.credit_value_minor;
      UPDATE make_up_credits
        SET redeemed_at = NOW(),
            applied_to_invoice_id = _invoice_id,
            notes = 'Applied to invoice ' || _invoice.invoice_number
        WHERE id = _credit_row.id;
    END LOOP;
  END IF;

  IF _credit_applied_minor > _new_total_minor THEN
    _credit_applied_minor := _new_total_minor;
  END IF;

  DELETE FROM invoice_items WHERE invoice_id = _invoice_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, org_id, description, quantity, unit_price_minor,
      amount_minor, linked_lesson_id, student_id
    ) VALUES (
      _invoice_id, _invoice.org_id, _item->>'description',
      (_item->>'quantity')::integer, (_item->>'unit_price_minor')::integer,
      (_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer,
      NULLIF(_item->>'linked_lesson_id', '')::uuid,
      NULLIF(_item->>'student_id', '')::uuid
    );
  END LOOP;

  UPDATE invoices
    SET payer_guardian_id = _payer_guardian_id,
        payer_student_id = _payer_student_id,
        issue_date = COALESCE(_issue_date, issue_date),
        due_date = _due_date,
        notes = _notes,
        subtotal_minor = _new_subtotal_minor,
        tax_minor = _new_tax_minor,
        total_minor = _new_total_minor,
        credit_applied_minor = _credit_applied_minor,
        updated_at = NOW()
    WHERE id = _invoice_id;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, before, after)
  VALUES (
    _invoice.org_id, auth.uid(), 'invoice_edited', 'invoice', _invoice_id,
    jsonb_build_object(
      'total_minor', _invoice.total_minor,
      'subtotal_minor', _invoice.subtotal_minor,
      'payer_guardian_id', _invoice.payer_guardian_id,
      'payer_student_id', _invoice.payer_student_id,
      'due_date', _invoice.due_date
    ),
    jsonb_build_object(
      'total_minor', _new_total_minor,
      'subtotal_minor', _new_subtotal_minor,
      'payer_guardian_id', _payer_guardian_id,
      'payer_student_id', _payer_student_id,
      'due_date', _due_date,
      'item_count', _items_count,
      'credit_applied_minor', _credit_applied_minor
    )
  );

  RETURN jsonb_build_object(
    'id', _invoice_id,
    'invoice_number', _invoice.invoice_number,
    'subtotal_minor', _new_subtotal_minor,
    'tax_minor', _new_tax_minor,
    'total_minor', _new_total_minor,
    'credit_applied_minor', _credit_applied_minor,
    'status', _invoice.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) TO authenticated;

COMMENT ON FUNCTION public.update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) IS
'Atomic edit of a draft invoice. Authorisation: is_org_finance_team. Gates: status=draft; payment_plan total unchanged. UPSERT semantics for items and credits — matches create_invoice_with_items. Credit eligibility checks parity with redeem_make_up_credit (CRD-C3): voided_at, redeemed_at, expired_at, expires_at<CURRENT_DATE.';


-- ===== 20260424130000: delete_billing_run frees applied credits (J8-F6) =====
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


-- ===== 20260424140000: issue_make_up_credit RPC + void_invoice notes preservation (J8-F17, J8-F4) =====
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
  IF NOT is_org_staff(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised to issue credits' USING ERRCODE = '42501';
  END IF;

  IF NOT is_org_active(_org_id) THEN
    RAISE EXCEPTION 'Organisation is not active' USING ERRCODE = '22023';
  END IF;

  IF _credit_value_minor IS NULL OR _credit_value_minor <= 0 THEN
    RAISE EXCEPTION 'Credit value must be greater than zero' USING ERRCODE = '22023';
  END IF;

  SELECT org_id INTO _student_org_id FROM students WHERE id = _student_id;
  IF _student_org_id IS NULL THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0002';
  END IF;
  IF _student_org_id != _org_id THEN
    RAISE EXCEPTION 'Student does not belong to this organisation' USING ERRCODE = '22023';
  END IF;

  INSERT INTO make_up_credits (
    org_id, student_id, issued_for_lesson_id,
    credit_value_minor, expires_at, notes, created_by
  ) VALUES (
    _org_id, _student_id, _issued_for_lesson_id,
    _credit_value_minor, _expires_at, _notes, auth.uid()
  )
  RETURNING * INTO _credit;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    _org_id, auth.uid(), 'credit_issued', 'make_up_credit', _credit.id,
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
          notes = COALESCE(notes, '')
            || CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE ' | ' END
            || 'Credit restored — invoice ' || _invoice.invoice_number
            || ' voided on ' || to_char(NOW(), 'YYYY-MM-DD')
      WHERE applied_to_invoice_id = _invoice_id
        AND org_id = _org_id
        AND redeemed_at IS NOT NULL;
    GET DIAGNOSTICS _credits_restored = ROW_COUNT;
  END IF;

  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (
    _org_id, auth.uid(), 'invoice_voided', 'invoice', _invoice_id,
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