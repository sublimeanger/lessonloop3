-- J9 Phase 4B C1 — parent_run_id linkage on runs + retry_failed_recipients RPC.

ALTER TABLE public.recurring_template_runs
  ADD COLUMN IF NOT EXISTS parent_run_id uuid
    REFERENCES public.recurring_template_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_recurring_template_runs_parent
  ON public.recurring_template_runs (parent_run_id)
  WHERE parent_run_id IS NOT NULL;

COMMENT ON COLUMN public.recurring_template_runs.parent_run_id IS
  'For retry runs created via retry_failed_recipients: the run row this retry was triggered from. NULL for first/scheduled/manual runs. ON DELETE SET NULL preserves audit trail if the parent is ever cleaned up.';

CREATE OR REPLACE FUNCTION public.retry_failed_recipients(
  _run_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _parent recurring_template_runs%ROWTYPE;
  _template recurring_invoice_templates%ROWTYPE;
  _new_run_id uuid;
  _failed_student_ids uuid[];
  _student_id uuid;
  _resolved_guardian_id uuid;
  _resolved_student_id uuid;
  _student_email text;
  _billable_items jsonb;
  _recipient_had_items boolean;
  _no_rate_count integer;
  _lesson_row record;
  _item_row record;
  _rate_minor integer;
  _due_date date;
  _pay_terms integer;
  _invoice_result json;
  _invoice_id uuid;
  _invoice_count integer := 0;
  _skipped_count integer := 0;
  _recipients_total integer := 0;
  _invoice_ids uuid[] := ARRAY[]::uuid[];
  _error_code text;
  _sqlstate text;
  _sqlerrm text;
  _outcome text;
BEGIN
  SELECT * INTO _parent
  FROM recurring_template_runs
  WHERE id = _run_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run % not found', _run_id USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NOT is_org_finance_team(auth.uid(), _parent.org_id) THEN
      RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _parent.outcome = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot retry a cancelled run %; use Run-now to generate a fresh run.', _run_id
      USING ERRCODE = '22023';
  END IF;

  IF _parent.outcome = 'running' THEN
    RAISE EXCEPTION 'Cannot retry run % while it is still running.', _run_id
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _template
  FROM recurring_invoice_templates
  WHERE id = _parent.template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template % not found', _parent.template_id
      USING ERRCODE = 'P0002';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT student_id
    FROM recurring_template_run_errors
    WHERE run_id = _run_id
      AND student_id IS NOT NULL
  ) INTO _failed_student_ids;

  _recipients_total := COALESCE(array_length(_failed_student_ids, 1), 0);

  IF _recipients_total = 0 THEN
    RETURN jsonb_build_object(
      'run_id', NULL,
      'parent_run_id', _run_id,
      'outcome', 'completed_empty',
      'invoice_count', 0,
      'recipients_skipped', 0,
      'recipients_total', 0,
      'invoice_ids', '[]'::jsonb,
      'period_start', _parent.period_start,
      'period_end', _parent.period_end,
      'note', 'No retryable error rows on parent run.'
    );
  END IF;

  INSERT INTO recurring_template_runs (
    template_id, org_id, run_date,
    period_start, period_end,
    triggered_by, triggered_by_user_id,
    outcome,
    recipients_total, invoices_generated, recipients_skipped,
    started_at, audit_metadata,
    parent_run_id
  ) VALUES (
    _template.id, _template.org_id, CURRENT_DATE,
    _parent.period_start, _parent.period_end,
    'retry', auth.uid(),
    'running',
    _recipients_total, 0, 0,
    now(),
    jsonb_build_object(
      'source', 'manual_retry',
      'parent_run_id', _run_id
    ),
    _run_id
  )
  RETURNING id INTO _new_run_id;

  FOREACH _student_id IN ARRAY _failed_student_ids LOOP
    BEGIN
      _resolved_guardian_id := NULL;
      _resolved_student_id := NULL;
      _student_email := NULL;

      SELECT sg.guardian_id INTO _resolved_guardian_id
      FROM student_guardians sg
      WHERE sg.student_id = _student_id
        AND sg.is_primary_payer = true
      LIMIT 1;

      IF _resolved_guardian_id IS NULL THEN
        SELECT email INTO _student_email
        FROM students WHERE id = _student_id;

        IF _student_email IS NOT NULL AND _student_email <> '' THEN
          _resolved_student_id := _student_id;
        ELSE
          INSERT INTO recurring_template_run_errors (
            run_id, template_id, org_id, student_id,
            error_code, error_message
          ) VALUES (
            _new_run_id, _template.id, _template.org_id, _student_id,
            'no_payer_resolved',
            'No primary-payer guardian and student has no email.'
          );
          _skipped_count := _skipped_count + 1;
          CONTINUE;
        END IF;
      END IF;

      IF _template.billing_mode IN ('upfront', 'hybrid') THEN
        IF EXISTS (
          SELECT 1
          FROM invoices i
          WHERE i.generated_from_template_id = _template.id
            AND i.status <> 'void'
            AND (
              (_resolved_guardian_id IS NOT NULL AND i.payer_guardian_id = _resolved_guardian_id)
              OR
              (_resolved_student_id IS NOT NULL AND i.payer_student_id = _resolved_student_id)
            )
            AND EXISTS (
              SELECT 1 FROM recurring_template_runs r
              WHERE r.id = i.generated_from_run_id
                AND r.period_start = _parent.period_start
                AND r.period_end = _parent.period_end
            )
        ) THEN
          INSERT INTO recurring_template_run_errors (
            run_id, template_id, org_id, student_id,
            error_code, error_message
          ) VALUES (
            _new_run_id, _template.id, _template.org_id, _student_id,
            'already_invoiced',
            'A non-void invoice for this student already exists for this period.'
          );
          _skipped_count := _skipped_count + 1;
          CONTINUE;
        END IF;
      END IF;

      _billable_items := '[]'::jsonb;
      _recipient_had_items := false;
      _no_rate_count := 0;

      IF _template.billing_mode IN ('delivered', 'hybrid') THEN
        FOR _lesson_row IN
          SELECT
            l.id          AS lesson_id,
            l.title       AS lesson_title,
            lp.rate_minor AS lp_rate_minor
          FROM lessons l
          JOIN lesson_participants lp
            ON lp.lesson_id = l.id
           AND lp.student_id = _student_id
          LEFT JOIN attendance_records ar
            ON ar.lesson_id = l.id
           AND ar.student_id = _student_id
          WHERE l.org_id = _template.org_id
            AND l.status <> 'cancelled'
            AND l.end_at::date >= _parent.period_start
            AND l.end_at::date <= _parent.period_end
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
          _rate_minor := _lesson_row.lp_rate_minor;

          IF _rate_minor IS NULL THEN
            SELECT (rc.rate_amount * 100)::integer INTO _rate_minor
            FROM students s
            JOIN rate_cards rc ON rc.id = s.default_rate_card_id
            WHERE s.id = _student_id;
          END IF;

          IF _rate_minor IS NULL THEN
            SELECT (rate_amount * 100)::integer INTO _rate_minor
            FROM rate_cards
            WHERE org_id = _template.org_id AND is_default = true
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
              'student_id', _student_id
            )
          );
          _recipient_had_items := true;
        END LOOP;
      END IF;

      IF _template.billing_mode IN ('upfront', 'hybrid') THEN
        FOR _item_row IN
          SELECT description, amount_minor, quantity
          FROM recurring_template_items
          WHERE template_id = _template.id
          ORDER BY order_index NULLS LAST, id
        LOOP
          _billable_items := _billable_items || jsonb_build_array(
            jsonb_build_object(
              'description', _item_row.description,
              'quantity', _item_row.quantity,
              'unit_price_minor', _item_row.amount_minor,
              'linked_lesson_id', NULL,
              'student_id', _student_id
            )
          );
          _recipient_had_items := true;
        END LOOP;
      END IF;

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
          _new_run_id, _template.id, _template.org_id, _student_id,
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

      IF _template.due_date_offset_days IS NOT NULL THEN
        _due_date := _parent.period_end + _template.due_date_offset_days;
      ELSE
        SELECT COALESCE(default_payment_terms_days, 14) INTO _pay_terms
        FROM organisations WHERE id = _template.org_id;
        _due_date := _parent.period_end + COALESCE(_pay_terms, 14);
      END IF;

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
        RAISE EXCEPTION 'CIWI returned no invoice id: %', _invoice_result
          USING ERRCODE = 'P0002';
      END IF;

      UPDATE invoices
        SET generated_from_template_id = _template.id,
            generated_from_run_id      = _new_run_id
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
        _new_run_id, _template.id, _template.org_id, _student_id,
        _error_code,
        format('%s: %s', _sqlstate, _sqlerrm)
      );
      _skipped_count := _skipped_count + 1;
    END;
  END LOOP;

  _outcome := CASE
    WHEN _skipped_count = 0 THEN 'completed'
    WHEN _invoice_count > 0 THEN 'partial'
    ELSE 'failed'
  END;

  UPDATE recurring_template_runs
    SET outcome = _outcome,
        invoices_generated = _invoice_count,
        recipients_skipped = _skipped_count,
        completed_at = now()
    WHERE id = _new_run_id;

  IF _invoice_count > 0 THEN
    UPDATE recurring_invoice_templates
      SET last_run_id = _new_run_id,
          last_run_status = CASE _outcome
            WHEN 'completed' THEN 'completed'
            WHEN 'partial' THEN 'partial'
            ELSE 'failed'
          END,
          last_run_at = now(),
          last_run_invoice_count = _invoice_count
      WHERE id = _template.id;
  END IF;

  INSERT INTO audit_log (
    org_id, actor_user_id, action, entity_type, entity_id, after
  ) VALUES (
    _template.org_id,
    auth.uid(),
    'template_run_retry_completed',
    'recurring_template_run',
    _new_run_id,
    jsonb_build_object(
      'parent_run_id', _run_id,
      'template_id', _template.id,
      'outcome', _outcome,
      'invoice_count', _invoice_count,
      'recipients_skipped', _skipped_count,
      'recipients_total', _recipients_total,
      'period_start', _parent.period_start,
      'period_end', _parent.period_end
    )
  );

  RETURN jsonb_build_object(
    'run_id',             _new_run_id,
    'parent_run_id',      _run_id,
    'outcome',            _outcome,
    'invoice_count',      _invoice_count,
    'recipients_skipped', _skipped_count,
    'recipients_total',   _recipients_total,
    'invoice_ids',        to_jsonb(_invoice_ids),
    'period_start',       _parent.period_start,
    'period_end',         _parent.period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_failed_recipients(uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';