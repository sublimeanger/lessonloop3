-- Add status column to payments for tracking BACS processing state
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'succeeded'
    CHECK (status IN ('succeeded', 'processing', 'failed', 'cancelled'));

-- Add mandate reference for BACS
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_mandate_id TEXT;

-- Index for finding processing payments (BACS polling)
CREATE INDEX IF NOT EXISTS idx_payments_status_processing
  ON public.payments(status) WHERE status = 'processing';
