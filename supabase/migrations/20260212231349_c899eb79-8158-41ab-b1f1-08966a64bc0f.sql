
-- Add payment preference fields to organisations
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS payment_methods_enabled TEXT[] DEFAULT '{card}',
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_sort_code TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_reference_prefix TEXT,
  ADD COLUMN IF NOT EXISTS online_payments_enabled BOOLEAN DEFAULT true;
