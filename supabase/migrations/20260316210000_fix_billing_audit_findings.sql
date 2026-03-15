-- ============================================================
-- Fix billing audit findings (BIL-H2, BIL-H3, BIL-H4, BIL-M1)
-- Audit: audit-feature-11-billing-runs.md
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- BIL-H4: Add auth check to get_unbilled_lesson_ids
-- Previously had NO auth check — any authenticated user could
-- enumerate lesson IDs for any org (cross-org data leak).
-- Also fixes BIL-M1: dedup is now per-(lesson, student) not
-- per-lesson, so group lessons with partially-billed students
-- still appear in unbilled results.
-- Also fixes BIL-L2: preview now matches actual billing logic.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unbilled_lesson_ids(
  _org_id UUID,
  _start TEXT,
  _end TEXT
)
RETURNS SETOF UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Auth check: caller must be finance team for this org
  IF NOT is_org_finance_team(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Return lessons that have at least one participant with no
  -- corresponding billed invoice_item (per-student dedup).
  -- This ensures group lessons remain visible when only some
  -- students have been billed.
  RETURN QUERY
    SELECT DISTINCT l.id
    FROM lessons l
    INNER JOIN lesson_participants lp ON lp.lesson_id = l.id
    WHERE l.org_id = _org_id
      AND l.start_at >= _start::timestamptz
      AND l.start_at <= _end::timestamptz
      AND l.status IN ('completed', 'scheduled')
      AND (l.is_open_slot IS NULL OR l.is_open_slot = false)
      AND NOT EXISTS (
        SELECT 1 FROM invoice_items ii
        WHERE ii.linked_lesson_id = l.id
          AND ii.student_id = lp.student_id
      );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- BIL-H2: Add billing_run_id FK to invoices table
-- Previously invoices had no link back to the billing run that
-- created them — only a fragile JSONB array in the summary.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_run_id uuid
  REFERENCES public.billing_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_billing_run_id
  ON public.invoices(billing_run_id)
  WHERE billing_run_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- BIL-H3: Create delete_billing_run RPC
-- Atomic deletion of a billing run and all its draft invoices.
-- Refuses to delete runs that contain paid invoices.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_billing_run(
  _billing_run_id uuid,
  _org_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _run RECORD;
  _paid_count integer;
  _deleted_invoices integer;
  _deleted_items integer;
BEGIN
  -- Auth: caller must be admin/owner
  IF NOT is_org_admin(auth.uid(), _org_id) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Lock the billing run row
  SELECT id, org_id, status INTO _run
  FROM billing_runs
  WHERE id = _billing_run_id AND org_id = _org_id
  FOR UPDATE;

  IF _run IS NULL THEN
    RAISE EXCEPTION 'Billing run not found';
  END IF;

  -- Check for paid invoices — refuse deletion if any exist
  SELECT COUNT(*) INTO _paid_count
  FROM invoices
  WHERE billing_run_id = _billing_run_id
    AND org_id = _org_id
    AND status = 'paid';

  IF _paid_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete billing run: % paid invoice(s) exist', _paid_count;
  END IF;

  -- Delete invoice items (cascade from invoice deletion would also
  -- handle this, but being explicit for clarity and audit trail)
  DELETE FROM invoice_items
  WHERE invoice_id IN (
    SELECT id FROM invoices
    WHERE billing_run_id = _billing_run_id AND org_id = _org_id
  );
  GET DIAGNOSTICS _deleted_items = ROW_COUNT;

  -- Delete invoices
  DELETE FROM invoices
  WHERE billing_run_id = _billing_run_id AND org_id = _org_id;
  GET DIAGNOSTICS _deleted_invoices = ROW_COUNT;

  -- Delete the billing run itself
  DELETE FROM billing_runs
  WHERE id = _billing_run_id AND org_id = _org_id;

  -- Audit log
  INSERT INTO audit_log (org_id, actor_user_id, action, entity_type, entity_id, after)
  VALUES (_org_id, auth.uid(), 'billing_run_deleted', 'billing_run', _billing_run_id,
    jsonb_build_object(
      'deleted_invoices', _deleted_invoices,
      'deleted_items', _deleted_items
    ));

  RETURN json_build_object(
    'deleted_invoices', _deleted_invoices,
    'deleted_items', _deleted_items
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- BIL-L1: Document invoice_number_sequences safety
-- The UPDATE in generate_invoice_number acquires a row-level
-- lock, so concurrent inserts are serialised by PostgreSQL.
-- No code change needed — adding a comment for documentation.
-- ────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.generate_invoice_number(uuid) IS
  'Generates sequential invoice numbers. Thread-safe: the UPDATE '
  'on invoice_number_sequences acquires a row lock, serialising '
  'concurrent invoice creation within the same org.';
