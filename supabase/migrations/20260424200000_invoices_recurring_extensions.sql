-- Journey 9 Phase 1 · Commit 5
-- invoices.generated_from_template_id + generated_from_run_id + partial unique
-- index on invoice_items.linked_lesson_id (duplicate-invoice defence).
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §2 + §11 decision 8.

-- Pre-check: the partial unique index on invoice_items(linked_lesson_id) will
-- fail if existing data has duplicate non-null linked_lesson_id values.
-- Fail loudly with a clear message rather than silently breaking the deploy.
-- void_invoice already nulls linked_lesson_id (migrations 20260315220002,
-- 20260418092500, 20260419001000), so only non-voided duplicates matter.
DO $$
DECLARE
  _dup_count integer;
BEGIN
  SELECT COUNT(*) INTO _dup_count FROM (
    SELECT linked_lesson_id
    FROM invoice_items
    WHERE linked_lesson_id IS NOT NULL
    GROUP BY linked_lesson_id
    HAVING COUNT(*) > 1
  ) dupes;

  IF _dup_count > 0 THEN
    RAISE EXCEPTION
      'Duplicate linked_lesson_id values exist (% groups); partial unique index would fail. Reconcile data first.',
      _dup_count;
  END IF;
END $$;

-- Invoices → recurring template/run back-references for provenance and bulk void.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS generated_from_template_id uuid
    REFERENCES recurring_invoice_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generated_from_run_id uuid
    REFERENCES recurring_template_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_from_template
  ON invoices (generated_from_template_id)
  WHERE generated_from_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_from_run
  ON invoices (generated_from_run_id)
  WHERE generated_from_run_id IS NOT NULL;

-- DB-level duplicate-invoice defence: a lesson can only appear as linked_lesson_id
-- on one non-voided invoice item at a time. void_invoice nulls the link, so
-- voided invoices free the lesson for re-invoicing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_items_linked_lesson_unique
  ON invoice_items (linked_lesson_id)
  WHERE linked_lesson_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
