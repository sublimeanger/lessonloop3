-- Batch 1Z: Area 1 canary walk fix-pass (combined migration)
--
-- Closes findings: CW-F1, CW-F2, CW-F3, CW-F4, CW-F9
-- (CW-F6 ships in supabase/functions/create-billing-run/index.ts; this
--  migration does not touch it.)
--
-- Walk doc: docs/audits/2026-04-area-1-canary-walk.md
--
-- Five distinct purposes in one migration. Each section is independently
-- idempotent. Wrapped in BEGIN/COMMIT so a failure in any section rolls
-- back the whole migration.

BEGIN;

-- ============================================================
-- 1. CW-F3 — Tighten create_invoice_with_items auth carve-out
-- ============================================================
-- Why
-- ---
-- The 2026-04-25 carve-out (20260425100100_ciwi_auth_service_role_bypass)
-- added `IF auth.uid() IS NOT NULL AND NOT is_org_finance_team(...)` so
-- the J9 generator (`generate_invoices_from_template`) could call CIWI
-- from inside its SECURITY DEFINER context (auth.uid() resolves to NULL
-- on cron-driven service-role requests). Side effect: any anonymous
-- caller (no JWT) also passes the gate. Defence-in-depth gap.
--
-- Fix: keep the J9 path working by accepting service-role context
-- explicitly (`current_setting('role', true) = 'service_role'`); reject
-- anonymous (no auth.uid() AND not service-role) callers.
--
-- Idempotent: CREATE OR REPLACE FUNCTION. Identical signature; every
-- non-auth branch preserved byte-for-byte from the 2026-04-25 definition.

