-- Journey 9 Phase 2 Brief B: Recurring generator RPCs + Phase 1 schema fixes

-- ============================================================
-- 1. Phase 1 schema fixes (discovered during C4 sanity-check)
-- ============================================================

-- 1a. recurring_template_runs.outcome CHECK: add 'cancelled'
ALTER TABLE public.recurring_template_runs
  DROP CONSTRAINT IF EXISTS recurring_template_runs_outcome_check;

ALTER TABLE public.recurring_template_runs
  ADD CONSTRAINT recurring_template_runs_outcome_check
  CHECK (outcome IN ('completed', 'partial', 'failed', 'running', 'cancelled'));

-- 1b. recurring_template_run_errors.student_id: drop NOT NULL
ALTER TABLE public.recurring_template_run_errors
  ALTER COLUMN student_id DROP NOT NULL;

-- 1c. recurring_invoice_templates.delivered_statuses default: 'attended' -> 'present'
ALTER TABLE public.recurring_invoice_templates
  ALTER COLUMN delivered_statuses SET DEFAULT ARRAY['present']::text[];

-- Migrate existing rows that still hold the invalid default
UPDATE public.recurring_invoice_templates
SET delivered_statuses = ARRAY['present']::text[]
WHERE delivered_statuses = ARRAY['attended']::text[];

