-- J9 Phase 2 C4 — Generator RPC + cancel_template_run RPC.
--
-- Implements design doc §3 (algorithm) + §4 (scheduler reference) +
-- §6 (edge cases) + Appendix A (CIWI auth). Includes three Phase 1
-- schema fixes discovered during C4 sanity check: runs.outcome
-- CHECK extension for 'cancelled', delivered_statuses default
-- correction from '{attended}' (invalid enum value) to '{present}',
-- and run_errors.student_id NOT NULL drop (template-level errors
-- like no_next_term aren't per-student).
--
-- Idempotent via CREATE OR REPLACE and DROP CONSTRAINT IF EXISTS.

-- ─── Phase 1 schema fixes ─────────────────────────────────────────

-- 1. Extend runs.outcome CHECK to allow 'cancelled'.
ALTER TABLE public.recurring_template_runs
  DROP CONSTRAINT IF EXISTS recurring_template_runs_outcome_check;
ALTER TABLE public.recurring_template_runs
  ADD CONSTRAINT recurring_template_runs_outcome_check
  CHECK (outcome IN (
    'completed', 'partial', 'failed', 'running', 'cancelled'
  ));

-- 2. Correct delivered_statuses default to a valid enum value.
-- 'attended' is not a value of public.attendance_status enum
-- ('present', 'absent', 'late', 'cancelled_by_teacher',
-- 'cancelled_by_student'). Default was set incorrectly in Phase 1
-- migration 20260424160000; correcting to 'present' — the enum value
-- that semantically represents "the student attended and the lesson
-- is billable." Operators can customise per template.
ALTER TABLE public.recurring_invoice_templates
  ALTER COLUMN delivered_statuses
  SET DEFAULT ARRAY['present']::text[];

-- Migrate any existing rows that still hold the invalid default.
-- Idempotent: only updates rows where the exact invalid default value
-- is still present.
UPDATE public.recurring_invoice_templates
  SET delivered_statuses = ARRAY['present']::text[]
  WHERE delivered_statuses = ARRAY['attended']::text[];

-- 3. Drop NOT NULL on run_errors.student_id.
-- Template-level errors (no_next_term, etc.) aren't per-student —
-- they're per-run. The Phase 1 NOT NULL was correct for the common
-- per-recipient case but blocks legitimate template-scoped error
-- variants. Application logic + error_code semantics carry the
-- meaning instead.
ALTER TABLE public.recurring_template_run_errors
  ALTER COLUMN student_id DROP NOT NULL;

-- ─── generate_invoices_from_template ──────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_invoices_from_template(
  _template_id uuid,
  _triggered_by text DEFAULT 'manual',
  _source text DEFAULT 'recurring_manual_run'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _template recurring_invoice_templates%ROWTYPE;
  _run_id uuid;
  _run_date date := CURRENT_DATE;
  _period_start date;
  _period_end date;
  _next_term_start date;
  _recipient_row record;
  _lesson_row record;
  _item_row record;
  _invoice_result json;
  _invoice_id uuid;
  _billable_items jsonb := '[]'::jsonb;
  _resolved_guardian_id uuid;
  _resolved_student_id uuid;
  _student_email text;
  _due_date date;
  _rate_minor integer;
  _invoice_count integer := 0;
  _skipped_count integer := 0;
  _recipients_total integer := 0;
  _invoice_ids uuid[] := ARRAY[]::uuid[];
  _error_code text;
  _sqlstate text;
  _sqlerrm text;
  _outcome text;
  _last_status text;
  _recipient_had_items boolean;
  _no_rate_count integer;
  _pay_terms integer;
BEGIN
  -- ─── Validate inputs ────────────────────────────────────────────
  IF _source NOT IN ('recurring_manual_run', 'recurring_scheduler') THEN
    RAISE EXCEPTION 'Invalid _source: %', _source USING ERRCODE = '22023';
  END IF;

  IF _triggered_by NOT IN ('manual', 'scheduler', 'retry') THEN
    RAISE EXCEPTION 'Invalid _triggered_by: %', _triggered_by
      USING ERRCODE = '22023';
  END IF;

  -- ─── Lock template ──────────────────────────────────────────────
  SELECT * INTO _template
  FROM recurring_invoice_templates
  WHERE id = _template_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % not found', _template_id
      USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT is_org_finance_team(auth.uid(), _template.org_id) THEN
      RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NOT _template.active THEN
    RAISE EXCEPTION 'Template % is not active', _template_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ─── Compute billing period ─────────────────────────────────────
  IF _template.next_run_date IS NULL THEN
    RAISE EXCEPTION 'Template % has no next_run_date', _template_id
      USING ERRCODE = 'P0001';
  END IF;

  IF _template.frequency = 'weekly' THEN
    _period_start := _template.next_run_date - INTERVAL '7 days';
    _period_end := _template.next_run_date - INTERVAL '1 day';
  ELSIF _template.frequency = 'monthly' THEN
    _period_start := _template.next_run_date - INTERVAL '1 month';
    _period_end := _template.next_run_date - INTERVAL '1 day';
  ELSIF _template.frequency = 'termly' THEN
    IF _template.term_id IS NOT NULL THEN
      -- One-shot: generate for that specific term.
      SELECT start_date, end_date
        INTO _period_start, _period_end
      FROM terms
      WHERE id = _template.term_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Template term % not found', _template.term_id
          USING ERRCODE = 'P0002';
      END IF;
    ELSE
      -- Rolling: prefer term containing next_run_date; else most
      -- recently ended term before next_run_date.
      SELECT start_date, end_date
        INTO _period_start, _period_end
      FROM terms
      WHERE org_id = _template.org_id
        AND start_date <= _template.next_run_date
        AND end_date   >= _template.next_run_date
      ORDER BY start_date DESC
      LIMIT 1;

      IF NOT FOUND THEN
        SELECT start_date, end_date
          INTO _period_start, _period_end
        FROM terms
        WHERE org_id = _template.org_id
          AND end_date < _template.next_run_date
        ORDER BY end_date DESC
        LIMIT 1;
      END IF;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'No term found for rolling termly template %',
          _template_id USING ERRCODE = 'P0002';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown frequency: %', _template.frequency
      USING ERRCODE = '22023';
  END IF;

  -- ─── Count recipients (for recipients_total) ────────────────────
  SELECT COUNT(*) INTO _recipients_total
  FROM recurring_template_recipients
  WHERE template_id = _template_id
    AND COALESCE(is_active, true) = true;

  -- ─── Create run row ─────────────────────────────────────────────
  INSERT INTO recurring_template_runs (
    template_id,
    org_id,
    run_date,
    period_start,
    period_end,
    triggered_by,
    triggered_by_user_id,
    outcome,
    recipients_total,
    invoices_generated,
    recipients_skipped,
    started_at,
    audit_metadata
  ) VALUES (
    _template_id,
    _template.org_id,
    _run_date,
    _period_start,
    _period_end,
    _triggered_by,
    auth.uid(),
    'running',
    _recipients_total,
    0,
    0,
    now(),
    jsonb_build_object('source', _source)
  )
  RETURNING id INTO _run_id;

  -- ─── Per-recipient loop ─────────────────────────────────────────
  FOR _recipient_row IN
    SELECT student_id
    FROM recurring_template_recipients
    WHERE template_id = _template_id
      AND COALESCE(is_active, true) = true
    ORDER BY student_id
  LOOP
    BEGIN  -- implicit savepoint per recipient

      -- ── 1. Resolve payer ──────────────────────────────────────
      _resolved_guardian_id := NULL;
      _resolved_student_id  := NULL;
      _student_email := NULL;

      SELECT sg.guardian_id INTO _resolved_guardian_id
      FROM student_guardians sg
      WHERE sg.student_id = _recipient_row.student_id
        AND sg.is_primary_payer = true
      LIMIT 1;

      IF _resolved_guardian_id IS NULL THEN
        SELECT email INTO _student_email
        FROM students
        WHERE id = _recipient_row.student_id;

        IF _student_email IS NOT NULL AND _student_email <> '' THEN
          _resolved_student_id := _recipient_row.student_id;
        ELSE
          INSERT INTO recurring_template_run_errors (
            run_id, template_id, org_id, student_id,
            error_code, error_message
          ) VALUES (
            _run_id, _template_id, _template.org_id,
            _recipient_row.student_id,
            'no_payer_resolved',
            'No primary-payer guardian and student has no email.'
          );
          _skipped_count := _skipped_count + 1;
          CONTINUE;
        END IF;
      END IF;

      -- ── 2. Resolve billable items ─────────────────────────────
      _billable_items := '[]'::jsonb;
      _recipient_had_items := false;
      _no_rate_count := 0;

      -- ── 2a. Delivered mode (or hybrid): lesson-backed items ───
      IF _template.billing_mode IN ('delivered', 'hybrid') THEN
        FOR _lesson_row IN
          SELECT
            l.id            AS lesson_id,
            l.title         AS lesson_title,
            lp.rate_minor   AS lp_rate_minor
          FROM lessons l
          JOIN lesson_participants lp
            ON lp.lesson_id = l.id
           AND lp.student_id = _recipient_row.student_id
          LEFT JOIN attendance_records ar
            ON ar.lesson_id = l.id
           AND ar.student_id = _recipient_row.student_id
          WHERE l.org_id = _template.org_id
            AND l.status <> 'cancelled'
            AND l.end_at::date >= _period_start
            AND l.end_at::date <= _period_end
            AND ar.attendance_status IS NOT NULL
            AND ar.attendance_status::text = ANY(_template.delivered_statuses)
            AND NOT EXISTS (
              SELECT 1
              FROM invoice_items ii
              JOIN invoices i ON i.id = ii.invoice_id
              WHERE ii.linked_lesson_id = l.id
                AND i.status <> 'void'
            )
          ORDER BY l.end_at
        LOOP
          -- Resolve rate: lp.rate_minor → student default → org default.
          _rate_minor := _lesson_row.lp_rate_minor;

          IF _rate_minor IS NULL THEN
            SELECT (rc.rate_amount * 100)::integer INTO _rate_minor
            FROM students s
            JOIN rate_cards rc ON rc.id = s.default_rate_card_id
            WHERE s.id = _recipient_row.student_id;
          END IF;

          IF _rate_minor IS NULL THEN
            SELECT (rate_amount * 100)::integer INTO _rate_minor
            FROM rate_cards
            WHERE org_id = _template.org_id
              AND is_default = true
            LIMIT 1;
          END IF;

          IF _rate_minor IS NULL THEN
            _no_rate_count := _no_rate_count + 1;
            CONTINUE;
          END IF;

          _billable_items := _billable_items || jsonb_build_array(
            jsonb_build_object(
              'description', COALESCE(_lesson_row.lesson_title, 'Lesson'),
              'quantity', 1,
              'unit_price_minor', _rate_minor,
              'linked_lesson_id', _lesson_row.lesson_id,
              'student_id', _recipient_row.student_id
            )
          );
          _recipient_had_items := true;
        END LOOP;
      END IF;

      -- ── 2b. Upfront mode (or hybrid): fixed items ─────────────
      IF _template.billing_mode IN ('upfront', 'hybrid') THEN
        FOR _item_row IN
          SELECT description, amount_minor, quantity
          FROM recurring_template_items
          WHERE template_id = _template_id
          ORDER BY order_index NULLS LAST, id
        LOOP
          _billable_items := _billable_items || jsonb_build_array(
            jsonb_build_object(
              'description', _item_row.description,
              'quantity', _item_row.quantity,
              'unit_price_minor', _item_row.amount_minor,
              'linked_lesson_id', NULL,
              'student_id', _recipient_row.student_id
            )
          );
          _recipient_had_items := true;
        END LOOP;
      END IF;

      -- ── 3. Empty-items handling ───────────────────────────────
      IF NOT _recipient_had_items THEN
        IF _no_rate_count > 0 THEN
          _error_code := 'no_rate_card';
        ELSE
          _error_code := 'no_lessons_in_period';
        END IF;

        INSERT INTO recurring_template_run_errors (
          run_id, template_id, org_id, student_id,
          error_code, error_message
        ) VALUES (
          _run_id, _template_id, _template.org_id,
          _recipient_row.student_id,
          _error_code,
          CASE _error_code
            WHEN 'no_rate_card' THEN format(
              '%s lesson(s) skipped for missing rate.', _no_rate_count
            )
            ELSE 'No billable items found in period.'
          END
        );
        _skipped_count := _skipped_count + 1;
        CONTINUE;
      END IF;

      -- ── 4. Compute due date ───────────────────────────────────
      IF _template.due_date_offset_days IS NOT NULL THEN
        _due_date := _period_end + _template.due_date_offset_days;
      ELSE
        SELECT COALESCE(default_payment_terms_days, 14)
          INTO _pay_terms
        FROM organisations
        WHERE id = _template.org_id;
        _due_date := _period_end + COALESCE(_pay_terms, 14);
      END IF;

      -- ── 5. Call CIWI ──────────────────────────────────────────
      SELECT create_invoice_with_items(
        _org_id            := _template.org_id,
        _due_date          := _due_date,
        _payer_guardian_id := _resolved_guardian_id,
        _payer_student_id  := _resolved_student_id,
        _notes             := _template.notes,
        _credit_ids        := ARRAY[]::uuid[],
        _items             := _billable_items
      ) INTO _invoice_result;

      _invoice_id := (_invoice_result->>'id')::uuid;

      IF _invoice_id IS NULL THEN
        RAISE EXCEPTION 'CIWI returned no invoice id: %',
          _invoice_result USING ERRCODE = 'P0002';
      END IF;

      -- ── 6. Post-CIWI provenance UPDATE ────────────────────────
      UPDATE invoices
        SET generated_from_template_id = _template_id,
            generated_from_run_id      = _run_id
        WHERE id = _invoice_id;

      _invoice_count := _invoice_count + 1;
      _invoice_ids := _invoice_ids || _invoice_id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS
        _sqlstate = RETURNED_SQLSTATE,
        _sqlerrm = MESSAGE_TEXT;

      _error_code := CASE _sqlstate
        WHEN '23505' THEN 'duplicate_invoice'
        WHEN '42501' THEN 'authorization_failed'
        ELSE 'db_error'
      END;

      INSERT INTO recurring_template_run_errors (
        run_id, template_id, org_id, student_id,
        error_code, error_message
      ) VALUES (
        _run_id, _template_id, _template.org_id,
        _recipient_row.student_id,
        _error_code,
        format('%s: %s', _sqlstate, _sqlerrm)
      );
      _skipped_count := _skipped_count + 1;
    END;
  END LOOP;

  -- ─── Advance next_run_date ──────────────────────────────────────
  IF _template.frequency = 'weekly' THEN
    UPDATE recurring_invoice_templates
      SET next_run_date = _template.next_run_date + INTERVAL '7 days'
      WHERE id = _template_id;
  ELSIF _template.frequency = 'monthly' THEN
    UPDATE recurring_invoice_templates
      SET next_run_date = _template.next_run_date + INTERVAL '1 month'
      WHERE id = _template_id;
  ELSIF _template.frequency = 'termly' THEN
    IF _template.term_id IS NOT NULL THEN
      -- One-shot: retire template.
      UPDATE recurring_invoice_templates
        SET active = false
        WHERE id = _template_id;
    ELSE
      -- Rolling: find next term's start.
      SELECT MIN(start_date) INTO _next_term_start
      FROM terms
      WHERE org_id = _template.org_id
        AND start_date > _period_end;

      IF _next_term_start IS NOT NULL THEN
        UPDATE recurring_invoice_templates
          SET next_run_date = _next_term_start
          WHERE id = _template_id;
      ELSE
        UPDATE recurring_invoice_templates
          SET active = false
          WHERE id = _template_id;

        INSERT INTO recurring_template_run_errors (
          run_id, template_id, org_id, student_id,
          error_code, error_message
        ) VALUES (
          _run_id, _template_id, _template.org_id,
          NULL,
          'no_next_term',
          'Template paused: no future term scheduled. Add a new term and reactivate.'
        );
      END IF;
    END IF;
  END IF;

  -- ─── Finalise run ───────────────────────────────────────────────
  _outcome := CASE
    WHEN _skipped_count = 0 THEN 'completed'
    WHEN _invoice_count > 0 THEN 'partial'
    ELSE 'failed'
  END;

  _last_status := CASE
    WHEN _outcome = 'completed' THEN 'completed'
    WHEN _outcome = 'partial' THEN 'partial'
    ELSE 'failed'
  END;

  UPDATE recurring_template_runs
    SET outcome = _outcome,
        invoices_generated = _invoice_count,
        recipients_skipped = _skipped_count,
        completed_at = now()
    WHERE id = _run_id;

  UPDATE recurring_invoice_templates
    SET last_run_id = _run_id,
        last_run_status = _last_status,
        last_run_at = now(),
        last_run_invoice_count = _invoice_count
    WHERE id = _template_id;

  -- ─── Audit ──────────────────────────────────────────────────────
  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _template.org_id,
    auth.uid(),
    'template_run_completed',
    'recurring_template_run',
    _run_id,
    jsonb_build_object(
      'template_id',        _template_id,
      'triggered_by',       _triggered_by,
      'source',             _source,
      'outcome',            _outcome,
      'invoice_count',      _invoice_count,
      'recipients_skipped', _skipped_count,
      'period_start',       _period_start,
      'period_end',         _period_end
    )
  );

  RETURN jsonb_build_object(
    'run_id',             _run_id,
    'outcome',            _outcome,
    'invoice_count',      _invoice_count,
    'recipients_skipped', _skipped_count,
    'recipients_total',   _recipients_total,
    'invoice_ids',        to_jsonb(_invoice_ids),
    'period_start',       _period_start,
    'period_end',         _period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invoices_from_template(uuid, text, text)
  TO authenticated, service_role;

-- ─── cancel_template_run ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_template_run(
  _run_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _run recurring_template_runs%ROWTYPE;
  _template_org_id uuid;
  _invoice record;
  _voided_count integer := 0;
BEGIN
  SELECT * INTO _run
  FROM recurring_template_runs
  WHERE id = _run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run % not found', _run_id USING ERRCODE = 'P0002';
  END IF;

  SELECT org_id INTO _template_org_id
  FROM recurring_invoice_templates
  WHERE id = _run.template_id;

  IF auth.uid() IS NOT NULL THEN
    IF NOT is_org_finance_team(auth.uid(), _template_org_id) THEN
      RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR _invoice IN
    SELECT id, org_id FROM invoices
    WHERE generated_from_run_id = _run_id
      AND status <> 'void'
  LOOP
    PERFORM void_invoice(_invoice.id, _invoice.org_id);
    _voided_count := _voided_count + 1;
  END LOOP;

  UPDATE recurring_template_runs
    SET outcome = 'cancelled',
        completed_at = COALESCE(completed_at, now())
    WHERE id = _run_id;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _template_org_id,
    auth.uid(),
    'template_run_cancelled',
    'recurring_template_run',
    _run_id,
    jsonb_build_object(
      'voided_invoice_count', _voided_count,
      'run_id',               _run_id
    )
  );

  RETURN jsonb_build_object(
    'run_id',               _run_id,
    'voided_invoice_count', _voided_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_template_run(uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
