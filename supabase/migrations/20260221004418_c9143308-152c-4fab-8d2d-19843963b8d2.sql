ALTER TYPE public.billing_run_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.billing_run_status ADD VALUE IF NOT EXISTS 'partial';