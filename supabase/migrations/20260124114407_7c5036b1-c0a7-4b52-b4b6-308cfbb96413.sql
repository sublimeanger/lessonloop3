-- Add credit tracking column to invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS credit_applied_minor integer NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.invoices.credit_applied_minor IS 'Total make-up credit amount applied to this invoice (in minor units)';

-- Create index for reporting on invoices with credits
CREATE INDEX IF NOT EXISTS idx_invoices_credit_applied ON public.invoices(credit_applied_minor) WHERE credit_applied_minor > 0;