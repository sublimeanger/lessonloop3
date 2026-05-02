-- =========================================================
-- Pre-flight: confirm violating-row inventory matches expected
-- =========================================================
DO $cwf2_preflight$
DECLARE
  _both_set_count int;
  _neither_set_count int;
  _total_violators int;
BEGIN
  SELECT COUNT(*) INTO _both_set_count
  FROM public.invoices
  WHERE payer_guardian_id IS NOT NULL AND payer_student_id IS NOT NULL;

  SELECT COUNT(*) INTO _neither_set_count
  FROM public.invoices
  WHERE payer_guardian_id IS NULL AND payer_student_id IS NULL;

  _total_violators := _both_set_count + _neither_set_count;

  RAISE NOTICE 'CW-F2 preflight: BOTH_SET=%, NEITHER_SET=%, TOTAL=%',
    _both_set_count, _neither_set_count, _total_violators;

  IF _both_set_count <> 5 THEN
    RAISE EXCEPTION 'Aborting: expected 5 BOTH_SET rows, found %', _both_set_count;
  END IF;
  IF _neither_set_count <> 2 THEN
    RAISE EXCEPTION 'Aborting: expected 2 NEITHER_SET rows, found %', _neither_set_count;
  END IF;
END
$cwf2_preflight$;

-- =========================================================
-- Step 1: BOTH_SET — clear payer_student_id on the 5 named rows
-- =========================================================
DO $cwf2_step1$
DECLARE
  _expected_updated int := 5;
  _row_count int;
BEGIN
  UPDATE public.invoices
  SET payer_student_id = NULL
  WHERE id IN (
    '7d3c58b5-25ea-467e-b958-cb8c6854afe3',
    '05cc88ab-1652-44fc-a8eb-ab79c83076cf',
    '8f4bf6a8-d386-49cb-b05e-5ae343de03b4',
    '89c03a02-5085-4ca6-864e-429a899458b5',
    'd7bc061d-ecf3-4abd-a181-3955b15b0139'
  )
  AND payer_guardian_id IS NOT NULL
  AND payer_student_id  IS NOT NULL;

  GET DIAGNOSTICS _row_count = ROW_COUNT;
  RAISE NOTICE 'CW-F2 step 1 (BOTH_SET clear payer_student_id): % rows updated', _row_count;

  IF _row_count <> _expected_updated THEN
    RAISE EXCEPTION 'Aborting: expected % updates, got %', _expected_updated, _row_count;
  END IF;
END
$cwf2_step1$;

-- =========================================================
-- Step 2: NEITHER_SET — delete the 2 named E2E Test Academy rows
-- =========================================================
DO $cwf2_step2$
DECLARE
  _expected_deleted int := 2;
  _row_count int;
BEGIN
  DELETE FROM public.invoices
  WHERE id IN (
    'c66c8c26-ca47-4be9-a987-8edea9c469ea',
    '2cd5ed56-45f0-495b-9e1f-d79b0c747542'
  )
  AND payer_guardian_id IS NULL
  AND payer_student_id  IS NULL
  AND status = 'draft';

  GET DIAGNOSTICS _row_count = ROW_COUNT;
  RAISE NOTICE 'CW-F2 step 2 (NEITHER_SET delete): % rows deleted', _row_count;

  IF _row_count <> _expected_deleted THEN
    RAISE EXCEPTION 'Aborting: expected % deletes, got %', _expected_deleted, _row_count;
  END IF;
END
$cwf2_step2$;

-- =========================================================
-- Step 3: Confirm zero violators remain before VALIDATE
-- =========================================================
DO $cwf2_confirm$
DECLARE
  _remaining int;
BEGIN
  SELECT COUNT(*) INTO _remaining
  FROM public.invoices
  WHERE num_nonnulls(payer_guardian_id, payer_student_id) <> 1;

  RAISE NOTICE 'CW-F2 step 3 (post-fix violator count): %', _remaining;

  IF _remaining <> 0 THEN
    RAISE EXCEPTION 'Aborting: % violating rows still present after cleanup', _remaining;
  END IF;
END
$cwf2_confirm$;

-- =========================================================
-- Step 4: VALIDATE CONSTRAINT
-- =========================================================
ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_payer_xor;

DO $cwf2_validated$
DECLARE
  _is_valid bool;
BEGIN
  SELECT convalidated INTO _is_valid
  FROM pg_constraint
  WHERE conrelid = 'public.invoices'::regclass
    AND conname = 'invoices_payer_xor';

  RAISE NOTICE 'CW-F2 step 4 (constraint convalidated): %', _is_valid;

  IF NOT _is_valid THEN
    RAISE EXCEPTION 'Aborting: invoices_payer_xor still NOT VALID after VALIDATE';
  END IF;
END
$cwf2_validated$;

NOTIFY pgrst, 'reload schema';