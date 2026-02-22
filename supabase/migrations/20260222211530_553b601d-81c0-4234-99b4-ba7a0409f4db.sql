CREATE UNIQUE INDEX idx_payments_provider_reference_unique
ON public.payments (provider_reference)
WHERE provider_reference IS NOT NULL;