-- ============================================================
-- 2. generate_invoices_from_template RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_invoices_from_template(
  _template_id uuid,
  _triggered_by text,
  _source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tmpl RECORD;
  _run_id uuid;
  _period_start date;
  _period_end date;
  _recipient RECORD;
  _student_id uuid;
  _payer_id uuid;
  _invoice_id uuid;
  _invoice_ids uuid[] := ARRAY[]::uuid[];
  _invoice_count int := 0;
  _recipients_total int := 0;
  _recipients_skipped int := 0;
  _outcome text;
  _due_date date;
  _items_json jsonb;
  _items_count int;
  _err_msg text;
  _err_code text;
BEGIN
  -- Load template
  SELECT * INTO _tmpl
  FROM public.recurring_invoice_templates
  WHERE id = _template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Template not found: %', _template_id;
  END IF;

  -- Auth: caller must be finance team for the org (unless service role)
  IF auth.uid() IS NOT NULL AND NOT public.is_org_finance_team(auth.uid(), _tmpl.org_id) THEN
    RAISE EXCEPTION 'Not authorised to run templates for this organisation';
  END IF;

  -- Determine period window from frequency / next_run_date
  _period_start := COALESCE(_tmpl.next_run_date, CURRENT_DATE);
  _period_end := CASE _tmpl.frequency
    WHEN 'weekly'  THEN _period_start + INTERVAL '7 days'
    WHEN 'monthly' THEN (_period_start + INTERVAL '1 month')::date
    WHEN 'termly'  THEN (_period_start + INTERVAL '3 months')::date
    ELSE (_period_start + INTERVAL '1 month')::date
  END;

  _due_date := _period_start + (COALESCE(_tmpl.due_date_offset_days, 14) || ' days')::interval;

  -- Create the run row
  INSERT INTO public.recurring_template_runs (
    template_id, org_id, triggered_by, source, period_start, period_end,
    outcome, started_at
  )
  VALUES (
    _template_id, _tmpl.org_id, _triggered_by, _source, _period_start, _period_end,
    'running', now()
  )
  RETURNING id INTO _run_id;

  -- Iterate recipients
  FOR _recipient IN
    SELECT * FROM public.recurring_template_recipients
    WHERE template_id = _template_id
  LOOP
    _recipients_total := _recipients_total + 1;
    _student_id := _recipient.student_id;
    _payer_id := COALESCE(_recipient.payer_guardian_id, _recipient.student_id);

    BEGIN
      -- Build items JSON from template items (placeholder: 1 line per item)
      SELECT jsonb_agg(
        jsonb_build_object(
          'description', ti.description,
          'quantity', COALESCE(ti.quantity, 1),
          'unit_price', COALESCE(ti.unit_price, 0),
          'tax_rate', COALESCE(ti.tax_rate, 0)
        )
      ), COUNT(*)
      INTO _items_json, _items_count
      FROM public.recurring_template_items ti
      WHERE ti.template_id = _template_id;

      IF _items_count IS NULL OR _items_count = 0 THEN
        INSERT INTO public.recurring_template_run_errors (
          run_id, student_id, error_code, error_message
        ) VALUES (
          _run_id, _student_id, 'no_items', 'Template has no line items'
        );
        _recipients_skipped := _recipients_skipped + 1;
        CONTINUE;
      END IF;

      -- Create invoice via existing RPC
      SELECT public.create_invoice_with_items(
        _tmpl.org_id,
        _payer_id,
        _student_id,
        _period_start,
        _due_date::date,
        _items_json,
        NULL  -- notes
      ) INTO _invoice_id;

      -- Stamp template/run linkage
      UPDATE public.invoices
      SET generated_from_template_id = _template_id,
          generated_from_run_id = _run_id
      WHERE id = _invoice_id;

      _invoice_ids := _invoice_ids || _invoice_id;
      _invoice_count := _invoice_count + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS _err_msg = MESSAGE_TEXT, _err_code = RETURNED_SQLSTATE;
      INSERT INTO public.recurring_template_run_errors (
        run_id, student_id, error_code, error_message
      ) VALUES (
        _run_id, _student_id, COALESCE(_err_code, 'unknown'), LEFT(_err_msg, 1000)
      );
      _recipients_skipped := _recipients_skipped + 1;
    END;
  END LOOP;

  -- Determine outcome
  _outcome := CASE
    WHEN _recipients_total = 0 THEN 'completed'
    WHEN _invoice_count = 0 THEN 'failed'
    WHEN _recipients_skipped > 0 THEN 'partial'
    ELSE 'completed'
  END;

  -- Update run row
  UPDATE public.recurring_template_runs
  SET outcome = _outcome,
      invoice_count = _invoice_count,
      recipients_total = _recipients_total,
      recipients_skipped = _recipients_skipped,
      finished_at = now()
  WHERE id = _run_id;

  -- Bump template next_run_date if successful and scheduler-triggered
  IF _outcome IN ('completed', 'partial') AND _triggered_by IN ('scheduled', 'manual') THEN
    UPDATE public.recurring_invoice_templates
    SET next_run_date = _period_end,
        last_run_at = now(),
        updated_at = now()
    WHERE id = _template_id;
  END IF;

  RETURN jsonb_build_object(
    'run_id', _run_id,
    'outcome', _outcome,
    'invoice_count', _invoice_count,
    'recipients_skipped', _recipients_skipped,
    'recipients_total', _recipients_total,
    'invoice_ids', to_jsonb(_invoice_ids),
    'period_start', _period_start,
    'period_end', _period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_invoices_from_template(uuid, text, text)
  TO authenticated, service_role;

-- ============================================================
-- 3. cancel_template_run RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_template_run(_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run RECORD;
  _voided_count int := 0;
  _invoice_id uuid;
BEGIN
  SELECT * INTO _run
  FROM public.recurring_template_runs
  WHERE id = _run_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run not found: %', _run_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_org_finance_team(auth.uid(), _run.org_id) THEN
    RAISE EXCEPTION 'Not authorised to cancel runs for this organisation';
  END IF;

  -- Void all invoices generated by this run that aren't already voided/paid
  FOR _invoice_id IN
    SELECT id FROM public.invoices
    WHERE generated_from_run_id = _run_id
      AND voided_at IS NULL
      AND status NOT IN ('paid')
  LOOP
    BEGIN
      PERFORM public.void_invoice(_invoice_id, 'Cancelled via template run cancellation');
      _voided_count := _voided_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Continue; record skip
      NULL;
    END;
  END LOOP;

  UPDATE public.recurring_template_runs
  SET outcome = 'cancelled',
      finished_at = COALESCE(finished_at, now())
  WHERE id = _run_id;

  RETURN jsonb_build_object(
    'run_id', _run_id,
    'outcome', 'cancelled',
    'invoices_voided', _voided_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_template_run(uuid)
  TO authenticated, service_role;