CREATE OR REPLACE FUNCTION public.create_invoice_with_items(_org_id uuid, _due_date date, _payer_guardian_id uuid DEFAULT NULL::uuid, _payer_student_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _credit_ids uuid[] DEFAULT '{}'::uuid[], _items jsonb DEFAULT '[]'::jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _org RECORD;
  _subtotal integer;
  _tax_minor integer;
  _credit_offset integer := 0;
  _total_minor integer;
  _invoice RECORD;
  _item jsonb;
  _i integer := 0;
  _locked_credit_count integer;
BEGIN
  -- CW-F3: tightened auth carve-out.
  -- Authenticated callers must pass the finance-team check. Service-role
  -- callers (J9 generator, future trusted in-DB wrappers) bypass the
  -- row-level check on the assumption their wrapper does its own
  -- org-scope auth. Anonymous callers (no JWT, not service-role) reject.
  IF auth.uid() IS NOT NULL THEN
    IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
      RAISE EXCEPTION 'Not authorised to create invoices for this organisation';
    END IF;
  ELSIF current_setting('role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorised: anonymous callers cannot create invoices'
      USING HINT = 'Either authenticate as finance team, or invoke from a service-role context.';
  END IF;

  IF NOT is_org_active(_org_id) THEN
    RAISE EXCEPTION 'Organisation is not active';
  END IF;

  SELECT vat_enabled, vat_rate, currency_code INTO _org
  FROM organisations WHERE id = _org_id;
  IF _org IS NULL THEN RAISE EXCEPTION 'Organisation not found'; END IF;

  IF _payer_guardian_id IS NULL AND _payer_student_id IS NULL THEN
    RAISE EXCEPTION 'Invoice must have a payer (guardian or student)';
  END IF;

  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one item';
  END IF;

  SELECT COALESCE(SUM(
    (item->>'quantity')::integer * (item->>'unit_price_minor')::integer
  ), 0) INTO _subtotal
  FROM jsonb_array_elements(_items) AS item;

  IF _org.vat_enabled THEN
    _tax_minor := ROUND(_subtotal * _org.vat_rate / 100.0);
  ELSE
    _tax_minor := 0;
  END IF;

  IF array_length(_credit_ids, 1) > 0 THEN
    -- CRD-H3 FIX: added AND voided_at IS NULL
    SELECT COUNT(*), COALESCE(SUM(credit_value_minor), 0)
    INTO _locked_credit_count, _credit_offset
    FROM make_up_credits
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL
    FOR UPDATE;

    IF _locked_credit_count <> array_length(_credit_ids, 1) THEN
      RAISE EXCEPTION 'One or more credits have already been redeemed, expired, voided, or do not exist';
    END IF;
  END IF;

  _total_minor := GREATEST(0, _subtotal + _tax_minor - _credit_offset);

  INSERT INTO invoices (
    org_id, invoice_number, due_date,
    payer_guardian_id, payer_student_id, notes,
    vat_rate, subtotal_minor, tax_minor,
    credit_applied_minor, total_minor, currency_code
  ) VALUES (
    _org_id, '', _due_date,
    _payer_guardian_id, _payer_student_id, _notes,
    CASE WHEN _org.vat_enabled THEN _org.vat_rate ELSE 0 END,
    _subtotal, _tax_minor,
    _credit_offset, _total_minor, _org.currency_code
  ) RETURNING * INTO _invoice;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    INSERT INTO invoice_items (
      invoice_id, org_id, description, quantity,
      unit_price_minor, amount_minor,
      linked_lesson_id, student_id
    ) VALUES (
      _invoice.id, _org_id,
      _item->>'description',
      (_item->>'quantity')::integer,
      (_item->>'unit_price_minor')::integer,
      (_item->>'quantity')::integer * (_item->>'unit_price_minor')::integer,
      NULLIF(_item->>'linked_lesson_id', '')::uuid,
      NULLIF(_item->>'student_id', '')::uuid
    );
  END LOOP;

  IF array_length(_credit_ids, 1) > 0 THEN
    -- CRD-H3 FIX: added AND voided_at IS NULL
    UPDATE make_up_credits
    SET redeemed_at = NOW(),
        applied_to_invoice_id = _invoice.id,
        notes = 'Applied to invoice ' || _invoice.invoice_number
    WHERE id = ANY(_credit_ids)
      AND org_id = _org_id
      AND redeemed_at IS NULL
      AND expired_at IS NULL
      AND voided_at IS NULL;
  END IF;

  RETURN json_build_object(
    'id', _invoice.id,
    'invoice_number', _invoice.invoice_number,
    'total_minor', _total_minor,
    'subtotal_minor', _subtotal,
    'tax_minor', _tax_minor,
    'credit_applied_minor', _credit_offset,
    'status', _invoice.status
  );
END;
$function$;

-- ============================================================
-- 2. CW-F9 — Auto-allocate plan-invoice payments + drift backfill
-- ============================================================
-- Why
-- ---
-- record_manual_payment with p_installment_id IS NULL on a plan-enabled
-- invoice creates ledger drift: the orphan payment row contributes to
-- invoices.paid_minor (via recalculate_invoice_paid summing all payment
-- rows on the invoice) but recalculate_installment_status, called on
-- every non-void installment by recalculate_invoice_paid, only marks
-- an installment paid when it has payments WITH installment_id matching.
-- The orphan payment's NULL installment_id means no installment ever
-- sees it; installments stay pending while paid_minor reflects the cash.
--
-- Fix: when no installment_id is passed and the invoice is plan-enabled,
-- auto-allocate p_amount_minor greedily across pending installments by
-- (due_date ASC, id ASC). Insert one payment row per installment touched
-- so each installment has its own attached payments and recalc converges.
-- The overpayment hard-reject continues to enforce
-- _new_paid_minor <= _invoice.total_minor at the top of the function;
-- since Σ(installment.amount_minor) = invoice.total_minor by construction,
-- the allocation cannot run out of capacity before exhausting the budget.
--
-- Backfill: 2 known drifted rows (LL-2026-00015, LL-2026-00008) plus any
-- other invoices matching the same shape. Pre-flight count guard makes
-- the backfill idempotent.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + guarded DO $$ block.

CREATE OR REPLACE FUNCTION public.record_manual_payment(
  p_invoice_id uuid,
  p_amount_minor integer,
  p_method text,
  p_paid_at timestamptz DEFAULT now(),
  p_reference text DEFAULT NULL,
  p_installment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invoice invoices%ROWTYPE;
  _installment invoice_installments%ROWTYPE;
  _payment_id uuid;
  _first_payment_id uuid;
  _current_paid_minor integer;
  _new_paid_minor integer;
  _remaining integer;
  _inst RECORD;
  _inst_outstanding integer;
  _allocate integer;
BEGIN
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_method NOT IN ('card', 'bank_transfer', 'cash', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT is_org_finance_team(auth.uid(), _invoice.org_id) THEN
    RAISE EXCEPTION 'Not authorised'
      USING ERRCODE = '42501';
  END IF;

  IF _invoice.status IN ('draft', 'void') THEN
    RAISE EXCEPTION 'Cannot record payment against a % invoice', _invoice.status
      USING ERRCODE = '22023';
  END IF;

  -- Overpayment hard-reject (manual intent only; Stripe path accepts).
  -- Σ(installment.amount_minor) = invoice.total_minor for plan-enabled
  -- invoices, so this guard also caps the auto-allocation budget.
  _current_paid_minor := COALESCE(_invoice.paid_minor, 0);
  _new_paid_minor := _current_paid_minor + p_amount_minor;

  IF _new_paid_minor > _invoice.total_minor THEN
    RAISE EXCEPTION 'Payment of % would exceed invoice balance of %',
      p_amount_minor,
      _invoice.total_minor - _current_paid_minor
      USING ERRCODE = '22023',
            HINT = 'Reduce the payment amount to at most the outstanding balance.';
  END IF;

  IF p_installment_id IS NOT NULL THEN
    -- Caller targeted a specific installment.
    SELECT * INTO _installment
    FROM invoice_installments
    WHERE id = p_installment_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Installment % not found', p_installment_id
        USING ERRCODE = 'P0002';
    END IF;

    IF _installment.invoice_id != p_invoice_id THEN
      RAISE EXCEPTION 'Installment does not belong to invoice %', p_invoice_id
        USING ERRCODE = '22023';
    END IF;

    IF _installment.status = 'void' THEN
      RAISE EXCEPTION 'Cannot record payment against a voided installment'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO payments (
      invoice_id, org_id, amount_minor, currency_code, method, provider,
      provider_reference, paid_at, installment_id
    ) VALUES (
      p_invoice_id, _invoice.org_id, p_amount_minor, _invoice.currency_code,
      p_method::payment_method, 'manual'::payment_provider,
      p_reference, p_paid_at, p_installment_id
    )
    RETURNING id INTO _payment_id;

    PERFORM recalculate_invoice_paid(p_invoice_id);
    PERFORM recalculate_installment_status(p_installment_id);
    RETURN _payment_id;
  END IF;

  -- p_installment_id IS NULL.
  IF _invoice.payment_plan_enabled THEN
    -- CW-F9: auto-allocate across pending installments by (due_date ASC, id ASC).
    -- One payment row per installment touched; each row carries its own
    -- installment_id so recalc_installment_status sees the attached cash.
    _remaining := p_amount_minor;
    _first_payment_id := NULL;

    FOR _inst IN
      SELECT id, amount_minor
      FROM invoice_installments
      WHERE invoice_id = p_invoice_id
        AND status IN ('pending', 'overdue', 'partially_paid')
      ORDER BY due_date ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN _remaining <= 0;

      _inst_outstanding := _inst.amount_minor - COALESCE((
        SELECT SUM(p.amount_minor)
        FROM payments p
        WHERE p.installment_id = _inst.id
      ), 0);

      IF _inst_outstanding <= 0 THEN
        CONTINUE;
      END IF;

      _allocate := LEAST(_remaining, _inst_outstanding);

      INSERT INTO payments (
        invoice_id, org_id, amount_minor, currency_code, method, provider,
        provider_reference, paid_at, installment_id
      ) VALUES (
        p_invoice_id, _invoice.org_id, _allocate, _invoice.currency_code,
        p_method::payment_method, 'manual'::payment_provider,
        p_reference, p_paid_at, _inst.id
      )
      RETURNING id INTO _payment_id;

      IF _first_payment_id IS NULL THEN
        _first_payment_id := _payment_id;
      END IF;

      _remaining := _remaining - _allocate;
    END LOOP;

    IF _remaining > 0 THEN
      -- Should be unreachable: overpayment guard already capped p_amount_minor
      -- at total_minor - current_paid_minor, and Σ outstanding <= same.
      RAISE EXCEPTION 'Auto-allocation could not place % minor across pending installments',
        _remaining
        USING ERRCODE = '22023';
    END IF;

    PERFORM recalculate_invoice_paid(p_invoice_id);
    -- recalculate_invoice_paid already runs recalculate_installment_status
    -- on every non-void installment for this invoice. No extra calls needed.
    RETURN _first_payment_id;
  END IF;

  -- Non-plan invoice with no installment_id: original behaviour, single row.
  INSERT INTO payments (
    invoice_id, org_id, amount_minor, currency_code, method, provider,
    provider_reference, paid_at, installment_id
  ) VALUES (
    p_invoice_id, _invoice.org_id, p_amount_minor, _invoice.currency_code,
    p_method::payment_method, 'manual'::payment_provider,
    p_reference, p_paid_at, NULL
  )
  RETURNING id INTO _payment_id;

  PERFORM recalculate_invoice_paid(p_invoice_id);
  RETURN _payment_id;
END;
$$;

REVOKE ALL ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) TO authenticated;

COMMENT ON FUNCTION record_manual_payment(uuid, integer, text, timestamptz, text, uuid) IS
'Atomic manual payment recording. Authorisation: is_org_finance_team. Hard-rejects overpayment. Plan-enabled invoices with no installment_id auto-allocate across pending installments by (due_date ASC, id ASC) — see CW-F9 (Batch 1Z).';

-- CW-F9 backfill: re-process drifted plan invoices through the new
-- auto-allocation logic. For each drifted invoice:
--   1. Find every payment row attached to the invoice with installment_id
--      IS NULL ("orphan payments").
--   2. Reattach those orphan payment rows to pending installments via
--      in-place split (UPDATE the orphan to the first allocation,
--      INSERT additional rows for subsequent allocations). Preserves
--      the original payment row id for audit_log references.
--   3. Re-run recalculate_invoice_paid (which fans out to
--      recalculate_installment_status on every installment).
-- Pre-flight guard: skip if no drift.
DO $cwf9_backfill$
DECLARE
  _drifted_count integer;
  _invoice RECORD;
  _orphan RECORD;
  _inst RECORD;
  _remaining integer;
  _inst_outstanding integer;
  _allocate integer;
  _first_pass boolean;
BEGIN
  SELECT COUNT(*) INTO _drifted_count
  FROM invoices i
  WHERE i.payment_plan_enabled = true
    AND i.paid_minor IS DISTINCT FROM (
      SELECT COALESCE(SUM(amount_minor), 0)
      FROM invoice_installments
      WHERE invoice_id = i.id AND status = 'paid'
    );

  IF _drifted_count = 0 THEN
    RAISE NOTICE 'CW-F9 backfill: no drifted plan invoices, skipping';
    RETURN;
  END IF;

  RAISE NOTICE 'CW-F9 backfill: % drifted plan invoices to process', _drifted_count;

  FOR _invoice IN
    SELECT i.id, i.org_id, i.invoice_number, i.currency_code
    FROM invoices i
    WHERE i.payment_plan_enabled = true
      AND i.paid_minor IS DISTINCT FROM (
        SELECT COALESCE(SUM(amount_minor), 0)
        FROM invoice_installments
        WHERE invoice_id = i.id AND status = 'paid'
      )
    ORDER BY i.id
  LOOP
    FOR _orphan IN
      SELECT id, amount_minor, method, provider, provider_reference,
             paid_at, currency_code
      FROM payments
      WHERE invoice_id = _invoice.id
        AND installment_id IS NULL
      ORDER BY paid_at ASC, id ASC
      FOR UPDATE
    LOOP
      _remaining := _orphan.amount_minor;
      _first_pass := true;

      FOR _inst IN
        SELECT id, amount_minor
        FROM invoice_installments
        WHERE invoice_id = _invoice.id
          AND status IN ('pending', 'overdue', 'partially_paid')
        ORDER BY due_date ASC, id ASC
        FOR UPDATE
      LOOP
        EXIT WHEN _remaining <= 0;

        _inst_outstanding := _inst.amount_minor - COALESCE((
          SELECT SUM(p.amount_minor)
          FROM payments p
          WHERE p.installment_id = _inst.id
        ), 0);

        IF _inst_outstanding <= 0 THEN
          CONTINUE;
        END IF;

        _allocate := LEAST(_remaining, _inst_outstanding);

        IF _first_pass THEN
          -- In-place split: re-target the orphan row at the first allocation.
          UPDATE payments
          SET installment_id = _inst.id,
              amount_minor = _allocate
          WHERE id = _orphan.id;
          _first_pass := false;
        ELSE
          INSERT INTO payments (
            invoice_id, org_id, amount_minor, currency_code, method,
            provider, provider_reference, paid_at, installment_id
          ) VALUES (
            _invoice.id, _invoice.org_id, _allocate, _orphan.currency_code,
            _orphan.method, _orphan.provider, _orphan.provider_reference,
            _orphan.paid_at, _inst.id
          );
        END IF;

        _remaining := _remaining - _allocate;
      END LOOP;

      IF _remaining > 0 THEN
        RAISE NOTICE 'CW-F9 backfill: invoice % orphan payment % had % minor unallocated (no remaining pending capacity)',
          _invoice.invoice_number, _orphan.id, _remaining;
      END IF;
    END LOOP;

    PERFORM recalculate_invoice_paid(_invoice.id);
  END LOOP;
END
$cwf9_backfill$;

-- ============================================================
-- 3. CW-F4 — Convert pdf_rev item triggers to STATEMENT-level
-- ============================================================
-- Why
-- ---
-- Per-row firing on invoice_items / invoice_installments / payments
-- bumps invoices.pdf_rev N times for an N-row statement. A 3-item
-- create produces pdf_rev += 3 (and N audit_log update rows from the
-- pdf_rev trigger on invoices). Refactor to STATEMENT-level using
-- transition tables: one bump per affected invoice, regardless of the
-- statement's row count.
--
-- The fourth pdf_rev trigger (trg_bump_invoice_pdf_rev on invoices,
-- BEFORE UPDATE row-level) stays untouched — it fires once per invoice
-- mutation by definition.
--
-- Idempotent: DROP TRIGGER IF EXISTS + CREATE TRIGGER + CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_items_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.invoices i
     SET pdf_rev = i.pdf_rev + 1
   WHERE i.id IN (
     SELECT invoice_id FROM _new_rows
     UNION
     SELECT invoice_id FROM _old_rows
   );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_items ON public.invoice_items;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_items
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  REFERENCING NEW TABLE AS _new_rows OLD TABLE AS _old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_items_stmt();

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_installments_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.invoices i
     SET pdf_rev = i.pdf_rev + 1
   WHERE i.id IN (
     SELECT invoice_id FROM _new_rows
     UNION
     SELECT invoice_id FROM _old_rows
   );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_installments ON public.invoice_installments;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_installments
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_installments
  REFERENCING NEW TABLE AS _new_rows OLD TABLE AS _old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_installments_stmt();

CREATE OR REPLACE FUNCTION public.bump_invoice_pdf_rev_from_payments_stmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.invoices i
     SET pdf_rev = i.pdf_rev + 1
   WHERE i.id IN (
     SELECT invoice_id FROM _new_rows
     UNION
     SELECT invoice_id FROM _old_rows
   );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_invoice_pdf_rev_from_payments ON public.payments;
CREATE TRIGGER trg_bump_invoice_pdf_rev_from_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  REFERENCING NEW TABLE AS _new_rows OLD TABLE AS _old_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.bump_invoice_pdf_rev_from_payments_stmt();

REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_items_stmt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_installments_stmt() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bump_invoice_pdf_rev_from_payments_stmt() FROM PUBLIC;

-- ============================================================
-- 4. CW-F2 — Add payer-XOR CHECK constraint (NOT VALID)
-- ============================================================
-- Why
-- ---
-- Phase 2 invariant I5 found 7 rows violate
-- num_nonnulls(payer_guardian_id, payer_student_id) = 1
-- (5 in Jamie's own org with both set; 2 in E2E Test Academy with
-- neither). Add the CHECK as NOT VALID so the migration applies
-- without forcing a resolution decision now. Jamie inspects the 7
-- rows (query D in PR body §3) and runs VALIDATE CONSTRAINT once
-- they are clean.
--
-- Idempotent via pg_constraint EXISTS guard.

DO $cwf2_constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_payer_xor'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_payer_xor
      CHECK (num_nonnulls(payer_guardian_id, payer_student_id) = 1)
      NOT VALID;
  END IF;
END
$cwf2_constraint$;

COMMENT ON CONSTRAINT invoices_payer_xor ON public.invoices IS
'Exactly one of payer_guardian_id, payer_student_id must be non-null. NOT VALID at creation (Batch 1Z, CW-F2); Jamie resolves the 7 violating rows then runs VALIDATE CONSTRAINT.';

-- ============================================================
-- 5. CW-F1 — Demote 12 demo invoices from 'paid' to 'sent'
-- ============================================================
-- Why
-- ---
-- 12 demo invoices in 'Premier Music Education Agency' and 'Harmony
-- Music Academy' marked status='paid' with paid_minor=0 and zero
-- attached payments — pre-fix-period seed drift. Demote to 'sent' so
-- I2 (status=paid ⇒ paid_minor>=total_minor) holds going forward.
-- Setting paid_minor synthetically would lie about the ledger; demoting
-- to 'sent' preserves the row as a draft-like artefact and makes the
-- invariant hold.
--
-- Idempotent: pre-flight guard counts current matches.

DO $cwf1_backfill$
DECLARE
  _affected_count integer;
BEGIN
  SELECT COUNT(*) INTO _affected_count
  FROM invoices i
  WHERE i.status = 'paid'
    AND i.paid_minor = 0
    AND i.total_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = i.id);

  IF _affected_count = 0 THEN
    RAISE NOTICE 'CW-F1 backfill: no demotable rows, skipping';
    RETURN;
  END IF;

  RAISE NOTICE 'CW-F1 backfill: demoting % rows from paid to sent', _affected_count;

  UPDATE invoices
  SET status = 'sent'
  WHERE status = 'paid'
    AND paid_minor = 0
    AND total_minor > 0
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.invoice_id = invoices.id);
END
$cwf1_backfill$;

-- ============================================================
-- (CW-F6 fix is in supabase/functions/create-billing-run/index.ts;
--  this migration does not touch it.)
-- ============================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
