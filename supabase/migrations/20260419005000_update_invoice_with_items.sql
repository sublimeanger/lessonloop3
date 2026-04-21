-- Journey 1 Commit 3a: update_invoice_with_items RPC
--
-- Allows editing of draft invoices. Mirrors create_invoice_with_items
-- shape — atomic UPSERT of fields + items + credits within a single txn.
--
-- Gated on:
--   - invoice.status = 'draft' (post-send edits require credit-note workflow)
--   - payment_plan_enabled = false OR total unchanged (plan-with-total-change blocked)
--   - is_org_finance_team authorisation (mirrors record_manual_refund pattern)
--
-- UPSERT strategy for items and credits — delete all, reinsert new set.
-- Safe because:
--   - ON DELETE CASCADE from invoice on invoice_items handles cleanup
--   - No payments exist on draft (status gated)
--   - Matches create_invoice_with_items semantics
--
-- Credit handling:
--   - Free all currently-applied credits (redeemed_at = NULL,
--     applied_to_invoice_id = NULL)
--   - Apply the new _credit_ids set (redeemed_at = NOW(),
--     applied_to_invoice_id = _invoice_id)
--   - Server caps credit_applied_minor at total_minor (matches create flow)

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
  _available_credit_minor integer;
  _items_count integer;
BEGIN
  -- Lock invoice
  SELECT * INTO _invoice FROM invoices WHERE id = _invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', _invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Authorisation
  IF NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised'
      USING ERRCODE = '42501';
  END IF;

  -- Status gate: draft only
  IF _invoice.status != 'draft' THEN
    RAISE EXCEPTION 'Only draft invoices can be edited (current status: %). To amend a sent invoice, create a credit note or a new invoice.', _invoice.status
      USING ERRCODE = '22023';
  END IF;

  -- Validate payer: exactly one of guardian_id or student_id must be set
  IF (_payer_guardian_id IS NULL AND _payer_student_id IS NULL)
     OR (_payer_guardian_id IS NOT NULL AND _payer_student_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Exactly one of payer_guardian_id or payer_student_id must be set'
      USING ERRCODE = '22023';
  END IF;

  -- Validate items presence
  _items_count := jsonb_array_length(_items);
  IF _items_count = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one line item'
      USING ERRCODE = '22023';
  END IF;

  -- Validate each item
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

  -- Compute VAT (use existing invoice rate)
  _vat_rate := COALESCE(_invoice.vat_rate, 0);
  IF _vat_rate > 0 THEN
    _new_tax_minor := ROUND(_new_subtotal_minor * _vat_rate / 100.0);
  END IF;

  _new_total_minor := _new_subtotal_minor + _new_tax_minor;

  -- Payment plan guard: if plan exists and total would change, reject
  IF _invoice.payment_plan_enabled = true AND _new_total_minor != _invoice.total_minor THEN
    RAISE EXCEPTION 'Cannot change invoice total while a payment plan is attached (current total: %, new total: %). Remove the payment plan first, then edit.',
      _invoice.total_minor, _new_total_minor
      USING ERRCODE = '22023';
  END IF;

  -- Free all currently-applied credits on this invoice (UPSERT credit pattern)
  UPDATE make_up_credits
    SET redeemed_at = NULL,
        applied_to_invoice_id = NULL,
        notes = 'Credit freed — invoice edited'
    WHERE applied_to_invoice_id = _invoice_id
      AND org_id = _invoice.org_id
      AND redeemed_at IS NOT NULL;

  -- Apply new credit set
  IF array_length(_credit_ids, 1) > 0 THEN
    FOR _credit_row IN
      SELECT * FROM make_up_credits
      WHERE id = ANY(_credit_ids)
        AND org_id = _invoice.org_id
      FOR UPDATE
    LOOP
      -- Validate credit eligibility
      IF _credit_row.redeemed_at IS NOT NULL THEN
        RAISE EXCEPTION 'Credit % has already been redeemed', _credit_row.id
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

  -- Cap credit at new total (matches create flow — no family account concept yet)
  IF _credit_applied_minor > _new_total_minor THEN
    _credit_applied_minor := _new_total_minor;
  END IF;

  -- Replace items (UPSERT: delete all, insert new set)
  DELETE FROM invoice_items WHERE invoice_id = _invoice_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price_minor,
      amount_minor,
      linked_lesson_id,
      student_id
    ) VALUES (
      _invoice_id,
      _item->>'description',
      (_item->>'quantity')::integer,
      (_item->>'unit_price_minor')::integer,
      (_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer,
      NULLIF(_item->>'linked_lesson_id', '')::uuid,
      NULLIF(_item->>'student_id', '')::uuid
    );
  END LOOP;

  -- Update invoice fields
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

  -- Audit log entry
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
      'due_date', _invoice.due_date,
      'item_count', (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = _invoice_id)
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

REVOKE ALL ON FUNCTION update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) TO authenticated;

COMMENT ON FUNCTION update_invoice_with_items(uuid, date, uuid, uuid, date, text, uuid[], jsonb) IS
'Atomic edit of a draft invoice. Authorisation: is_org_finance_team. Gates: status=draft; payment_plan total unchanged. UPSERT semantics for items and credits — matches create_invoice_with_items.';

NOTIFY pgrst, 'reload schema';

COMMIT;
