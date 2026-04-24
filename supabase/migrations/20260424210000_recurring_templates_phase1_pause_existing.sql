-- Journey 9 Phase 1 · Commit 6
-- Auto-pause existing recurring_invoice_templates rows so the Phase 2 scheduler
-- doesn't try to run templates that lack recipients/items.
-- Design ref: docs/RECURRING_BILLING_DESIGN.md §8 option (b).

-- Idempotent: only touches rows that haven't already been auto-paused by this
-- migration (checks for the sentinel string in notes).
UPDATE recurring_invoice_templates
SET active = false,
    notes = COALESCE(notes || ' | ', '') || 'Auto-paused 24 April 2026 — recurring billing feature rebuilt in Phase 1 schema; please reconfigure recipients and items before resuming.',
    updated_at = now()
WHERE active = true
  AND (notes IS NULL OR notes NOT LIKE '%Auto-paused 24 April 2026%');

NOTIFY pgrst, 'reload schema';
