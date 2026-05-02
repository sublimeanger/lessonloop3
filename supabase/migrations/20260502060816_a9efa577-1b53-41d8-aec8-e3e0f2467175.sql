-- CW-F4 trigger sanity test (Step 4 of Batch 1Z verification)
--
-- Empirically verify the 9 statement-level triggers installed in
-- 20260516110000_canary_walk_batch_1z_corrected.sql bump
-- public.invoices.pdf_rev exactly once per UPDATE statement on each
-- child table (invoice_items, invoice_installments, payments).
--
-- We exercise UPDATE only (not INSERT/DELETE) to avoid touching real
-- business data. INSERT/UPDATE/DELETE triggers all share identical
-- statement-level body (UPDATE invoices SET pdf_rev=pdf_rev+1 WHERE
-- id IN (...)) — verifying UPDATE on each table validates the wiring
-- works for that table; the INSERT/DELETE variants are structurally
-- identical and were already proven to be installed by Query A in
-- the verification step.
--
-- Self-cleaning: pdf_rev is restored to its original value after the
-- test. If any expected bump does not occur, the migration raises and
-- rolls back.

DO $cwf4_sanity$
DECLARE
  _invoice_id uuid := 'd7041eeb-6e4d-488a-af82-5c7a70cafea8';
  _initial_pdf_rev integer;
  _after_items integer;
  _after_insts integer;
  _after_pays integer;
  _item_id uuid;
  _inst_id uuid;
  _pay_id uuid;
BEGIN
  SELECT pdf_rev INTO _initial_pdf_rev FROM public.invoices WHERE id = _invoice_id;
  IF _initial_pdf_rev IS NULL THEN
    RAISE EXCEPTION 'CW-F4 sanity: target invoice % not found', _invoice_id;
  END IF;

  -- 1. invoice_items UPDATE trigger
  SELECT id INTO _item_id FROM public.invoice_items WHERE invoice_id = _invoice_id LIMIT 1;
  IF _item_id IS NULL THEN
    RAISE EXCEPTION 'CW-F4 sanity: no invoice_items row for target invoice';
  END IF;
  UPDATE public.invoice_items SET description = description WHERE id = _item_id;
  SELECT pdf_rev INTO _after_items FROM public.invoices WHERE id = _invoice_id;
  IF _after_items <> _initial_pdf_rev + 1 THEN
    RAISE EXCEPTION 'CW-F4 sanity FAIL: invoice_items UPDATE did not bump pdf_rev (was %, now %)',
      _initial_pdf_rev, _after_items;
  END IF;

  -- 2. invoice_installments UPDATE trigger
  SELECT id INTO _inst_id FROM public.invoice_installments WHERE invoice_id = _invoice_id LIMIT 1;
  IF _inst_id IS NULL THEN
    RAISE EXCEPTION 'CW-F4 sanity: no invoice_installments row for target invoice';
  END IF;
  UPDATE public.invoice_installments SET amount_minor = amount_minor WHERE id = _inst_id;
  SELECT pdf_rev INTO _after_insts FROM public.invoices WHERE id = _invoice_id;
  IF _after_insts <> _after_items + 1 THEN
    RAISE EXCEPTION 'CW-F4 sanity FAIL: invoice_installments UPDATE did not bump pdf_rev (was %, now %)',
      _after_items, _after_insts;
  END IF;

  -- 3. payments UPDATE trigger
  SELECT id INTO _pay_id FROM public.payments WHERE invoice_id = _invoice_id LIMIT 1;
  IF _pay_id IS NULL THEN
    RAISE EXCEPTION 'CW-F4 sanity: no payments row for target invoice';
  END IF;
  UPDATE public.payments SET amount_minor = amount_minor WHERE id = _pay_id;
  SELECT pdf_rev INTO _after_pays FROM public.invoices WHERE id = _invoice_id;
  IF _after_pays <> _after_insts + 1 THEN
    RAISE EXCEPTION 'CW-F4 sanity FAIL: payments UPDATE did not bump pdf_rev (was %, now %)',
      _after_insts, _after_pays;
  END IF;

  -- Self-clean: restore pdf_rev to original value (the invoices table
  -- has no trigger on itself, so this UPDATE does not cascade).
  UPDATE public.invoices SET pdf_rev = _initial_pdf_rev WHERE id = _invoice_id;

  RAISE NOTICE 'CW-F4 sanity PASS: 3 statement-level UPDATE triggers each bumped pdf_rev by 1 (initial=%, items=%, insts=%, pays=%); pdf_rev restored to %',
    _initial_pdf_rev, _after_items, _after_insts, _after_pays, _initial_pdf_rev;
END
$cwf4_sanity$;