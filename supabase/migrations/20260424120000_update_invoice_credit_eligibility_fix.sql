-- Journey 8 Commit 1 (J8-F1, J8-F2): update_invoice_with_items credit
-- eligibility parity with create_invoice_with_items.
--
-- Current live version (20260421080040) of update_invoice_with_items
-- validates applied credits only for redeemed_at (already used) and
-- expires_at (past date). It MISSES:
--   - voided_at IS NOT NULL guard (credit was manually voided — must not reapply)
--   - expired_at IS NOT NULL guard (expired credit with explicit marker —
--     set by credit-expiry cron once J8-F5 scheduling lands)
--
-- create_invoice_with_items (CRD-H3 fix in 20260316260000) DOES check
-- all four conditions. redeem_make_up_credit (CRD-C3 fix in same migration)
-- DOES check all four. update_invoice_with_items was left behind when
-- Journey 1 Commit 3a introduced it — it only mirrored the weaker
-- redeemed/expires check.
--
-- Consequence: a voided or expiry-cron-marked credit can be reapplied
-- via the edit-draft path, silently double-counting the credit or
-- resurrecting a credit that should be dead.
--
-- Fix: add two extra guards in the same order redeem_make_up_credit
-- uses. Preserves all other behaviour verbatim from the live version.
-- Idempotent via CREATE OR REPLACE.

BEGIN;

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
    RAISE EXCEPTION 'Invoice % not found', _invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised'
      USING ERRCODE = '42501';
  END IF;

  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be edited (current status: %). To amend a sent invoice, create a credit note or a new invoice.', _invoice.status
      USING ERRCODE = '22023';
  END IF;

  IF (_payer_guardian_id IS NULL AND _payer_student_id IS NULL)
     OR (_payer_guardian_id IS NOT NULL AND _payer_student_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of payer_guardian_id or payer_student_id must be set'
      USING ERRCODE = '22023';
  END IF;

  _items_count := jsonb_array_length(_items);
  IF _items_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one line item'
      USING ERRCODE = '22023';
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    IF (_item->>'description') IS NULL OR TRIM(_item->>'description') = '' THEN
      RAISE EXCEPTION 'Each item must have a non-empty description'
        USING ERRCODE = '22023';
    END IF;
    IF (_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero'
        USING ERRCODE = '22023';
    END IF;
    IF (_item->>'unit_price_minor')::integer < 0 THEN
      RAISE EXCEPTION 'Item unit price cannot be negative'
        USING ERRCODE = '22023';
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
      _invoice.total_minor, _new_total_minor
      USING ERRCODE = '22023';
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
      -- J8-F1: voided credits must not reapply. Matches redeem_make_up_credit
      -- CRD-C3 pattern (20260316260000).
      IF _credit_row.voided_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has been voided', _credit_row.id
          USING ERRCODE = '22023';
      END IF;
      IF _credit_row.redeemed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has already been redeemed', _credit_row.id
          USING ERRCODE = '22023';
      END IF;
      -- J8-F2: explicitly-marked expired credits must not reapply.
      -- Covers the cron-set flag path in addition to the expires_at
      -- comparison below.
      IF _credit_row.expired_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has been marked expired', _credit_row.id
          USING ERRCODE = '22023';
      END IF;
      IF _credit_row.expires_at IS NOT NULL AND _credit_row.expires_at < CURRENT_DATE THEN
        RAISE EXCEPTION 'Credit % has expired', _credit_row.id
          USING ERRCODE = '22023';
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
      invoice_id,
      org_id,
      description,
      quantity,
      unit_price_minor,
      amount_minor,
      linked_lesson_id,
      student_id
    ) VALUES (
      _invoice_id,
      _invoice.org_id,
      _item->>'description',
      (_item->>'quantity')::integer,
      (_item->>'unit_price_minor')::integer,
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

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, before, after
  )
  VALUES (
    _invoice.org_id,
    auth.uid(),
    'invoice_edited',
    'invoice',
    _invoice_id,
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

NOTIFY pgrst, 'reload schema';

COMMIT;
