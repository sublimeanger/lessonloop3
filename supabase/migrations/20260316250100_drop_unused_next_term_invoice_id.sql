-- TC-15: Drop unused next_term_invoice_id column from term_continuation_responses
ALTER TABLE public.term_continuation_responses
  DROP COLUMN IF EXISTS next_term_invoice_id;
