-- FIX 5A.1: Ensure applied_to_invoice_id has a named FK constraint
-- The column was added with an inline REFERENCES which creates an
-- auto-named constraint. Replace with a named one for clarity.

DO $$
DECLARE
  _constraint_name text;
BEGIN
  -- Find existing auto-generated FK constraint on applied_to_invoice_id
  SELECT tc.constraint_name INTO _constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
  WHERE tc.table_name = 'make_up_credits'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'applied_to_invoice_id'
    AND tc.table_schema = 'public';

  -- Drop existing constraint if found
  IF _constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.make_up_credits DROP CONSTRAINT %I', _constraint_name);
  END IF;
END $$;

ALTER TABLE public.make_up_credits
  ADD CONSTRAINT fk_credit_invoice
  FOREIGN KEY (applied_to_invoice_id)
  REFERENCES public.invoices(id) ON DELETE SET NULL;
