-- Add installment_id to payments table for reliable dedup in auto-pay
ALTER TABLE public.payments
  ADD COLUMN installment_id uuid REFERENCES public.invoice_installments(id) ON DELETE SET NULL;

CREATE INDEX idx_payments_installment_id ON public.payments(installment_id);
